var joinedGameID = 0;
var maxCardsToAddThisTurn = 0;
var openAttackSquare;
var cardSelected;
var trumpCard;
var cardsOnTable = new Set();
var digitsOnTable = new Set();
var cardsOnAttackSide;
var cardsOnDefenseSide;
var cardAdded;

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

function cardInHand(card) {
    return (card !== 'discard') && (card !== 'deck') && (card !== trumpCard) && !cardsOnTable.has(card);
}

function cardPlayable(card) {
    let cardDigit = getCardDigit(card);
    return (cardsOnTable.size === 0) || digitsOnTable.has(cardDigit);
}

function captureCard(options) {
    let card = options.target.id;
    if (cardInHand(card) && cardPlayable(card)) {
         cardSelected = card;
         console.log(cardSelected);
    }
}

function placeCardDuringAttackState(options) {
    if (cardSelected !== '') {
        let id = options.target.id;
        console.log(id);
        if (id === attackCardNames[openAttackSquare]) {
             drawCard(cardSelected, attackSquareLocations[openAttackSquare]);
             cardsOnAttackSide.push(cardSelected);
             digitsOnTable.add(getCardDigit(cardSelected));
             cardsOnTable.add(cardSelected);
             cardSelected = '';
             maxCardsToAddThisTurn--;
             cardAdded = true;
             if (maxCardsToAddThisTurn !== 0) {
                openAttackSquare++;
                openAttackSquares([openAttackSquare]);
                openDefenseSquares([openAttackSquare]);
             }
        }
    }
}

function canvasMouseClickHandler(options) {
    console.log('click!');
    console.log(options.target.type);
    if (options.target.type === 'image') {
        console.log('image');
        if (getGameBoardState() !== DISABLED_STATE) {
            console.log('not disabled');
            captureCard(options);
        }
    } else if (options.target.type === 'rect') {
        console.log('rect');
        if (getGameBoardState() === ON_ATTACK_STATE) {
            placeCardDuringAttackState(options);
        }
    }
}

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

    socket.on('initGame', function(gameID, numPlayers, screenNamesList) {
        console.log("Starting game with id = " + gameID);
        joinedGameID = gameID;
        gameView();
        prepareCanvas(numPlayers, screenNamesList);
        getCanvas().on('mouse:down', canvasMouseClickHandler);
        setAttackButtonVisibility(false);
        setDefenseButtonVisibility(false);
        setDoneButtonVisibility(false);
        setSlideButtonVisibility(false);
        setPickupButtonVisibility(false);
    });

    socket.on('displayHand', function(hand) {
       eraseCardsInHand();
       for (let i = 0; i < hand.length; i++) {
           drawCardInHand(hand[i], i);
       }
    });

    socket.on('displayCardsRemaining', function(numCards) {
        updateCardsRemaining(numCards);
        if (numCards === 0) {
            eraseDeck();
            eraseTrumpCard();
            trumpCard = '';
        } else if (numCards === 1) {
            eraseDeck();
        } else {
            drawDeck();
        }
    });

    socket.on('displayTrumpCard', function(card) {
        drawTrumpCard(card);
        trumpCard = card;
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

    socket.on('onAttack', function(maxCards) {
        console.log('moving to attack state');
        setGameBoardState(ON_ATTACK_STATE);
        console.log(getGameBoardState());

        setAttackButtonVisibility(0.5);
        closeAttackSquares([1, 2, 3, 4, 5]);
        closeDefenseSquares([1, 2, 3, 4, 5]);
        maxCardsToAddThisTurn = maxCards;
        openAttackSquare = 0;
        cardsOnTable.clear();
        digitsOnTable.clear();
        cardSelected = '';
        cardsOnAttackSide = [];
        cardsOnDefenseSide = [];
        cardAdded = false;
    });

    socket.on('disableGameBoard', function() {
        console.log('disabled state');
        setGameBoardState(DISABLED_STATE);
        console.log(getGameBoardState());
    });

    socket.on('displayCardsOnTable', function(attackCards, defenseCards) {
       console.log('displaying cards');
       for (let i = 0; i < attackCards.length; i++) {
           drawCard(attackCards[i], attackSquareLocations[i]);
       }
       for (let i = 0; i < defenseCards.length; i++) {
           drawCard(defenseCards[i], defenseSquareLocations[i]);
       }
    });

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

    $('#attackButton').on('click', function() {
        if (getGameBoardState() === ON_ATTACK_STATE) {
            if (cardAdded) {
                console.log('sending gameResponse');
                socket.emit('gameResponse', joinedGameID, 'onAttackResponse', cardsOnAttackSide, cardsOnDefenseSide);
            }
        }
    });
});