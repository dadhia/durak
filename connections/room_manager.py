from constants import GAME_ROOM_PREFIX, LOBBY_ROOM_NAME
from flask_socketio import leave_room, join_room

rooms_to_users = {}
users_to_rooms = {}


def create_room(game_id):
    rooms_to_users[game_id] = []


def get_all_users(game_id):
    return rooms_to_users[game_id]


def safe_delete_room(game_id):
    if len(rooms_to_users[game_id]) is 0:
        del rooms_to_users[game_id]


def get_room_name(game_id):
    return GAME_ROOM_PREFIX + str(game_id)


def get_lobby_name():
    return LOBBY_ROOM_NAME


def move_to_room(game_id, user_id):
    rooms_to_users[game_id].append(user_id)
    users_to_rooms[user_id] = game_id
    leave_room(LOBBY_ROOM_NAME)
    join_room(get_room_name(game_id))


def join_lobby():
    join_room(LOBBY_ROOM_NAME)


def rejoin_lobby(user_id):
    if user_id in users_to_rooms:
        game_id = users_to_rooms[user_id]
        rooms_to_users[game_id].remove(user_id)
        safe_delete_room(game_id)
        leave_room(get_room_name(game_id))
    join_room(LOBBY_ROOM_NAME)
