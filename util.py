from constants import GAME_ROOM_PREFIX


def get_game_room_name(game_id):
    return GAME_ROOM_PREFIX + str(game_id)
