from connections import session_manager, room_manager
from database import db_operations
from flask_socketio import emit
import events
import random
from constants import NUM_PLAYERS_TO_LOWEST_CARD, CARD_VALUE_STRINGS_TO_INT, SUIT_TO_FULL_NAME
from game.game_states import GameStates, SynchStates
import game.constants as game_constants
import constants
import game.game_responses as responses
from game.ui_synchronizer import EraseTracker


class InProgressGame:
    """ Manages a game from initialization to completion and sends messages to all users. """
    def __init__(self, game):
        self.game = game
        self.player_info = db_operations.get_players_in_game(game.id)
        self.still_playing = []
        self.still_playing_count = self.game.num_players
        for i in range(self.game.num_players):
            self.still_playing.append(True)
        self.room_name = room_manager.get_room_name(game.id)
        self.attack_cards = []
        self.defense_cards = []
        self.erase_tracker = EraseTracker(self.game.num_players)
        self.erasing_state = SynchStates.NOT_ERASING
        random.shuffle(self.player_info)
        self.__acquire_session_ids()
        self.__initialize_game()
        self.transition_state(None, None, None, None)

    def __acquire_session_ids(self):
        self.session_ids = []
        for player in self.player_info:
            self.session_ids.append(session_manager.get_session_id(player.id))

    def __initialize_game(self):
        """ Performs game initialization.  Updates UI with screen names and deals cards to players. """
        self.game_state = GameStates.INIT
        screen_names = []
        for player in self.player_info:
            screen_names.append(player.screen_name)
        emit(events.INIT_GAME, (self.game.id, screen_names), room=self.room_name)
        self.deck = DurakDeck(NUM_PLAYERS_TO_LOWEST_CARD[self.game.num_players])
        self.hands = []
        for i in range(self.game.num_players):
            new_hand = []
            self.deck.draw_cards(game_constants.MIN_CARDS_PER_HAND, new_hand)
            self.hands.append(new_hand)
        self.trump_card = self.deck.draw_trump_card()
        self.trump_suit = self.trump_card[0]
        self.__display_trump_suit()
        # we display the trump card and the UI automatically removes it when cards remaining == 0
        self.__display_trump_card()

    def __set_defense_index(self):
        """ Sets the defense index in accordance with the current attack index. """
        self.defense_index = (self.attack_index + 1) % self.game.num_players
        while self.still_playing[self.defense_index] is False:
            self.defense_index = (self.defense_index + 1) % self.game.num_players

    def __move_attack_and_defense_indices(self, increment):
        """ Move the attack index based on the increment.  Increment = 1 if fully defended, = 2 if pickup. """
        self.attack_index = (self.attack_index + increment) % self.game.num_players
        while self.still_playing[self.attack_index] is False:
            self.attack_index = (self.attack_index + 1) % self.game.num_players
        self.__set_defense_index()

    def __set_slide_index(self):
        self.slide_index = (self.defense_index + 1) % self.game.num_players
        while self.still_playing[self.attack_index] is False:
            self.slide_index = (self.slide_index + 1) % self.game.num_players

    def __set_drawing_index(self, initial):
        if initial:
            self.drawing_index = self.attack_index
        else:
            self.drawing_index = (self.drawing_index - 1) % self.game.num_players

    def __move_adding_index(self, initial):
        if initial:
            self.adding_index = self.attack_index
        else:
            self.adding_index = (self.adding_index - 1) % self.game.num_players
        while (len(self.hands[self.adding_index]) is 0) and (self.still_playing[self.adding_index] is False) \
                and (self.adding_index is not self.defense_index):
            self.adding_index = (self.adding_index - 1) % self.game.num_players

    def __sort_and_display_updated_hands(self):
        hand_counts = []
        for i in range(self.game.num_players):
            list.sort(self.hands[i], key=self.__hand_sorter)
            emit(events.DISPLAY_HAND, self.hands[i], room=self.session_ids[i])
            hand_counts.append(len(self.hands[i]))
        emit(events.UPDATE_HAND_COUNTS, hand_counts, room=self.room_name)

    def __display_trump_card(self):
        emit(events.DISPLAY_TRUMP_CARD, self.trump_card, room=self.room_name)

    def __display_cards_remaining(self):
        emit(events.DISPLAY_CARDS_REMAINING, self.deck.get_cards_remaining(), room=self.room_name)

    def __display_cards_discarded(self):
        emit(events.DISPLAY_CARDS_DISCARDED, self.deck.get_cards_discarded(), room=self.room_name)

    def __display_trump_suit(self):
        suit = SUIT_TO_FULL_NAME[self.trump_suit]
        emit(events.DISPLAY_TRUMP_SUIT, suit, room=self.room_name)

    def __hand_sorter(self, card):
        card_suit = card[0]
        card_value = card[1:]
        sort_value = card_value_to_int(card_value)
        if card_suit == self.trump_suit:
            sort_value += 14
        return sort_value

    def __send_status_message(self, special_index, special_message, general_message):
        """ Sends special_message to special_index player and general_message to all other players. """
        emit(events.UPDATE_USER_STATUS_MESSAGE, special_message, room=self.session_ids[special_index])
        for player_index in range(self.game.num_players):
            if player_index is not special_index:
                emit(events.UPDATE_USER_STATUS_MESSAGE, general_message, room=self.session_ids[player_index])

    def __send_on_attack_message(self):
        self.__send_status_message(self.attack_index, self.__construct_on_attack_message(),
                                   self.__construct_on_attack_status_message())

    def __send_on_defense_message(self):
        self.__send_status_message(self.defense_index, self.__construct_on_defense_message(),
                                   self.__construct_on_defense_status_message())

    def __send_adding_message(self):
        self.__send_status_message(self.adding_index, self.__construct_adding_message(),
                                   self.__construct_adding_status_message())

    def __disable_boards(self, special_index):
        """ Shows current cards and disables board for all players besides special_index. """
        for player_index in range(self.game.num_players):
            if player_index is not special_index:
                emit(events.DISABLE_GAME_BOARD, (self.attack_cards, self.defense_cards),
                     room=self.session_ids[player_index])

    def __enable_attack_ui(self):
        max_cards = min(len(self.hands[self.defense_index]), game_constants.MAX_CARDS_PER_DIGIT)
        emit(events.ON_ATTACK, max_cards, room=self.session_ids[self.attack_index])
        self.__disable_boards(self.attack_index)

    def __enable_on_defense_ui(self):
        slide_to_player_hand_size = len(self.hands[self.slide_index])
        emit(events.ON_DEFENSE, (self.attack_cards, self.defense_cards, slide_to_player_hand_size),
             room=self.session_ids[self.defense_index])
        self.__disable_boards(self.defense_index)

    def __enable_adding_ui(self):
        max_total_cards = game_constants.MAX_CARDS_PER_ATTACK - len(self.attack_cards)
        max_cards_to_add = min(len(self.hands[self.defense_index]), max_total_cards)
        emit(events.ADDING, (self.attack_cards, self.defense_cards, max_cards_to_add),
             room=self.session_ids[self.adding_index])
        self.__disable_boards(self.adding_index)

    def __enable_defending_ui(self):
        emit(events.DEFENDING, (self.attack_cards, self.defense_cards), room=self.session_ids[self.defense_index])
        self.__disable_boards(self.defense_index)

    def __get_screen_name(self, player_index):
        return self.player_info[player_index].screen_name

    def __update_cards_on_table(self, attack_cards, defense_cards, cards_added_this_turn, current_turn_index):
        """
        Updates server-side variables which track the attack and defense cards on the table. Additionally, removes all
        card_added_this_turn from the hand of player with index current_turn_index.
        """
        self.attack_cards = attack_cards
        self.defense_cards = defense_cards
        for card in cards_added_this_turn:
            self.__remove_card_from_hand(current_turn_index, card)

    def __move_all_cards_on_table_to_hand(self, player_index):
        """ Moves all attack and defense cards to the hand of player with index == player_index."""
        for card in self.attack_cards + self.defense_cards:
            self.__add_card_to_hand(card, player_index)
        self.attack_cards = []
        self.defense_cards = []

    def __discard_all_cards_on_table(self):
        """ Discards all the cards on the table after a successful defense. """
        for card in self.attack_cards + self.defense_cards:
            self.deck.discard_card(card)
        self.attack_cards = []
        self.defense_cards = []

    def __end_turn_pickup(self):
        """ Performs end of turn sequence after all players have finished adding to a pickup. """
        self.__move_all_cards_on_table_to_hand(self.defense_index)
        self.game_state = GameStates.TURN_OVER_PICKUP

    def __end_turn_successful_defense(self):
        """ Performs end of turn sequence after a successful defense. """
        self.__discard_all_cards_on_table()
        self.game_state = GameStates.TURN_OVER_DEFENSE

    def transition_state(self, response, attack_cards, defense_cards, cards_added_this_turn):
        """ Performs state transitions to control game play. """
        if self.erasing_state is SynchStates.NOT_ERASING:
            if self.game_state is GameStates.INIT:
                self.__init_to_attack_transition()
            elif self.game_state is GameStates.ON_ATTACK and response == responses.ON_ATTACK_RESPONSE:
                self.__update_cards_on_table(attack_cards, defense_cards, cards_added_this_turn, self.attack_index)
                self.__attack_to_defend_transition()
            elif self.game_state is GameStates.ON_DEFENSE:
                self.__update_cards_on_table(attack_cards, defense_cards, cards_added_this_turn, self.defense_index)
                if response == responses.DEFEND_RESPONSE:
                    self.__on_defense_to_defend_transition()
                elif response == responses.PICKUP_RESPONSE:
                    self.__on_defense_to_pickup_transition()
                elif response == responses.SLIDE_RESPONSE:
                    self.__on_defense_to_slide_transition()
            elif self.game_state is GameStates.ADDING_PICKUP and response == responses.DONE_ADDING_RESPONSE:
                self.__update_cards_on_table(attack_cards, defense_cards, cards_added_this_turn, self.adding_index)
                self.__adding_pickup_transition()
            elif self.game_state is GameStates.ADDING_DEFENSE and response == responses.DONE_ADDING_RESPONSE:
                self.__update_cards_on_table(attack_cards, defense_cards, cards_added_this_turn, self.adding_index)
                self.__adding_defense_transition()
            elif self.game_state is GameStates.DEFENDING:
                self.__update_cards_on_table(attack_cards, defense_cards, cards_added_this_turn, self.defense_index)
                if response == responses.DEFEND_RESPONSE:
                    self.__defending_transition()
                elif response == responses.PICKUP_RESPONSE:
                    self.__defending_to_pickup_transition()

            if (self.game_state is GameStates.TURN_OVER_PICKUP) or (self.game_state is GameStates.TURN_OVER_DEFENSE):
                self.__draw_cards_to_smaller_hands()
                self.__determine_winners_and_losers()
                if self.game_state is not GameStates.GAME_OVER:
                    self.__turn_over_to_attack_transition()

            if self.game_state is not GameStates.GAME_OVER:
                self.erase_tracker.start_new_erase_sequence()
                self.erasing_state = SynchStates.ERASING
                emit(events.ERASE_EVENT, room=self.room_name)

        elif (self.erasing_state is SynchStates.ERASING) and (response == responses.DONE_ERASING):
            done_erasing = self.erase_tracker.add_erase()
            if done_erasing:
                self.erasing_state = SynchStates.NOT_ERASING
                self.__update_game()

    def __init_to_attack_transition(self):
        """ Takes the game from INIT to the first move which is always an attack. """
        self.attack_index = random.randint(0, self.game.num_players - 1)
        self.adding_index = self.attack_index
        self.__set_defense_index()
        self.game_state = GameStates.ON_ATTACK

    def __attack_to_defend_transition(self):
        """ Takes the game from ON_ATTACK to ON_DEFENSE -- the first opportunity to defend. """
        self.game_state = GameStates.ON_DEFENSE
        self.__set_slide_index()

    def __on_defense_to_pickup_transition(self):
        """ Takes the game from ON_DEFENSE to either ADDING or next appropriate state. """
        max_pairings = len(self.hands[self.defense_index])
        attack_cards_added = len(self.attack_cards)
        if (max_pairings == attack_cards_added) or (attack_cards_added == game_constants.MAX_CARDS_PER_ATTACK):
            self.__end_turn_pickup()
        else:
            self.__move_adding_index(True)
            if self.adding_index is self.defense_index:  # no add possible
                self.__end_turn_pickup()
            else:
                self.game_state = GameStates.ADDING_PICKUP

    def __on_defense_to_slide_transition(self):
        """ Takes the appropriate transition from ON_DEFENSE with a SLIDE response."""
        self.__move_attack_and_defense_indices(1)
        self.game_state = GameStates.ON_DEFENSE
        self.__set_slide_index()

    def __on_defense_to_defend_transition(self):
        """ Transitions game from ON_DEFENSE to DEFENDING (no option for slide). """
        cards_in_defenders_hand = len(self.hands[self.defense_index])
        if cards_in_defenders_hand is 0:
            self.__end_turn_successful_defense()
        else:
            self.__move_adding_index(True)
            if self.adding_index is self.defense_index:  # no add possible
                self.__end_turn_successful_defense()
            else:
                self.game_state = GameStates.ADDING_DEFENSE

    def __adding_pickup_transition(self):
        """ Performs necessary transitions at the end of an adding - 'doneAdding' for ADDING_PICKUP"""
        if len(self.attack_cards) is game_constants.MAX_CARDS_PER_ATTACK:
            self.__end_turn_pickup()
        else:
            cards_in_defender_hand = len(self.hands[self.defense_index])
            extra_attack_cards = len(self.attack_cards) - len(self.defense_cards)
            if extra_attack_cards == cards_in_defender_hand:
                self.__end_turn_pickup()
            else:
                self.__move_adding_index(False)
                if self.adding_index is self.defense_index:
                    self.__end_turn_pickup()

    def __adding_defense_transition(self):
        """ Performs necessary transitions at the end of an adding - 'doneAdding' for ADDING_DEFENSE. """
        if len(self.attack_cards) is len(self.defense_cards):   # no cards were added this turn
            self.__move_adding_index(False)
            if self.adding_index is self.defense_index:
                self.__end_turn_successful_defense()
        else:
            self.game_state = GameStates.DEFENDING

    def __turn_over_to_attack_transition(self):
        """ Moves the game from either TURN_OVER_PICKUP or TURN_OVER_DEFENSE into ON_ATTACK."""
        if self.game_state is GameStates.TURN_OVER_PICKUP:
            self.__move_attack_and_defense_indices(2)
        elif self.game_state is GameStates.TURN_OVER_DEFENSE:
            self.__move_attack_and_defense_indices(1)
        self.game_state = GameStates.ON_ATTACK

    def __defending_transition(self):
        """ Performs necessary transition from DEFENDING after a 'defense' response is received. """
        cards_on_attack = len(self.attack_cards)
        defender_hand_size = len(self.hands[self.defense_index])
        if (cards_on_attack is game_constants.MAX_CARDS_PER_ATTACK) or (defender_hand_size is 0):
            self.__end_turn_successful_defense()
        else:
            self.__move_adding_index(True)
            if self.adding_index is self.defense_index:
                self.__end_turn_successful_defense()
            else:
                self.game_state = GameStates.ADDING_DEFENSE

    def __defending_to_pickup_transition(self):
        """ Performs necessary transition from DEFENDING after a 'pickup' response is received."""
        extra_attack_cards = len(self.attack_cards) - len(self.defense_cards)
        total_attack_cards = len(self.attack_cards)
        defense_hand_size = len(self.hands[self.defense_index])
        if (total_attack_cards is game_constants.MAX_CARDS_PER_ATTACK) or (extra_attack_cards is defense_hand_size):
            self.__end_turn_pickup()
        else:
            self.__move_adding_index(True)
            if self.adding_index is self.defense_index:
                self.__end_turn_pickup()
            else:
                self.game_state = GameStates.ADDING_PICKUP

    def __update_game(self):
        """ Handles all UI events based on the current game state. """
        if self.game_state is GameStates.ON_ATTACK:
            self.__display_cards_remaining()
            self.__display_cards_discarded()
            self.__sort_and_display_updated_hands()
            self.__send_on_attack_message()
            self.__draw_attacking_label()
            self.__draw_defending_label()
            self.__erase_adding_label()
            self.__enable_attack_ui()
        elif self.game_state is GameStates.ON_DEFENSE:
            self.__sort_and_display_updated_hands()
            self.__send_on_defense_message()
            self.__draw_attacking_label()
            self.__draw_defending_label()
            self.__erase_adding_label()
            self.__enable_on_defense_ui()
        elif self.game_state is GameStates.ADDING_PICKUP or self.game_state is GameStates.ADDING_DEFENSE:
            self.__sort_and_display_updated_hands()
            self.__send_adding_message()
            self.__erase_attacking_label()
            self.__draw_defending_label()
            self.__draw_adding_label()
            self.__enable_adding_ui()
        elif self.game_state is GameStates.DEFENDING:
            self.__sort_and_display_updated_hands()
            self.__send_on_defense_message()
            self.__draw_attacking_label()
            self.__draw_defending_label()
            self.__erase_adding_label()
            self.__enable_defending_ui()

    def __construct_on_attack_message(self):
        return 'YOUR TURN: Attacking %s' % self.__get_screen_name(self.defense_index)

    def __construct_on_attack_status_message(self):
        on_attack_screen_name = self.__get_screen_name(self.attack_index)
        on_defense_screen_name = self.__get_screen_name(self.defense_index)
        return '%s is attacking %s' % (on_attack_screen_name, on_defense_screen_name)

    def __construct_on_defense_message(self):
        return 'YOUR TURN: Defending'

    def __construct_on_defense_status_message(self):
        return '%s is defending.' % self.__get_screen_name(self.defense_index)

    def __construct_adding_message(self):
        return 'YOUR TURN: Adding to attack on %s' % self.__get_screen_name(self.defense_index)

    def __construct_adding_status_message(self):
        on_defense_screen_name = self.__get_screen_name(self.defense_index)
        on_adding_screen_name = self.__get_screen_name(self.adding_index)
        return '%s is adding to attack on %s' % (on_adding_screen_name, on_defense_screen_name)

    def __draw_attacking_label(self):
        emit(events.DRAW_ATTACKING, (self.game.num_players, self.attack_index), room=self.room_name)

    def __erase_attacking_label(self):
        emit(events.ERASE_ATTACKING, room=self.room_name)

    def __draw_defending_label(self):
        emit(events.DRAW_DEFENDING, (self.game.num_players, self.defense_index), room=self.room_name)

    def __erase_defending_label(self):
        emit(events.ERASE_DEFENDING, room=self.room_name)

    def __draw_adding_label(self):
        emit(events.DRAW_ADDING, (self.game.num_players, self.adding_index), room=self.room_name)

    def __erase_adding_label(self):
        emit(events.ERASE_ADDING, room=self.room_name)

    def __remove_card_from_hand(self, player_index, card):
        self.hands[player_index].remove(card)

    def __add_card_to_deck(self, player_index, card):
        self.hands[player_index].append(card)

    def __draw_cards_to_smaller_hands(self):
        if self.deck.no_cards_remaining() or self.__every_hand_has_at_least_six():
            return
        self.__set_drawing_index(True)
        while not self.__every_hand_has_at_least_six() and not self.deck.no_cards_remaining():
            if len(self.hands[self.drawing_index]) < game_constants.MIN_CARDS_PER_HAND:
                self.deck.draw_cards(1, self.hands[self.drawing_index])
            else:
                self.__set_drawing_index(False)

    def __every_hand_has_at_least_six(self):
        for hand in self.hands:
            if len(hand) < game_constants.MIN_CARDS_PER_HAND:
                return False
        return True

    def __determine_winners_and_losers(self):
        if self.deck.no_cards_remaining():
            just_finished = set()
            still_remaining = -1
            for player_index in range(self.game.num_players):
                if self.still_playing[player_index] and (len(self.hands[player_index]) == 0):
                    self.still_playing[player_index] = False
                    self.still_playing_count -= 1
                    just_finished.add(player_index)
                elif (len(self.hands[player_index])) > 0:
                    still_remaining = player_index
            game_over = self.__game_over(just_finished, still_remaining)
            if game_over:
                self.game_state = GameStates.GAME_OVER

    def __game_over(self, just_finished, still_remaining):
        if self.still_playing_count == 0:
            self.__game_over_with_draw(just_finished)
            return True
        elif self.still_playing_count == 1:
            self.__game_over_with_single_loser(still_remaining)
            return True
        return False

    def __game_over_with_draw(self, just_finished):
        loss_message = constants.DRAW_MESSAGE % len(just_finished)
        win_message = constants.WIN_MESSAGE_WITH_DRAW % len(just_finished)
        for player_index in range(self.game.num_players):
            if player_index in just_finished:
                self.__add_loss(player_index)
                emit(events.GAME_OVER, loss_message, room=self.session_ids[player_index])
            else:
                emit(events.GAME_OVER, win_message, room=self.session_ids[player_index])

    def __game_over_with_single_loser(self, still_remaining):
        for player_index in range(self.game.num_players):
            if player_index is still_remaining:
                self.__add_loss(player_index)
                emit(events.GAME_OVER, constants.LOSS_MESSAGE, room=self.session_ids[player_index])
            else:
                emit(events.GAME_OVER, constants.WIN_MESSAGE_SINGLE_LOSS, room=self.session_ids[player_index])

    def __add_loss(self, player_index):
        user_id = self.player_info[player_index].id
        db_operations.insert_loss(user_id, self.game.id)

    def __add_card_to_hand(self, card, player_index):
        self.hands[player_index].append(card)


