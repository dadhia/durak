import session_manager, room_manager
import db_operations
from flask_socketio import emit
import events
import random
from constants import NUM_PLAYERS_TO_LOWEST_CARD


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
        self.__send_updated_hands()

    def __set_defense_index(self):
        self.defense_index = (self.attack_index + 1) % self.game.num_players

    def __move_attack_and_defense(self):
        self.attack_index = (self.attack_index + 1) % self.game.num_players
        self.defense_index = (self.defense_index + 1) % self.game.num_players

    def __send_updated_hands(self):
        print("sending updated hands")
        for i in range(self.game.num_players):
            print(self.hands[i])
            emit(events.DISPLAY_HAND, self.hands[i], room=self.session_ids[i])



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

    def __draw_card(self):
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
            card = self.__draw_card()
            if card is not None:
                hand.append(card)
