from flask import Flask, request, redirect, url_for, render_template
from flask_bootstrap import Bootstrap
from flask_login import LoginManager, current_user, login_user, login_required, logout_user
from flask_socketio import SocketIO, emit
from forms.user_forms import LoginForm, RegistrationForm
from passlib.hash import pbkdf2_sha256
from sqlalchemy.exc import IntegrityError
from constants import GENERIC_ERROR_MESSAGE, DUPLICATE_EMAIL, LOBBY_ROOM_NAME, GAME_OVER_DUE_TO_DISCONNECT
from connections import session_manager, room_manager
import events
import os
from database.db import db
from models.user import User
from models.game import Game
from models.game_played import GamePlayed
from models.loss import Loss
from database import db_operations
from game import game_management
from game.game_states import GameStates


login_manager = LoginManager()
socketio = SocketIO()
bootstrap = Bootstrap()
lobby_games = {}
in_progress_games = {}

app = Flask(__name__)


def create_app():
    app.config['SECRET_KEY'] = os.urandom(32)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://localhost/durak?user=&password='
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    login_manager.init_app(app)
    socketio.init_app(app)
    bootstrap.init_app(app)
    with app.app_context():
        db.create_all()


@app.route('/', methods=['GET'])
def index():
    """ Renders the home page. """
    return render_template('index.html',
                           login_form=LoginForm(),
                           registration_form=RegistrationForm())


@app.route('/register/', methods=['POST'])
def register():
    """ Handles a registration request from a client and verifies that all necessary information is provided. """
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
            print('integrity error')
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
    """ Handles a login request from a client. """
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
    """ Renders the console template. """
    return render_template('console.html', screen_name=current_user.screen_name)


@app.route('/console/logout/', methods=['GET'])
@login_required
def logout():
    """ Handles a logout request from a client. """
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
    room_manager.join_lobby(current_user.id)
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
    It will also check if the user is currently playing a game, assign a loss for that game to that user, and then
    return all remaining players from that game to a landing screen explaining what happened.
    """
    room_manager.leave_room_if_any(current_user.id)
    session_manager.remove_session_id(current_user.id)
    game = db_operations.get_game_user_has_joined(current_user.id)
    if game is not None:
        if game.id in lobby_games:
            game = lobby_games[game.id]
            if game.game_creator == current_user.id:
                db_operations.cancel_game(game.id)
                del lobby_games[game.id]
                emit(events.REMOVE_GAME_FROM_LOBBY, game.id, room=room_manager.get_lobby_name())
                emit(events.RETURN_TO_LOBBY, room=room_manager.get_room_name(game.id))
            else:
                db_operations.remove_user_from_game(current_user.id, game.id)
                emit(events.UPDATE_LOBBY_GAME, (game.num_players - game.players_joined, game.id),
                     room=room_manager.get_lobby_name())
                emit(events.UPDATE_WAITING_MESSAGE, (game.num_players, game.players_joined, game.id),
                     room=room_manager.get_room_name(game.id))
    else:
        game = db_operations.get_game_user_is_playing(current_user.id)
        if game is not None:
            if game.id in in_progress_games:
                db_operations.cancel_game(game.id)
                db_operations.insert_loss(current_user.id, game.id)
                del in_progress_games[game.id]
                message = GAME_OVER_DUE_TO_DISCONNECT % current_user.screen_name
                emit(events.GAME_OVER, message, room=room_manager.get_room_name(game.id))


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
    """
    Handles a request to join a lobby game.
    :param game_id: int
    """
    success = db_operations.add_user_to_game(current_user.id, game_id)
    if success:
        game = db_operations.get_game(game_id)
        if game.num_players == game.players_joined:
            lobby_games[game_id].started = True
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
    """
    Handles request from client to leave a game that it has joined.  Notifies all clients in the lobby that a new spot
    in that game is available and all clients who have joined that game that they are waiting on an additional player.
    Requests the client who left to return to lobby with a RETURN_TO_LOBBY event.
    """
    game = db_operations.remove_user_from_game(current_user.id, game_id)
    lobby_games[game_id] = game
    emit(events.UPDATE_LOBBY_GAME, (game.num_players - game.players_joined, game.id), room=LOBBY_ROOM_NAME)
    emit(events.UPDATE_WAITING_MESSAGE, (game.num_players, game.players_joined, game_id),
         room=room_manager.get_room_name(game_id))
    emit(events.RETURN_TO_LOBBY)


@socketio.on(events.REQUEST_ALL_LOBBY_GAMES)
@login_required
def request_all_lobby_games():
    """ Handles a request from client for all lobby games.  Sends a POPULATE_LOBBY_GAMES message back to client. """
    lobby_games_list = []
    for game in lobby_games.values():
        game_creator = User.query.filter_by(id=game.game_creator).first()
        open_spots = game.num_players - game.players_joined
        lobby_games_list.append((game_creator.screen_name, game.num_players, open_spots, game.id))
    emit(events.POPULATE_LOBBY_GAMES, lobby_games_list)


@socketio.on(events.REJOIN_LOBBY)
@login_required
def rejoin_lobby():
    """ Handles request from client to rejoin lobby. """
    room_manager.join_lobby(current_user.id)


@socketio.on(events.GAME_RESPONSE)
@login_required
def game_response_handler(game_id, response, attack_cards, defense_cards, cards_added_this_turn):
    if game_id in in_progress_games:
        in_progress_games[game_id].transition_state(response, attack_cards, defense_cards, cards_added_this_turn)
        if in_progress_games[game_id].game_state is GameStates.GAME_OVER:
            del in_progress_games[game_id]


@login_manager.user_loader
def user_loader(user_id):
    """ User loader for flask login manager. """
    return db_operations.get_user(user_id)


@login_manager.unauthorized_handler
def unauthorized():
    """ Redirects users to the main login screen if they attempt to access something without logging in. """
    return redirect(url_for('index'))


if __name__ == '__main__':
    create_app()
    socketio.run(app, host='0.0.0.0', port=5000)
