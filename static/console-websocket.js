$(document).ready(function() {
    var socket = io.connect('http://127.0.0.1:5000');

    socket.on('connect', function() {
        $('#messageBlock').hide();
    });

    socket.on('waitingForPlayers', function(numPlayers, playersJoined, gameID, abilityToCancel) {
        $('#createGameBlock').hide();
        $('#loadingText').text("You have joined game #" + gameID + ". " + playersJoined + " players have " +
            "joined. Waiting for " + (numPlayers - playersJoined) + " more players to join.");
        $('#logoutWarning').text("If you logout, you will cancel this game!");
        if (abilityToCancel) {
            $('#cancelOrLeaveGameButton').text('Cancel Game');
            $('#cancelOrLeaveGameButton').on('click', function() {
                socket.emit('cancelLobbyGame', gameID);
            });
        } else {
            $('#cancelOrLeaveGameButton').text('Leave Game');
        }
        $('#messageBlock').show();
        $('#lobby').hide();
    });

    socket.on('addToOpenGamesTable', function(email, numPlayers, remainingSpots, showButton, gameID) {
        var buttonID = 'joinGame' + gameID;
        var nextRow = "<tr>" + "<td>" + email + "</td>" + "<td>" + numPlayers + "</td>" +
            "<td>" + remainingSpots + "</td>" + "<td>" +
            '<button type="button" class="btn btn-primary" id="' +  buttonID + '">Join</button></td>';
        $('#openGamesTable').append(nextRow);
        $('#' + buttonID).on('click', function() {
            socket.emit('joinGame', gameID);
        });
    });

    $('#newGameButton').on('click', function() {
        var numPlayers = $('#numPlayers input:radio:checked').val();
        socket.emit('newGame', numPlayers);
    });
});