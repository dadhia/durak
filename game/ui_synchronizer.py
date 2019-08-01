from threading import Lock


class EraseTracker:
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
