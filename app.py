from flask import Flask
from flask import redirect, url_for, render_template
from flask_bootstrap import Bootstrap
from flask_login import LoginManager
from flask_login import current_user, login_user, login_required, logout_user
from flask_socketio import SocketIO, send, emit
from forms.user_forms import LoginForm, RegistrationForm
from flask_sqlalchemy import SQLAlchemy
from passlib.hash import pbkdf2_sha256
from sqlalchemy.exc import IntegrityError
from constants import GENERIC_ERROR_MESSAGE, DUPLICATE_EMAIL, INVALID_LOGIN
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
db.create_all()


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
            print("here")
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
    logout_user()
    return redirect(url_for('index'))


@socketio.on('newGame')
@login_required
def new_game(num_players):
    print(current_user.email + " wants to make a game with " + num_players + " players.")
    emit('waitingForPlayers', (num_players, '1'))


@login_manager.user_loader
def user_loader(user_id):
    return User.query.filter(User.id == int(user_id)).first()


@login_manager.unauthorized_handler
def unauthorized():
    return redirect(url_for('index'))


if __name__ == '__main__':
    socketio.run(app)