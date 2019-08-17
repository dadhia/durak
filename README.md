# durak

# Running the app
To run the source code please add a valid database URI to the app.py file.  Postgresql was used during development and you can follow the format provided by simply addding valid a username and password.

You should also modify the host (and port, if necessary) in static/console-websocket.js to the appropriate value.  127.0.0.1:5000 is suitable for development environments.

# Production

Version 1.0 is running on https://durak.devanadhia.com.  I encourage you to play and raise an issue if you find something to be broken or feel like an improvement can be made.

# Technologies Used

Database: Postgresql

Python: Flask (Flask-Login, Flask-SocketIO, Flask-Bootstrap)

Javascript/HTML/CSS: fabric.js, Bootstrap, SocketIO

Production: Nginx

# What is Durak?

Durak is a popular russian card game that I learned while travelling Europe with some friends.  My friend Vadim introduced us to the game.  It's quite addicting.

# How do I play?

There are many videos online.  You can also checkout the Durak wikipedia page.  This version is based on the rules my friend Vadim taught me, so there may be some discrepencies with official rules.

# What functionality does this web app have?

A login and signup screen.

A lobby where users can create and join games.

A custom UI built on canvas with fabric.js which allows for rendering of cards and various indicators showing game statuses (cards remaining, cards discarded, the names of other playing, etc.).


# Conclusion
Overall, this was a very fun thing to build and I hope to add to it in the future.  I welcome issues and pull requests.
