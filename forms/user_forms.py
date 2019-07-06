from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField
from wtforms.validators import DataRequired, Email, Length


class RegistrationForm(FlaskForm):
    Email = StringField('Email', validators=[DataRequired(), Email(), Length(min=6, max=40)])
    Password = PasswordField('Password',
                             validators=[DataRequired(), Length(min=8, max=15)],
                             description='Minimum 8 characters.')
    submit = SubmitField('Create my Durak Profile')


class LoginForm(FlaskForm):
    email = StringField('Email', validators=[DataRequired(), Email()], render_kw={'placeholder': 'Email'})
    password = PasswordField('Password', validators=[DataRequired(), Length(min=6)],
                             render_kw={'placeholder': 'Password'})
    submit = SubmitField('Login')
