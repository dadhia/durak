from database.db import db

class GamePlayed(db.Model):
    """ Keeps track of every game a user has joined. """
    __tablename__ = 'games_played'
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), primary_key=True)
    game_id = db.Column(db.Integer, db.ForeignKey('games.id'), primary_key=True)
    join_position = db.Column(db.Integer, nullable=False)
