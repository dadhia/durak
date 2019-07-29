let joinedGameID = 0;
let maxCardsToAddThisTurn = 0;
let cardSelected;
let trumpSuit;
let cardsOnTableUI = new Set();
let digitsOnTable = new Set();
let cardsOnAttackSide;
let cardsOnDefenseSide;
let cardAdded;
let requiredCardsToAddThisTurn = 0;
let attackOpenSquare, defenseOpenSquare;
let canSlide, canDefend;
const CARDS_PER_DIGIT = 4;

function joinedGameView() {
    $('#messageBlock').show();
    $('#createGameBlock').hide();
    $('#lobby').hide();
    $('#game').hide();
    $('#gameOver').hide();
}

function lobbyView() {
    $('#messageBlock').hide();
    $('#createGameBlock').show();
    $('#lobby').show();
    $('#game').hide();
    $('#gameOver').hide();
}

function gameView() {
    $('#messageBlock').hide();
    $('#createGameBlock').hide();
    $('#lobby').hide();
    $('#game').show();
    $('#gameOver').hide();
}

function gameOverView() {
    $('#messageBlock').hide();
    $('#createGameBlock').hide();
    $('#lobby').hide();
    $('#game').hide();
    $('#gameOver').show();
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
    let buttonID = 'joinGame' + gameID;
    let nextRow = "<tr id='" + gameID + "'>" + "<td>" + email + "</td>" + "<td>" + numPlayers + "</td>" +
            "<td>" + spotsRemaining + "</td>" + "<td>" +
            '<button type="button" class="btn btn-primary" id="' +  buttonID + '">Join</button></td>';
    $('#openGamesTable').append(nextRow);
    $('#' + buttonID).on('click', function() {
        socket.emit('joinLobbyGame', gameID);
    });
}

function cardInHand(card) {
    return (card !== 'discard') && (card !== 'deck') && (card !== trumpCard) && !cardsOnTableUI.has(card);
}

function cardPlayable(card) {
    let cardDigit = getCardDigit(card);
    return (cardsOnTableUI.size === 0) || digitsOnTable.has(cardDigit);
}

function captureCardOnAttack(options) {
    let card = options.target.id;
    if (cardInHand(card) && cardPlayable(card)) {
         cardSelected = card;
         console.log(cardSelected);
    }
}

function captureCardOnDefense(options) {
    let card = options.target.id;
    if (cardInHand(card)) {
        cardSelected = card;
        console.log(card);
    }
}

function isValidDefense(attackCard, defenseCard) {
    return ( (getCardDigit(defenseCard) > getCardDigit(attackCard))
        || ( (getCardSuit(defenseCard) === trumpSuit) && (getCardSuit(attackCard) !== trumpSuit)) );
}

function placeCardDuringAttackState(options) {
    if (cardSelected !== '') {
        let id = options.target.id;
        console.log(id);
        if (id === 'attack' + attackOpenSquare) {
             drawCard(cardSelected, attackSquareLocations[attackOpenSquare]);
             cardsOnAttackSide.push(cardSelected);
             digitsOnTable.add(getCardDigit(cardSelected));
             cardsOnTableUI.add(cardSelected);
             cardSelected = '';
             maxCardsToAddThisTurn--;
             cardAdded = true;
             if (maxCardsToAddThisTurn !== 0) {
                attackOpenSquare++;
                openAttackSquares([attackOpenSquare]);
             }
        }
    }
}

function placeCardDuringOnDefenseState(options) {
    if (cardSelected !== '') {
        let id = options.target.id;
        if ( (id === 'attack' + attackOpenSquare) && canSlide && digitsOnTable.has(getCardDigit(cardSelected)) ) {
            drawCard(cardSelected, attackSquareLocations[attackOpenSquare]);
            cardsOnAttackSide.push(cardSelected);
            cardsOnTableUI.add(cardSelected);
            cardSelected = '';
            canDefend = false;
            setSlideButtonVisibility(true);
            if (cardsOnAttackSide.length < CARDS_PER_DIGIT) {
                attackOpenSquare++;
                openAttackSquares([attackOpenSquare]);
            }
            closeDefenseSquares([defenseOpenSquare]);
        } else if ( (id === 'defense' + defenseOpenSquare) && canDefend ) {
            let attackCard = cardsOnAttackSide[defenseOpenSquare];
            if (isValidDefense(attackCard, cardSelected)) {
                drawCard(cardSelected, defenseSquareLocations[defenseOpenSquare]);
                cardsOnDefenseSide.add(getCardDigit(cardSelected));
                cardsOnTableUI.add(cardSelected);
                cardSelected = '';
                requiredCardsToAddThisTurn--;
                if (requiredCardsToAddThisTurn === 0) {
                    setDefenseButtonVisibility(true);
                } else {
                    defenseOpenSquare++;
                    openDefenseSquares([defenseOpenSquare]);
                }
            }
        }
    }
}

function canvasMouseClickHandler(options) {
    console.log('click!');
    console.log(options.target.type);
    if (options.target.type === 'image') {
        console.log('image');
        if (getGameBoardState() === ON_ATTACK_STATE) {
            captureCardOnAttack(options);
        } else if (getGameBoardState() === ON_DEFENSE_STATE) {
            captureCardOnDefense(options);
        }
    } else if (options.target.type === 'rect') {
        console.log('rect');
        if (getGameBoardState() === ON_ATTACK_STATE) {
            placeCardDuringAttackState(options);
        } else if (getGameBoardState() === ON_DEFENSE_STATE) {
            placeCardDuringOnDefenseState(options);
        }
    }
}

