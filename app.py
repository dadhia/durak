from flask import Flask
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
import constants
import events
from util import get_game_room_name
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

from db_operations import cancel_game, get_user, insert_new_game, add_user_to_game, get_game, remove_user_from_game

lobby_games = {}


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
Creates a new game.  The game is entered into a database table of games with started = False and cancelled = False.
Also creates an entry into the games_played table, logging that this user has joined the game.
Finally, emits this data to the correct rooms.
"""
@socketio.on(events.NEW_GAME)
@login_required
def new_game(num_players):
    game = insert_new_game(current_user.id, int(num_players))
    add_user_to_game(current_user.id, game.id)
    lobby_games[game.id] = game
    game_room_name = get_game_room_name(game.id)
    leave_room(LOBBY_ROOM_NAME)
    join_room(game_room_name)

    emit(events.WAITING_FOR_PLAYERS, (num_players, '1', game.id, True))
    open_spots = int(num_players) - 1
    emit(events.ADD_LOBBY_GAME, (current_user.email, num_players, open_spots, game.id), room=LOBBY_ROOM_NAME)


"""
Called when a user logs into their console and connects with a websocket.
We will send them all available games for them to join.
"""
@socketio.on(events.CONNECT)
@login_required
def connect():
    send_all_lobby_games()
    join_room(LOBBY_ROOM_NAME)
    # TODO - are they already in a game?


"""
Called when a user disconnects from their console.
Remove any game that this user has created (should only be one) and broadcast this message to all users.
"""
@socketio.on(events.DISCONNECT)
@login_required
def disconnect():
    for game in lobby_games:
        if game.game_creator == current_user.id:
            delete_lobby_game(game)
            break


"""
Cancels a game that a user has created in the game lobby. Moves user from the room for that game into the lobby.
"""
@socketio.on(events.CANCEL_LOBBY_GAME)
@login_required
def cancel_lobby_game(game_id):
    game = lobby_games[game_id]
    delete_lobby_game(game)
    join_room(LOBBY_ROOM_NAME)
    send_all_lobby_games()


@socketio.on(events.JOIN_LOBBY_GAME)
@login_required
def join_lobby_game(game_id):
    success = add_user_to_game(current_user.id, game_id)
    if success:
        leave_room(LOBBY_ROOM_NAME)
        game = get_game(game_id)
        emit(events.WAITING_FOR_PLAYERS, (game.num_players, game.players_joined, game.id, False))
        emit(events.UPDATE_WAITING_MESSAGE, (game.num_players, game.players_joined, game_id), room=get_game_room_name(game_id))
        join_room(get_game_room_name(game_id))


@socketio.on(events.LEAVE_LOBBY_GAME)
@login_required
def leave_lobby_game(game_id):
    game = remove_user_from_game(current_user.id, game_id)
    lobby_games[game_id] = game
    room_name = get_game_room_name(game_id)
    leave_room(room_name)
    emit(events.UPDATE_WAITING_MESSAGE, (game.num_players, game.players_joined, game_id), room=room_name)
    emit(events.UPDATE_LOBBY_GAME, (game.num_players - game.players_joined, game.id), room=LOBBY_ROOM_NAME)
    send_all_lobby_games()
    join_room(LOBBY_ROOM_NAME)


"""
Deletes a game from the list of lobby games, removing the current_user from the room for that game and sending the
following two messages:
REMOVE_GAME_FROM_LOBBY to all users in the lobby.
GAME_CANCELLED to any user in that game's room.
"""
def delete_lobby_game(game):
    game.cancelled = True
    cancel_game(game.id)
    del lobby_games[game.id]
    leave_room(get_game_room_name(game.id))
    emit(events.REMOVE_GAME_FROM_LOBBY, game.id, room=LOBBY_ROOM_NAME)
    emit(events.GAME_CANCELLED, room=get_game_room_name(game.id))


def send_all_lobby_games():
    for game in lobby_games:
        game_creator = User.query.filter_by(id=game.game_creator).first()
        emit(events.ADD_LOBBY_GAME, (game_creator.email, game.num_players, game.players_joined, game.id))


"""
User loader for flask login manager.
"""
@login_manager.user_loader
def user_loader(user_id):
    return get_user(user_id)


"""
Redirects users to the main login screen if they attempt to access something without logging in.
"""
@login_manager.unauthorized_handler
def unauthorized():
    return redirect(url_for('index'))


if __name__ == '__main__':
    socketio.run(app)
