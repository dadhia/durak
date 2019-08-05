from database import db
from models.game import Game
from models.user import User
from models.game_played import GamePlayed
from models.loss import Loss
import logging


def get_user(user_id):
    """ Returns all user fields of the requested user_id. """
    return User.query.filter(User.id == int(user_id)).first()


def get_game(game_id):
    """ Returns all game fields of the requested game_id. """
    return Game.query.filter_by(id=game_id).first()


def insert_new_game(user_id, num_players):
    """ Adds a new game into the database. """
    game = Game(game_creator=user_id, num_players=num_players, started=False, cancelled=False, players_joined=0)
    db.session.add(game)
    db.session.commit()
    return game


def cancel_game(game_id):
    """ Sets value in database for cancelled field to True. """
    game_to_cancel = Game.query.filter_by(id=game_id).first()
    game_to_cancel.cancelled = True
    db.session.commit()


def set_game_started_true(game_id):
    """ Sets the started value for a game with game_id to True. """
    game = Game.query.filter_by(id=game_id).first()
    game.started = True
    db.session.commit()


def add_user_to_game(user_id, game_id):
    """ Adds a user to game association into the database (placed in the games_played table). """
    game = Game.query.filter_by(id=game_id).first()
    if game.num_players == game.players_joined:
        logging.error('Attempted add user to full game')
        return False
    else:
        game.players_joined += 1
        game_played = GamePlayed(user_id=user_id, game_id=game_id, join_position=game.players_joined)
        db.session.add(game_played)
        db.session.commit()
        return True


def remove_user_from_game(user_id, game_id):
    """ Deletes a user to game association from the games_played table. """
    game_played = GamePlayed.query.filter_by(user_id=user_id, game_id=game_id).first()
    game = Game.query.filter_by(id=game_id).first()
    game.players_joined -= 1
    db.session.delete(game_played)
    db.session.commit()
    return game


def get_game_user_has_joined(user_id):
    """ Gets all games a user has joined that have not yet been cancelled or started. """
    return db.session.query(Game.id)\
        .join(GamePlayed)\
        .filter(GamePlayed.game_id == Game.id)\
        .filter(GamePlayed.user_id == user_id)\
        .filter(Game.cancelled == False)\
        .filter(Game.started == False)\
        .first()


def get_players_in_game(game_id):
    """ Retrieves user_id, email, and join_position for each player in game with game_id. """
    return db.session.query(User.id, User.screen_name, GamePlayed.join_position)\
        .filter(GamePlayed.game_id == game_id)\
        .filter(User.id == GamePlayed.user_id)\
        .all()


def insert_loss(user_id, game_id):
    """ Inserts a loss into the database table for losses. """
    loss = Loss(user_id=user_id, game_id=game_id)
    db.session.add(loss)
    db.session.commit()


if __name__ == '__main__':
    """ Simply used for debugging purposes.  Will be deleted for final release. """
    get_game_user_has_joined(1)