function hideAllGamePlayButtons() {
    setAttackButtonVisibility(false);
    setDefenseButtonVisibility(false);
    setDoneButtonVisibility(false);
    setSlideButtonVisibility(false);
    setPickupButtonVisibility(false);
}

function displayCardsOnTable(attackCards, defenseCards) {
    cardsOnAttackSide = attackCards;
    cardsOnDefenseSide = defenseCards;
    for (let i = 0; i < attackCards.length; i++) {
        openAttackSquares([i]);
        drawCard(attackCards[i], attackSquareLocations[i]);
    }
    for (let i = attackCards.length; i < 6; i++) {
        closeAttackSquares([i]);
    }
    for (let i = 0; i < defenseCards.length; i++) {
        openDefenseSquares([i]);
        drawCard(defenseCards[i], defenseSquareLocations[i]);
    }
    for (let i = attackCards.length; i < 6; i++) {
        closeDefenseSquares([i]);
    }
}

$(document).ready(function() {
    let socket = io.connect('http://127.0.0.1:5000');

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

    socket.on('returnToLobby', returnToLobby);
    socket.on('updateWaitingMessage', updateWaitingMessage);

    socket.on('gameCancelled', function(gameID) {
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
        hideAllGamePlayButtons();
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
        trumpSuit = getCardSuit(card);
    });

    socket.on('displayCardsDiscarded', function(numCards) {
        if (numCards > 0) {
            drawDiscard();
        } else {
            eraseDiscard();
        }
    });

    socket.on('displayTrumpSuit', drawTrumpSuitText);
    socket.on('updateUserStatusMessage', updateUserStatusText);
    socket.on('drawAttacking', drawAttacking);
    socket.on('eraseAttacking', eraseAttacking);
    socket.on('drawDefending', drawDefending);
    socket.on('eraseDefending', eraseDefending);
    socket.on('drawAdding', drawAdding);
    socket.on('eraseAdding', eraseAdding);
    socket.on('updateHandCounts', updateCardsInHand);

    socket.on('onAttack', function(maxCards) {
        setGameBoardState(ON_ATTACK_STATE);
        hideAllGamePlayButtons();
        setAttackButtonVisibility(true);
        openAttackSquares([0]);
        closeAttackSquares([1, 2, 3, 4, 5]);
        closeDefenseSquares([0, 1, 2, 3, 4, 5]);
        maxCardsToAddThisTurn = maxCards;
        attackOpenSquare = 0;
        cardsOnTableUI.clear();
        digitsOnTable.clear();
        cardSelected = '';
        cardsOnAttackSide = [];
        cardsOnDefenseSide = [];
        cardAdded = false;
    });

    socket.on('onDefense', function(attackCards, defenseCards) {
        setGameBoardState(ON_DEFENSE_STATE);
        console.log(getGameBoardState());
        hideAllGamePlayButtons();
        setPickupButtonVisibility(true);
        requiredCardsToAddThisTurn = attackCards.length;
        let allCards = attackCards.concat(defenseCards);
        cardsOnTableUI = new Set(allCards);
        digitsOnTable.clear();
        for (let i = 0; i < allCards.length; i++) {
            digitsOnTable.add(getCardDigit(allCards[i]));
        }
        cardSelected = '';
        canSlide = attackCards.length !== 4;
        if (canSlide) {
            attackOpenSquare = attackCards.length;
            openAttackSquares([attackOpenSquare]);
        }
        canDefend = true;
        defenseOpenSquare = 0;
        openDefenseSquares([defenseOpenSquare]);

        displayCardsOnTable(attackCards, defenseCards);
    });

    socket.on('disableGameBoard', function() {
        console.log('disabled state');
        setGameBoardState(DISABLED_STATE);
        console.log(getGameBoardState());
        hideAllGamePlayButtons();
    });

    socket.on('displayCardsOnTable', displayCardsOnTable);

    socket.on('gameOver', function(message) {
       $('#gameOverText').text = message;
       gameOverView();
    });

    $('#newGameButton').on('click', function() {
        let numPlayers = $('#numPlayers input:radio:checked').val();
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

    $('#returnToLobbyButton').on('click', returnToLobby);

    $('#attackButton').on('click', function() {
        if (getGameBoardState() === ON_ATTACK_STATE) {
            if (cardAdded) {
                console.log('sending gameResponse');
                socket.emit('gameResponse', joinedGameID, 'onAttackResponse', cardsOnAttackSide, cardsOnDefenseSide);
            }
        }
    });

    $('#pickupButton').on('click', function() {
        if (getGameBoardState() === ON_DEFENSE_STATE) {
            console.log('sending pickup gameResponse');
            socket.emit('gameResponse', joinedGameID, 'pickup', cardsOnAttackSide, cardsOnDefenseSide);
        }
    });

    $('#slideButton').on('click', function() {
        if (getGameBoardState() === ON_DEFENSE_STATE) {
            console.log('sending slide gameResponse');
            socket.emit('gameResponse', joinedGameID, 'slide', cardsOnAttackSide, cardsOnDefenseSide);
        }
    });
});