from database.db import db


class Loss(db.Model):
    """ Keeps track of losers in each game. """
    __tablename__ = "losses"
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), primary_key=True)
    game_id = db.Column(db.Integer, db.ForeignKey('games.id'), primary_key=True)
