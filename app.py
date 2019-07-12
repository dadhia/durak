from flask import Flask, request, redirect, url_for, render_template
from flask_bootstrap import Bootstrap
from flask_login import LoginManager, current_user, login_user, login_required, logout_user
from flask_socketio import SocketIO, emit
from forms.user_forms import LoginForm, RegistrationForm
from flask_sqlalchemy import SQLAlchemy
from passlib.hash import pbkdf2_sha256
from sqlalchemy.exc import IntegrityError
from constants import GENERIC_ERROR_MESSAGE, DUPLICATE_EMAIL, LOBBY_ROOM_NAME
import room_manager
import session_manager
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
import game_management

lobby_games = {}
started_games = {}
in_progress_games = {}


@app.route('/game/', methods=['GET'])
def get_game():
    return render_template('console-game.html',
                           email='THIS IS A TEST ENVIRONMENT')


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
            new_user = User(email=form.Email.data, password=password_hash, screen_name=form.ScreenName.data)
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
    return render_template('console.html', screen_name=current_user.screen_name)


@app.route('/console/logout/', methods=['GET'])
@login_required
def logout():
    # TODO force a disconnect
    logout_user()
    return redirect(url_for('index'))


@socketio.on(events.CONNECT)
@login_required
def connect():
    """
    Called when a user logs into their console and connects with a websocket.
    We will send them all available games for them to join.
    """
    session_manager.add_session_id(current_user.id, request.sid)
    room_manager.join_lobby()
    # TODO - are they already in a game?


@socketio.on(events.NEW_GAME)
@login_required
def new_game(num_players):
    """
    Creates a new game.  The game is entered into a database table of games with started = False and cancelled = False.
    Also creates an entry into the games_played table, logging that this user has joined the game.
    Finally, emits this data to the correct rooms.
    """
    game = db_operations.insert_new_game(current_user.id, int(num_players))
    db_operations.add_user_to_game(current_user.id, game.id)
    lobby_games[game.id] = game

    room_manager.create_room(game.id)
    room_manager.move_to_room(game.id, current_user.id)

    emit(events.WAITING_FOR_PLAYERS, (num_players, 1, game.id, True))
    open_spots = int(num_players) - 1
    emit(events.ADD_LOBBY_GAME, (current_user.screen_name, num_players, open_spots, game.id),
         room=room_manager.get_lobby_name())


@socketio.on(events.DISCONNECT)
@login_required
def disconnect():
    """
    Called when a user disconnects from their console.
    Remove any game that this user has created (should only be one) and broadcast this message to all users.
    """
    game_id = db_operations.get_game_user_has_joined(current_user.id)
    print(game_id)
    if game_id is not None:
        game = lobby_games[game_id]
        if game.game_creator == current_user.id:
            game.cancelled = True
            db_operations.cancel_game(game.id)
            del lobby_games[game.id]
            emit(events.REMOVE_GAME_FROM_LOBBY, game.id, room=LOBBY_ROOM_NAME)
            emit(events.RETURN_TO_LOBBY, room=room_manager.get_room_name(game.id))
        else:
            db_operations.remove_user_from_game(current_user.id, game_id)
            emit(events.UPDATE_LOBBY_GAME, (game.num_players - game.players_joined, game.id), room=LOBBY_ROOM_NAME)
            emit(events.UPDATE_WAITING_MESSAGE, (game.num_players, game.players_joined, game_id),
                 room=room_manager.get_room_name(game_id))
    session_manager.remove_session_id(current_user.id)


@socketio.on(events.CANCEL_LOBBY_GAME)
@login_required
def cancel_lobby_game(game_id):
    """
    Cancels a game that a user has created in the game lobby. Moves user from the room for that game into the lobby.
    """
    game = lobby_games[game_id]
    game.cancelled = True
    db_operations.cancel_game(game.id)
    del lobby_games[game.id]

    emit(events.REMOVE_GAME_FROM_LOBBY, game.id, room=LOBBY_ROOM_NAME)
    emit(events.RETURN_TO_LOBBY, room=room_manager.get_room_name(game.id))


@socketio.on(events.JOIN_LOBBY_GAME)
@login_required
def join_lobby_game(game_id):
    print("Joining lobby game with game_id = " + str(game_id) + " and user_id = " + str(current_user.id))
    success = db_operations.add_user_to_game(current_user.id, game_id)
    if success:
        game = db_operations.get_game(game_id)
        if game.num_players == game.players_joined:
            lobby_games[game_id].started = True
            started_games[game_id] = lobby_games[game_id]
            del lobby_games[game_id]
            db_operations.set_game_started_true(game_id)
            room_manager.move_to_room(game_id, current_user.id)
            emit(events.REMOVE_GAME_FROM_LOBBY, game.id, room=room_manager.get_lobby_name())
            in_progress_games[game_id] = game_management.InProgressGame(game)
        else:
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
    emit(events.RETURN_TO_LOBBY)


@socketio.on(events.REQUEST_ALL_LOBBY_GAMES)
@login_required
def request_all_lobby_games():
    lobby_games_list = []
    for game in lobby_games.values():
        game_creator = User.query.filter_by(id=game.game_creator).first()
        open_spots = game.num_players - game.players_joined
        lobby_games_list.append((game_creator.screen_name, game.num_players, open_spots, game.id))
    emit(events.POPULATE_LOBBY_GAMES, lobby_games_list)


@socketio.on(events.REJOIN_LOBBY)
@login_required
def rejoin_lobby():
    print(str(current_user.id) + " is requesting to rejoin the lobby.")
    room_manager.rejoin_lobby(current_user.id)


@login_manager.user_loader
def user_loader(user_id):
    """ User loader for flask login manager. """
    return db_operations.get_user(user_id)


@login_manager.unauthorized_handler
def unauthorized():
    """ Redirects users to the main login screen if they attempt to access something without logging in. """
    return redirect(url_for('index'))


if __name__ == '__main__':
    socketio.run(app)
