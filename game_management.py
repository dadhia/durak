import session_manager, room_manager
import db_operations
from flask_socketio import emit
import events
import random
from constants import NUM_PLAYERS_TO_LOWEST_CARD, CARD_VALUE_STRINGS_TO_INT, SUIT_TO_FULL_NAME


class InProgressGame:
    def __init__(self, game):
        self.game = game
        self.player_info = db_operations.get_players_in_game(game.id)
        # TODO add seat position into database for statistical purposes
        random.shuffle(self.player_info)
        self.__acquire_session_ids()
        print(self.session_ids)
        print("initializing game...")
        self.__initialize_game()
        print("starting game...")
        self.__start_game()

    def __acquire_session_ids(self):
        self.session_ids = []
        for player in self.player_info:
            self.session_ids.append(session_manager.get_session_id(player.id))

    def __initialize_game(self):
        email_ids = []
        for player in self.player_info:
            email_ids.append(player.email)
        print(email_ids)
        emit(events.INIT_GAME,
             (self.game.id, self.game.num_players, email_ids),
             room=room_manager.get_room_name(self.game.id))

    def __start_game(self):
        self.attack_index = random.randint(0, self.game.num_players-1)
        self.__set_defense_index()
        self.deck = DurakDeck(NUM_PLAYERS_TO_LOWEST_CARD[self.game.num_players])
        self.hands = []
        for i in range(self.game.num_players):
            new_hand = []
            self.deck.draw_cards(6, new_hand)
            self.hands.append(new_hand)
        self.trump_card = self.deck.draw_card()
        self.trump_suit = self.trump_card[0]
        self.__sort_and_display_updated_hands()
        self.__display_trump_card()
        self.__display_trump_suit()

    def __set_defense_index(self):
        self.defense_index = (self.attack_index + 1) % self.game.num_players

    def __move_attack_and_defense(self):
        self.attack_index = (self.attack_index + 1) % self.game.num_players
        self.defense_index = (self.defense_index + 1) % self.game.num_players

    def __sort_and_display_updated_hands(self):
        for i in range(self.game.num_players):
            print(self.hands[i])
            list.sort(self.hands[i], key=self.__hand_sorter)
            print(self.hands[i])
            emit(events.DISPLAY_HAND, self.hands[i], room=self.session_ids[i])

    def __display_trump_card(self):
        emit(events.DISPLAY_TRUMP_CARD, self.trump_card, room=room_manager.get_room_name(self.game.id))

    def __display_cards_remaining(self):
        emit(events.DISPLAY_CARDS_REMAINING, self.deck.get_cards_remaining(),
             room=room_manager.get_room_name(self.game.id))

    def __display_cards_discarded(self):
        emit(events.DISPLAY_CARDS_DISCARDED, self.deck.get_cards_discarded(),
             room=room_manager.get_room_name(self.game.id))

    def __display_trump_suit(self):
        emit(events.DISPLAY_TRUMP_SUIT, self.trump_suit, room=room_manager.get_room_name(self.game.id))

    def __hand_sorter(self, card):
        card_suit = card[0]
        card_value = card[1:]
        sort_value = card_value_to_int(card_value)
        if card_suit == self.trump_suit:
            sort_value += 14
        return sort_value

    def __send_on_attack_message(self):
        on_defense_user_email = self.player_info[self.defense_index].email
        on_attack_user_id = self.player_info[self.attack_index].id
        emit(events.USER_ON_ATTACK, on_defense_user_email, room=session_manager.get_session_id(on_attack_user_id))


"""
This class manages the durak deck from construction, to drawing cards, to discarding cards.
"""
class DurakDeck:
    def __init__(self, lowest_card):
        print("making deck...")
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
        print("drawing cards...")
        for i in range(n):
            card = self.draw_card()
            if card is not None:
                hand.append(card)

    def draw_trump_card(self):
        trump_card = self.deck.pop()
        self.deck.insert(0, trump_card)
        return trump_card

    def get_cards_discarded(self):
        return self.cards_discarded


def card_value_to_int(card_value_string):
    return CARD_VALUE_STRINGS_TO_INT[card_value_string]