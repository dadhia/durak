from database.db import db


class Game(db.Model):
    __tablename__ = 'games'
    id = db.Column(db.Integer, primary_key=True)
    game_creator = db.Column(db.Integer, db.ForeignKey('users.id'),  nullable=False)
    num_players = db.Column(db.Integer, nullable=False)
    started = db.Column(db.Boolean, nullable=False)
    cancelled = db.Column(db.Boolean, nullable=False)
    completed = db.Column(db.Boolean, nullable=False)
    players_joined = db.Column(db.Integer, nullable=False)

