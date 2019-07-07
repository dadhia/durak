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

function addSingleLobbyGame(email, numPlayers, spotsRemaining, gameID, socket) {
    var buttonID = 'joinGame' + gameID;
    var nextRow = "<tr id='" + gameID + "'>" + "<td>" + email + "</td>" + "<td>" + numPlayers + "</td>" +
            "<td>" + spotsRemaining + "</td>" + "<td>" +
            '<button type="button" class="btn btn-primary" id="' +  buttonID + '">Join</button></td>';
    $('#openGamesTable').append(nextRow);
    $('#' + buttonID).on('click', function() {
        socket.emit('joinLobbyGame', gameID);
    });
}

$(document).ready(function() {
    var socket = io.connect('http://127.0.0.1:5000');

    socket.on('connect', function() {
        lobbyView();
        socket.emit('requestAllLobbyGames');
    });

    function returnToLobby() {
        clearLobbyGamesTable();
        lobbyView();
        socket.emit('requestAllLobbyGames');
    }

    socket.on('waitingForPlayers', function(numPlayers, playersJoined, gameID, abilityToCancel) {
        updateWaitingMessage(numPlayers, playersJoined, gameID);
        if (abilityToCancel) {
            $('#cancelOrLeaveGameButton').text('Cancel Game');
            $('#cancelOrLeaveGameButton').on('click', function() {
                socket.emit('cancelLobbyGame', gameID);
                returnToLobby();
            });
        } else {
            $('#cancelOrLeaveGameButton').text('Leave Game');
            $('#cancelOrLeaveGameButton').on('click', function() {
                socket.emit('leaveLobbyGame', gameID);
                returnToLobby();
            })
        }
        joinedGameView();
    });

    socket.on('updateWaitingMessage', updateWaitingMessage);

    socket.on('$gameCancelled', function() {
       clearLobbyGamesTable();
       lobbyView();
    });

    socket.on('addLobbyGame', function(email, numPlayers, spotsRemaining, gameID) {
        addSingleLobbyGame(email, numPlayers, spotsRemaining, gameID, socket);
    });

    socket.on('populateLobbyGames', function(lobbyGamesList) {
        for (let i = 0; i < lobbyGamesList.length; i++) {
            let game = lobbyGamesList[i];
            addSingleLobbyGame(game[0], game[1], game[2], game[3], socket);
        }
    });

    socket.on('removeLobbyGame', function(game_id) {
        $('table#openGamesTable tr#' + game_id).remove();
    });

    socket.on('updateLobbyGame', function(remaining_spots, game_id) {
        console.log("Time to update lobby game!");
        $('table#openGamesTable tr#' + game_id).find('td').eq(2).text(remaining_spots);
    });

    $('#newGameButton').on('click', function() {
        var numPlayers = $('#numPlayers input:radio:checked').val();
        socket.emit('newGame', numPlayers);
    });

    $('#logoutButton').on('click', function() {
        console.log('disconnecting!');
        socket.emit('disconnect');
    });
});