function joinedGameView() {
    $('#messageBlock').show();
    $('#createGameBlock').hide();
    $('#lobby').hide();
}

function lobbyView() {
    $('#messageBlock').hide();
    $('#createGameBlock').show();
    $('#lobby').show();
}

function clearLobbyGamesTable() {
    $('#openGamesTable').find('tr:gt(0)').remove();
}

function updateWaitingMessage(numPlayers, playersJoined, gameID) {
    $('#loadingText').text("You have joined game #" + gameID + ". " + playersJoined + " players have " +
            "joined. Waiting for " + (numPlayers - playersJoined) + " more players to join.");
    $('#logoutWarning').text("If you logout, you will cancel this game!");
}

$(document).ready(function() {
    var socket = io.connect('http://127.0.0.1:5000');

    socket.on('connect', function() {
        lobbyView();
    });

    socket.on('waitingForPlayers', function(numPlayers, playersJoined, gameID, abilityToCancel) {
        updateWaitingMessage(numPlayers, playersJoined, gameID);
        if (abilityToCancel) {
            $('#cancelOrLeaveGameButton').text('Cancel Game');
            $('#cancelOrLeaveGameButton').on('click', function() {
                socket.emit('cancelLobbyGame', gameID);
                clearLobbyGamesTable();
                lobbyView();
            });
        } else {
            $('#cancelOrLeaveGameButton').text('Leave Game');
            $('#cancelOrLeaveGameButton').on('click', function() {
                socket.emit('leaveLobbyGame', gameID);
                clearLobbyGamesTable();
                lobbyView();
            })
        }
        joinedGameView();
    });

    socket.on('updateWaitingMessage', updateWaitingMessage);

    socket.on('addLobbyGame', function(email, numPlayers, remainingSpots, gameID) {
        var buttonID = 'joinGame' + gameID;
        var nextRow = "<tr id='" + gameID + "'>" + "<td>" + email + "</td>" + "<td>" + numPlayers + "</td>" +
            "<td>" + remainingSpots + "</td>" + "<td>" +
            '<button type="button" class="btn btn-primary" id="' +  buttonID + '">Join</button></td>';
        $('#openGamesTable').append(nextRow);
        $('#' + buttonID).on('click', function() {
            socket.emit('joinLobbyGame', gameID);
        });
    });

    socket.on('removeLobbyGame', function(game_id) {
        console.log("Attampting to remove " + game_id);
        $('table#openGamesTable tr#'+game_id).remove();
    });

    $('#newGameButton').on('click', function() {
        var numPlayers = $('#numPlayers input:radio:checked').val();
        socket.emit('newGame', numPlayers);
    });
});