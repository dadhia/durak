from threading import Lock


class EraseTracker:
    """
    Keeps track of erase cycles. Small events which clear a board every time a move has been made.  This is done to
    ensure that each card has moved to the proper location since the UI was only designed to support one instance of
    each kind of card anywhere on the game board.
    """
    def __init__(self, num_players):
        self.lock = Lock()
        self.num_players = num_players
        self.players_left_to_erase = self.num_players

    def start_new_erase_sequence(self):
        self.lock.acquire()
        self.players_left_to_erase = self.num_players
        self.lock.release()

    def add_erase(self):
        self.lock.acquire()
        self.players_left_to_erase -= 1
        return_value = self.players_left_to_erase == 0
        self.lock.release()
        return return_value
