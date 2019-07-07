from flask import Flask, request
from flask import redirect, url_for, render_template
from flask_bootstrap import Bootstrap
from flask_login import LoginManager
from flask_login import current_user, login_user, login_required, logout_user
from flask_socketio import SocketIO, emit
from flask_socketio import join_room, leave_room
from forms.user_forms import LoginForm, RegistrationForm
from flask_sqlalchemy import SQLAlchemy
from passlib.hash import pbkdf2_sha256
from sqlalchemy.exc import IntegrityError
from constants import GENERIC_ERROR_MESSAGE, DUPLICATE_EMAIL, LOBBY_ROOM_NAME
import room_manager
import events
import os

app = Flask(__name__)

login_manager = LoginManager()
login_manager.init_app(app)
socketio = SocketIO(app)

Bootstrap(app)

SECRET_KEY = os.urandom(32)
app.config['SECRET_KEY'] = SECRET_KEY

# initialize databases
app.config['SQLALCHEMY_DATABASE_URI'] = ''
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

from models.user import User
from models.game import Game
from models.game_played import GamePlayed
db.create_all()


import db_operations

lobby_games = {}
joined_games = {}


@app.route('/', methods=['GET'])
def index():
    if current_user.is_authenticated:
        return redirect(url_for('console'))
    return render_template('index.html',
                           login_form=LoginForm(),
                           registration_form=RegistrationForm())


@app.route('/register/', methods=['POST'])
def register():
    form = RegistrationForm()
    if form.validate_on_submit():
        password_hash = pbkdf2_sha256.hash(form.Password.data)
        try:
            new_user = User(email=form.Email.data, password=password_hash)
            db.session.add(new_user)
            db.session.commit()
            login_user(new_user)
            return redirect(url_for('console'))
        except IntegrityError:
            return render_template('index-with-errors.html',
                                   error_message=DUPLICATE_EMAIL,
                                   login_form=LoginForm(),
                                   registration_form=RegistrationForm())
    return render_template('index-with-errors.html',
                           error_message=GENERIC_ERROR_MESSAGE,
                           login_form=LoginForm(),
                           registration_form=RegistrationForm())


@app.route('/login/', methods=['POST'])
def login():
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter(User.email == form.email.data).first()
        if user is not None and pbkdf2_sha256.verify(form.password.data, user.password):
            login_user(user)
            return redirect(url_for('console'))
    return render_template('index-with-errors.html',
                           login_form=LoginForm(),
                           registration_form=RegistrationForm(),
                           error_message='Invalid username and password combination.')


@app.route('/console/', methods=['GET'])
@login_required
def console():
    return render_template('console.html', email=current_user.email)


@app.route('/console/logout/', methods=['GET'])
@login_required
def logout():
    # TODO force a disconnect
    logout_user()
    return redirect(url_for('index'))


"""
Called when a user logs into their console and connects with a websocket.
We will send them all available games for them to join.
"""
@socketio.on(events.CONNECT)
@login_required
def connect():
    room_manager.join_lobby()
    # TODO - are they already in a game?


"""
Creates a new game.  The game is entered into a database table of games with started = False and cancelled = False.
Also creates an entry into the games_played table, logging that this user has joined the game.
Finally, emits this data to the correct rooms.
"""
@socketio.on(events.NEW_GAME)
@login_required
def new_game(num_players):
    game = db_operations.insert_new_game(current_user.id, int(num_players))
    db_operations.add_user_to_game(current_user.id, game.id)
    lobby_games[game.id] = game

    room_manager.create_room(game.id)
    room_manager.move_to_room(game.id, current_user.id)

    emit(events.WAITING_FOR_PLAYERS, (num_players, 1, game.id, True))
    open_spots = int(num_players) - 1
    emit(events.ADD_LOBBY_GAME, (current_user.email, num_players, open_spots, game.id),
         room=room_manager.get_lobby_name())


"""
Called when a user disconnects from their console.
Remove any game that this user has created (should only be one) and broadcast this message to all users.
"""
@socketio.on(events.DISCONNECT)
@login_required
def disconnect():
    for game in lobby_games.values():
        if game.game_creator == current_user.id:
            delete_lobby_game(game)
            break
    # TODO handle the case where the user has simply joined a game but then logs out


"""
Cancels a game that a user has created in the game lobby. Moves user from the room for that game into the lobby.
"""
@socketio.on(events.CANCEL_LOBBY_GAME)
@login_required
def cancel_lobby_game(game_id):
    game = lobby_games[game_id]
    delete_lobby_game(game)


@socketio.on(events.JOIN_LOBBY_GAME)
@login_required
def join_lobby_game(game_id):
    success = db_operations.add_user_to_game(current_user.id, game_id)
    if success:
        game = db_operations.get_game(game_id)
        emit(events.UPDATE_WAITING_MESSAGE, (game.num_players, game.players_joined, game_id),
             room=room_manager.get_room_name(game_id))
        emit(events.WAITING_FOR_PLAYERS, (game.num_players, game.players_joined, game.id, False))
        room_manager.move_to_room(game_id, current_user.id)
        emit(events.UPDATE_LOBBY_GAME, (game.num_players-game.players_joined, game.id),
             room=room_manager.get_lobby_name())


@socketio.on(events.LEAVE_LOBBY_GAME)
@login_required
def leave_lobby_game(game_id):
    game = db_operations.remove_user_from_game(current_user.id, game_id)
    lobby_games[game_id] = game
    emit(events.UPDATE_LOBBY_GAME, (game.num_players - game.players_joined, game.id), room=LOBBY_ROOM_NAME)
    emit(events.UPDATE_WAITING_MESSAGE, (game.num_players, game.players_joined, game_id),
         room=room_manager.get_room_name(game_id))
    room_manager.rejoin_lobby(game_id, current_user.id)


@socketio.on(events.REQUEST_ALL_LOBBY_GAMES)
@login_required
def request_all_lobby_games():
    lobby_games_list = []
    for game in lobby_games.values():
        game_creator = User.query.filter_by(id=game.game_creator).first()
        open_spots = game.num_players - game.players_joined
        lobby_games_list.append((game_creator.email, game.num_players, open_spots, game.id))
    emit(events.POPULATE_LOBBY_GAMES, lobby_games_list)



"""
Deletes a game from the list of lobby games, removing the current_user from the room for that game and sending the
following two messages:
REMOVE_GAME_FROM_LOBBY to all users in the lobby.
GAME_CANCELLED to any user in that game's room.
"""
def delete_lobby_game(game):
    game.cancelled = True
    db_operations.cancel_game(game.id)
    del lobby_games[game.id]

    emit(events.REMOVE_GAME_FROM_LOBBY, game.id, room=LOBBY_ROOM_NAME)
    room_manager.rejoin_lobby(game.id, current_user.id)
    emit(events.GAME_CANCELLED, room=room_manager.get_room_name(game.id))


"""
User loader for flask login manager.
"""
@login_manager.user_loader
def user_loader(user_id):
    return db_operations.get_user(user_id)


"""
Redirects users to the main login screen if they attempt to access something without logging in.
"""
@login_manager.unauthorized_handler
def unauthorized():
    return redirect(url_for('index'))


if __name__ == '__main__':
    socketio.run(app)
