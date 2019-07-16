function joinedGameView() {
    $('#messageBlock').show();
    $('#createGameBlock').hide();
    $('#lobby').hide();
    $('#game').hide();
}

function lobbyView() {
    $('#messageBlock').hide();
    $('#createGameBlock').show();
    $('#lobby').show();
    $('#game').hide();
}

function gameView() {
    $('#messageBlock').hide();
    $('#createGameBlock').hide();
    $('#lobby').hide();
    $('#game').show();
}

function clearLobbyGamesTable() {
    $('#openGamesTable').find('tr:gt(0)').remove();
}

function updateWaitingMessage(numPlayers, playersJoined, gameID) {
    $('#loadingText').text("You have joined game #" + gameID + ". " + playersJoined + " players have " +
            "joined. Waiting for " + (numPlayers - playersJoined) + " more players to join.");
    $('#logoutWarning').text("If you logout, you will cancel or leave this game!");
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
var joinedGameID = 0;

$(document).ready(function() {
    var socket = io.connect('http://127.0.0.1:5000');

    socket.on('connect', function() {
        console.log("received connect message");
        lobbyView();
        console.log("sending a requestAllLobbyGamesRequest");
        socket.emit('requestAllLobbyGames');
    });

    function returnToLobby() {
        clearLobbyGamesTable();
        lobbyView();
        socket.emit('requestAllLobbyGames');
    }

    socket.on('waitingForPlayers', function(numPlayers, playersJoined, gameID, abilityToCancel) {
        console.log("waiting for players message received...");
        updateWaitingMessage(numPlayers, playersJoined, gameID);
        joinedGameID = gameID;
        if (abilityToCancel) {
            $('#leaveGameButton').hide();
            $('#cancelGameButton').show();
        } else {
            $('#leaveGameButton').show();
            $('#cancelGameButton').hide();
        }
        joinedGameView();
    });

    socket.on('returnToLobby', function() {
        console.log("return to lobby request received");
        returnToLobby();
    });

    socket.on('updateWaitingMessage', updateWaitingMessage);

    socket.on('$gameCancelled', function(gameID) {
       console.log("got a game cancelled message for game id = " + gameID);
       clearLobbyGamesTable();
       lobbyView();
       console.log("requesting to rejoin the lobby...");
       socket.send('rejoingLobby');
       console.log("requesting all lobby games...");
       socket.emit('requestAllLobbyGames');
    });

    socket.on('addLobbyGame', function(email, numPlayers, spotsRemaining, gameID) {
        console.log("Adding lobby game with ID = " + gameID + " and spots remaining = " + spotsRemaining);
        addSingleLobbyGame(email, numPlayers, spotsRemaining, gameID, socket);
    });

    socket.on('populateLobbyGames', function(lobbyGamesList) {
        console.log("Got populate lobby games message with " + lobbyGamesList.length + " games.");
        for (let i = 0; i < lobbyGamesList.length; i++) {
            let game = lobbyGamesList[i];
            addSingleLobbyGame(game[0], game[1], game[2], game[3], socket);
        }
        socket.emit('rejoinLobby');
    });

    socket.on('removeLobbyGame', function(game_id) {
        $('table#openGamesTable tr#' + game_id).remove();
    });

    socket.on('updateLobbyGame', function(remaining_spots, game_id) {
        console.log("Updating lobby game " + game_id + " with " + remaining_spots + " remaining spots");
        $('table#openGamesTable tr#' + game_id).find('td').eq(2).text(remaining_spots);
    });

    socket.on('initGame', function(game_id, numPlayers, screenNamesList) {
        console.log("Starting game with id = " + game_id);
        gameView();
        prepareCanvas(numPlayers, screenNamesList);
    });

    socket.on('displayHand', function(hand) {
       for (let i = 0; i < hand.length; i++) {
           drawCardInHand(hand[i], i);
       }
    });

    socket.on('displayCardsRemaining', function(numCards) {
        updateCardsRemaining(numCards);
        if (numCards == 0) {
            eraseDeck();
            eraseTrumpCard();
        } else if (numCards == 1) {
            eraseDeck();
        } else {
            drawDeck();
        }
    });

    socket.on('displayTrumpCard', function(card) {
        drawTrumpCard(card);
    });

    socket.on('displayCardsDiscarded', function(numCards) {
        if (numCards > 0) {
            drawDiscard();
        } else {
            eraseDiscard();
        }
    });

    socket.on('displayTrumpSuit', function(suit) {
        drawTrumpSuitText(suit);
    });

    socket.on('updateUserStatusMessage', function(text) {
        console.log(text);
        updateUserStatusText(text);
    });

    socket.on('drawAttacking', drawAttacking);
    socket.on('eraseAttacking', eraseAttacking);
    socket.on('drawDefending', drawDefending);
    socket.on('eraseDefending', eraseDefending);
    socket.on('drawAdding', drawAdding);
    socket.on('eraseAdding', eraseAdding);

    $('#newGameButton').on('click', function() {
        var numPlayers = $('#numPlayers input:radio:checked').val();
        socket.emit('newGame', numPlayers);
    });

    $('#leaveGameButton').on('click', function() {
        console.log('leaving lobby game ' + joinedGameID);
        socket.emit('leaveLobbyGame', joinedGameID);
    });

    $('#cancelGameButton').on('click', function() {
        console.log("cancelling lobby game " + joinedGameID);
        socket.emit('cancelLobbyGame', joinedGameID);
    });

});