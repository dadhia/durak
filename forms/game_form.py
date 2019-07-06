from flask_wtf import FlaskForm
from wtforms import SelectField
from wtforms.validators import DataRequired


class NewGameForm(FlaskForm):
    num_players = SelectField('Number of Players:', validators=[DataRequired()], choices=['3', '4', '5', '6'])
