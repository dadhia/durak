from connections import session_manager, room_manager
from database import db_operations
from flask_socketio import emit
import events
import random
from constants import NUM_PLAYERS_TO_LOWEST_CARD, CARD_VALUE_STRINGS_TO_INT, SUIT_TO_FULL_NAME
from game.game_states import GameStates
import game.constants as game_constants


class InProgressGame:
    """ Manages a game from initialization to completion and sends messages to all users. """
    def __init__(self, game):
        self.game = game
        self.player_info = db_operations.get_players_in_game(game.id)
        self.still_playing = []
        for i in range(self.game.num_players):
            self.still_playing.append(False)
        self.room_name = room_manager.get_room_name(game.id)
        self.attack_cards = []
        self.defense_cards = []
        # TODO add seat position into database for statistical purposes - may also be useful for AI training
        random.shuffle(self.player_info)
        self.__acquire_session_ids()
        self.__initialize_game()
        self.transition_state(None, None, None)

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
        emit(events.INIT_GAME, (self.game.id, self.game.num_players, screen_names), room=self.room_name)
        self.deck = DurakDeck(NUM_PLAYERS_TO_LOWEST_CARD[self.game.num_players])
        self.hands = []
        for i in range(self.game.num_players):
            new_hand = []
            self.deck.draw_cards(game_constants.MIN_CARDS_PER_HAND, new_hand)
            self.hands.append(new_hand)
        self.trump_card = self.deck.draw_card()
        self.trump_suit = self.trump_card[0]
        self.__display_trump_suit()
        # we display the trump card and the UI automatically removes it when cards remaining == 0
        self.__display_trump_card()

    def __set_defense_index(self):
        self.defense_index = (self.attack_index + 1) % self.game.num_players

    def __set_drawing_index(self, initial):
        if initial:
            self.drawing_index = self.attack_index
        else:
            self.drawing_index = (self.drawing_index - 1) % self.game.num_players

    def __move_attack_and_defense(self):
        self.attack_index = (self.attack_index + 1) % self.game.num_players
        self.defense_index = (self.defense_index + 1) % self.game.num_players

    def __sort_and_display_updated_hands(self):
        hand_counts = []
        for i in range(self.game.num_players):
            print(self.hands[i])
            list.sort(self.hands[i], key=self.__hand_sorter)
            print(self.hands[i])
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

    def __send_on_attack_message(self):
        session_id = self.session_ids[self.attack_index]
        emit(events.UPDATE_USER_STATUS_MESSAGE, self.__construct_on_attack_message(), room=session_id)

        general_status_message = self.__construct_on_attack_status_message()
        for i in range(self.game.num_players):
            if i is self.attack_index:
                continue
            emit(events.UPDATE_USER_STATUS_MESSAGE, general_status_message, room=self.session_ids[i])

    def __send_on_defense_message(self):
        session_id = self.session_ids[self.defense_index]
        emit(events.UPDATE_USER_STATUS_MESSAGE, self.__construct_on_defense_message(), room=session_id)

        general_status_message = self.__construct_on_defense_status_message()
        for i in range(self.game.num_players):
            if i is self.defense_index:
                continue
            emit(events.UPDATE_USER_STATUS_MESSAGE, general_status_message, room=self.session_ids[i])

    def __enable_attack_ui(self):
        max_cards = min(len(self.hands[self.defense_index]), 4)
        emit(events.ON_ATTACK, max_cards, room=self.session_ids[self.attack_index])
        for i in range(self.game.num_players):
            if i is not self.attack_index:
                emit(events.DISABLE_GAME_BOARD, room=self.session_ids[i])
                emit(events.DISPLAY_CARDS_ON_TABLE, (self.attack_cards, self.defense_cards), room=self.session_ids[i])

    def __enable_defense_ui(self):
        emit(events.ON_DEFENSE, (self.attack_cards, self.defense_cards), room=self.session_ids[self.defense_index])
        for i in range(self.game.num_players):
            if i is not self.defense_index:
                emit(events.DISABLE_GAME_BOARD, room=self.session_ids[i])
                emit(events.DISPLAY_CARDS_ON_TABLE, (self.attack_cards, self.defense_cards), room=self.session_ids[i])

    def __get_screen_name(self, player_index):
        return self.player_info[player_index].screen_name

    def transition_state(self, response, attack_cards, defense_cards):
        if self.game_state is GameStates.INIT:
            self.__init_to_attack_transition()
        elif self.game_state is GameStates.ON_ATTACK and response == 'onAttackResponse':
            self.attack_cards = attack_cards
            self.defense_cards = defense_cards
            for card in attack_cards:
                self.__remove_card_from_deck(self.attack_index, card)
            self.__attack_to_defend_transition()
        elif self.game_state is GameStates.ON_DEFENSE and response == 'pickup':
            self.attack_cards = attack_cards
            self.defense_cards = defense_cards
            for card in defense_cards:
                self.__remove_card_from_deck(self.defense_index, card)
            self.__on_defense_to_pickup_transition()
        self.__update_game()

    def __init_to_attack_transition(self):
        """ Takes the game from INIT to the first move which is always an attack. """
        self.attack_index = random.randint(0, self.game.num_players - 1)
        self.adding_index = self.attack_index
        self.__set_defense_index()
        self.game_state = GameStates.ON_ATTACK
        self.__draw_attacking_label()
        self.__draw_defending_label()

    def __attack_to_defend_transition(self):
        """ Takes the game from ON_ATTACK to ON_DEFENSE -- the first opportunity to defend. """
        self.game_state = GameStates.ON_DEFENSE

    def __on_defense_to_pickup_transition(self):
        max_pairings = len(self.hands[self.defense_index])
        attack_cards_added = len(self.attack_cards)
        if (max_pairings == attack_cards_added) or (attack_cards_added == game_constants.MIN_CARDS_PER_HAND):
            for card in self.defense_cards + self.attack_cards:
                self.__add_card_to_deck(self.defense_index, card)
            self.__draw_cards_to_smaller_hands()

    def __update_game(self):
        if self.game_state is GameStates.ON_ATTACK:
            self.__display_cards_remaining()
            self.__display_cards_discarded()
            self.__sort_and_display_updated_hands()
            self.__send_on_attack_message()
            self.__enable_attack_ui()
        elif self.game_state is GameStates.ON_DEFENSE:
            self.__sort_and_display_updated_hands()
            self.__send_on_defense_message()
            self.__enable_defense_ui()

    def __construct_on_attack_message(self):
        on_defense_screen_name = self.__get_screen_name(self.defense_index)
        return 'YOUR TURN: Attacking ' + on_defense_screen_name

    def __construct_on_attack_status_message(self):
        on_attack_screen_name = self.__get_screen_name(self.attack_index)
        on_defense_screen_name = self.__get_screen_name(self.defense_index)
        return on_attack_screen_name + ' is attacking ' + on_defense_screen_name

    def __construct_on_defense_message(self):
        return 'YOUR TURN: Defending'

    def __construct_on_defense_status_message(self):
        on_defense_screen_name = self.__get_screen_name(self.defense_index)
        return on_defense_screen_name + ' is defending.'

    def __construct_on_adding_message(self):
        on_defense_screen_name = self.__get_screen_name(self.defense_index)
        return 'YOUR TURN: Adding to attack on ' + on_defense_screen_name

    def __construct_on_adding_status_message(self):
        on_defense_screen_name = self.__get_screen_name(self.defense_index)
        on_adding_screen_name = self.__get_screen_name(self.adding_index)
        return on_adding_screen_name + ' is adding to attack on ' + on_defense_screen_name

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

    def __remove_card_from_deck(self, player_index, card):
        self.hands[player_index].remove(card)

    def __add_card_to_deck(self, player_index, card):
        self.hands[player_index].append(card)

    def __draw_cards_to_smaller_hands(self):
        self.__set_drawing_index(True)
        while (self.deck.get_cards_remaining() > 0) and (self.drawing_index != self.defense_index):
            if len(self.hands[self.drawing_index]) < game_constants.MIN_CARDS_PER_HAND:
                self.deck.draw_cards(1, self.hands[self.drawing_index])
            else:
                self.__set_drawing_index(False)


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


def card_value_to_int(card_value_string):
    return CARD_VALUE_STRINGS_TO_INT[card_value_string]
