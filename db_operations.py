from app import db
from models.game import Game
from models.user import User
from models.game_played import GamePlayed
import logging


def cancel_game(game_id):
    game_to_cancel = Game.query.filter_by(id=game_id).first()
    game_to_cancel.cancelled = True
    db.session.commit()


def get_user(user_id):
    return User.query.filter(User.id == int(user_id)).first()


def get_game(game_id):
    return Game.query.filter_by(id=game_id).first()


def insert_new_game(user_id, num_players):
    game = Game(game_creator=user_id, num_players=num_players, started=False, cancelled=False,
                players_joined=0)
    db.session.add(game)
    db.session.commit()
    return game


def add_user_to_game(user_id, game_id):
    game = Game.query.filter_by(id=game_id).first()
    if game.num_players == game.players_joined:
        logging.error('Attempted add user to full game')
        return False
    else:
        game.players_joined += 1
        game_played = GamePlayed(user_id=user_id, game_id=game_id, join_position=game.players_joined)
        print(game_played)
        db.session.add(game_played)
        db.session.commit()
        return True


"""
Delete association between user and game.
"""
def remove_user_from_game(user_id, game_id):
    print("attempting to remove user_id = " + str(user_id) + " and game_id = " + str(game_id))
    game_played = GamePlayed.query.filter_by(user_id=user_id, game_id=game_id).first()
    print(game_played)
    game = Game.query.filter_by(id=game_id).first()
    game.players_joined -= 1
    db.session.delete(game_played)
    db.session.commit()
    return game


def get_game_user_has_joined(user_id):
    game = Game.query.join(GamePlayed)\
        .filter(GamePlayed.game_id == Game.id)\
        .filter(Game.cancelled == False)\
        .filter(Game.started == False)\
        .first()
    print(game)
    if game is not None:
        return game.id
    return None