class DurakDeck:
    """ This class manages the durak deck from construction, to drawing cards, to discarding cards. """
    def __init__(self, lowest_card):
        self.__make_deck(lowest_card)
        self.cards_discarded = 0

    def __make_deck(self, lowest_card):
        self.deck = []
        for suit in 'cdhs':
            for i in range(lowest_card, 11):
                self.deck.append(str(suit) + str(i))
            for royal in 'jqka':
                self.deck.append(str(suit) + str(royal))
        random.shuffle(self.deck)

    def get_cards_remaining(self):
        return len(self.deck)

    def draw_card(self):
        if len(self.deck) > 0:
            return self.deck.pop()
        else:
            return None

    def discard_card(self, card):
        # NOTE: for now we do not keep track of discarded cards, but we can implement this later to build an AI
        self.cards_discarded += 1

    def draw_cards(self, n, hand):
        for i in range(n):
            card = self.draw_card()
            if card is not None:
                hand.append(card)
            else:
                break

    def draw_trump_card(self):
        trump_card = self.deck.pop()
        self.deck.insert(0, trump_card)
        return trump_card

    def get_cards_discarded(self):
        return self.cards_discarded

    def no_cards_remaining(self):
        return len(self.deck) == 0


def card_value_to_int(card_value_string):
    return CARD_VALUE_STRINGS_TO_INT[card_value_string]
