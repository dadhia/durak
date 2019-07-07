"""
Allows the server to keep track of which connections belong to which rooms.
"""
from constants import GAME_ROOM_PREFIX, LOBBY_ROOM_NAME
from flask_socketio import leave_room, join_room

rooms_to_users = {}


def create_room(game_id):
    rooms_to_users[game_id] = []


def get_all_users(game_id):
    return rooms_to_users[game_id]


def delete_room(game_id):
    del rooms_to_users[game_id]


def get_room_name(game_id):
    return GAME_ROOM_PREFIX + str(game_id)


def get_lobby_name():
    return LOBBY_ROOM_NAME


def move_to_room(game_id, user_id):
    rooms_to_users[game_id].append(user_id)
    leave_room(LOBBY_ROOM_NAME)
    join_room(get_room_name(game_id))


def join_lobby():
    join_room(LOBBY_ROOM_NAME)


def rejoin_lobby(game_id, user_id):
    rooms_to_users[game_id].remove(user_id)
    leave_room(get_room_name(game_id))
    join_room(LOBBY_ROOM_NAME)

