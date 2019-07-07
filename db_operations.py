from app import db
from models.game import Game
from models.user import User


def cancel_game(game_id):
    game_to_cancel = Game.query.filter_by(id=game_id).first()
    game_to_cancel.cancelled = True
    db.session.commit()


def get_user(user_id):
    return User.query.filter(User.id == int(user_id)).first()
