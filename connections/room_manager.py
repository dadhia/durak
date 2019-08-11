from constants import GAME_ROOM_PREFIX, LOBBY_ROOM_NAME
from flask_socketio import leave_room, join_room

user_locations = {}


def get_room_name(game_id):
    return GAME_ROOM_PREFIX + str(game_id)


def get_lobby_name():
    return LOBBY_ROOM_NAME


def join_lobby(user_id):
    move_to_room_with_name(user_id, get_lobby_name())


def move_to_room(game_id, user_id):
    move_to_room_with_name(user_id, get_room_name(game_id))


def move_to_room_with_name(user_id, room_name):
    if user_id in user_locations:
        leave_room(user_locations[user_id])
    user_locations[user_id] = room_name
    join_room(room_name)


def leave_room_if_any(user_id):
    if user_id in user_locations:
        leave_room(user_locations[user_id])
        del user_locations[user_id]
