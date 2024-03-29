let joinedGameID = 0;
let maxCardsToAddThisTurn = 0;
let cardSelected;
let trumpSuit;
let cardsOnTableUI = new Set();
let digitsOnTable = new Set();
let cardsOnAttackSide;
let cardsOnDefenseSide;
let requiredCardsToAddThisTurn = 0;
let attackOpenSquare, defenseOpenSquare;
let canSlide, canDefend;
const CARDS_PER_DIGIT = 4;
const CLICK_EVENT = 'click';
let cardsAddedThisTurn;

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
    let playersLeftToJoin = numPlayers - playersJoined;
    let loadingText = `You have joined game #${gameID}.  ${playersJoined} players havee joined.  Waiting for ` +
        `${playersLeftToJoin} more players to join.`;
    let logoutWarning = `If you logout you will cancel or leave this game!`;
    $('#loadingText').text(loadingText);
    $('#logoutWarning').text(logoutWarning);
}

function cardInHand(card) {
    return (card !== 'discard') && (card !== 'deck') && !cardsOnTableUI.has(card);
}

function cardPlayable(card) {
    let cardDigit = getCardDigit(card);
    return (cardsOnTableUI.size === 0) || digitsOnTable.has(cardDigit);
}

function captureCardOnAttack(card) {
    if (cardInHand(card) && cardPlayable(card)) {
         cardSelected = card;
    } else {
        cardSelected = '';
    }
}

function captureCardOnDefense(card) {
    if (cardInHand(card)) {
        cardSelected = card;
    } else {
        cardSelected = '';
    }
}

function isValidDefense(attackCard, defenseCard) {
    if (getCardSuit(defenseCard) === getCardSuit(attackCard)) {
        if (getCardDigit(defenseCard) > getCardDigit(attackCard)) {
            return true;
        }
    }
    return getCardSuit(defenseCard) === trumpSuit;
}

function canAddCardOnAttackSide() {
    return maxCardsToAddThisTurn > cardsAddedThisTurn.length;
}

function canAddCardOnDefenseSide() {
    return requiredCardsToAddThisTurn > cardsAddedThisTurn.length;
}

function openNextAttackSquare() {
    attackOpenSquare++;
    openAttackSquares([attackOpenSquare]);
}

function openNextDefenseSquare() {
    defenseOpenSquare++;
    openDefenseSquares([defenseOpenSquare]);
}

function addCardToAttack() {
    drawCardOnTable(cardSelected, 'attack', attackOpenSquare);
    cardsOnAttackSide.push(cardSelected);
    digitsOnTable.add(getCardDigit(cardSelected));
    cardsOnTableUI.add(cardSelected);
    cardsAddedThisTurn.push(cardSelected);
    cardSelected = '';
}

function addCardToDefense() {
    drawCardOnTable(cardSelected, 'defense', defenseOpenSquare);
    cardsOnDefenseSide.push(cardSelected);
    digitsOnTable.add(getCardDigit(cardSelected));
    cardsOnTableUI.add(cardSelected);
    cardsAddedThisTurn.push(cardSelected);
    cardSelected = '';
}

function placeCardDuringAttackState(square) {
    if ((square === getAttackSquareName(attackOpenSquare) && canAddCardOnAttackSide())) {
        addCardToAttack();
        if (maxCardsToAddThisTurn > cardsAddedThisTurn.length) {
            openNextAttackSquare();
        }
    }
}

function placeCardDuringOnDefenseState(square) {
    if ((square === getAttackSquareName(attackOpenSquare))
        && canSlide
        && digitsOnTable.has(getCardDigit(cardSelected))
        && canAddCardOnAttackSide())
    {
        addCardToAttack();
        canDefend = false;
        setSlideButtonVisibility(true);
        if (canAddCardOnAttackSide()) {
            openNextAttackSquare();
        }
        closeDefenseSquares([defenseOpenSquare]);
    } else if ((square === getDefenseSquareName(defenseOpenSquare))
        && canDefend
        && canAddCardOnDefenseSide())
    {
        let attackCard = cardsOnAttackSide[defenseOpenSquare];
        if (isValidDefense(attackCard, cardSelected)) {
            canSlide = false;
            addCardToDefense();
            closeAttackSquares([attackOpenSquare]);
            if (canAddCardOnDefenseSide()) {
                openNextDefenseSquare();
            } else {
                setDefenseButtonVisibility(true);
            }
        }
    }
}

function placeCardDuringDefendingState(square) {
    if (square === getDefenseSquareName(defenseOpenSquare) && canAddCardOnDefenseSide()) {
        if (isValidDefense(cardsOnAttackSide[defenseOpenSquare], cardSelected)) {
            addCardToDefense();
            if (canAddCardOnDefenseSide()) {
                openNextDefenseSquare();
            } else {
                setDefenseButtonVisibility(true);
            }
        }
    }
}

function canvasMouseClickHandler(options) {
    if (options.target.type === 'image') {
        let card = options.target.id;
        if ((getGameBoardState() === ON_ATTACK_STATE) || (getGameBoardState() === ADDING_STATE)) {
            captureCardOnAttack(card);
        } else if ((getGameBoardState() === ON_DEFENSE_STATE) || (getGameBoardState() === DEFENDING_STATE)) {
            captureCardOnDefense(card);
        }
    } else if (options.target.type === 'rect') {
        let square = options.target.id;
        if (cardSelected !== '') {
            if ((getGameBoardState() === ON_ATTACK_STATE) || (getGameBoardState() === ADDING_STATE)) {
                placeCardDuringAttackState(square);
            } else if (getGameBoardState() === ON_DEFENSE_STATE) {
                placeCardDuringOnDefenseState(square);
            } else if (getGameBoardState() === DEFENDING_STATE) {
                placeCardDuringDefendingState(square)
            }
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
    for (let i = 0; i < attackCards.length; i++) {
        openAttackSquares([i]);
        drawCardOnTable(attackCards[i], 'attack', i);
    }
    for (let i = attackCards.length; i < 6; i++) {
        closeAttackSquares([i]);
    }
    for (let i = 0; i < defenseCards.length; i++) {
        openDefenseSquares([i]);
        drawCardOnTable(defenseCards[i], 'defense', i);
    }
    for (let i = defenseCards.length; i < 6; i++) {
        closeDefenseSquares([i]);
    }
}

function populateCardsOnTableVariables(attackCards, defenseCards) {
    cardsOnAttackSide = attackCards;
    cardsOnDefenseSide = defenseCards;

    let allCards = attackCards.concat(defenseCards);
    cardsOnTableUI = new Set(allCards);
    digitsOnTable.clear();
    for (let i = 0; i < allCards.length; i++) {
        digitsOnTable.add(getCardDigit(allCards[i]));
    }
}

function clearCardsOnTableVariables() {
    cardsOnAttackSide = [];
    cardsOnDefenseSide = [];
    cardsOnTableUI.clear();
    digitsOnTable.clear();
}


$(document).ready(function() {
    var socket = io.connect('http://127.0.0.1:5000', {transports:['websocket']});

    socket.on(CONNECT_EVENT, function() {
        lobbyView();
        socket.emit(REQUEST_ALL_LOBBY_GAMES_EVENT);
    });

    function addSingleLobbyGame(email, numPlayers, spotsRemaining, gameID) {
        let buttonID = `joinGame${gameID}`;
        let nextRow = `<tr id='${gameID}'><td>${email}</td><td>${numPlayers}</td><td>${spotsRemaining}</td>` +
                `<td><button type="button" class="btn btn-primary" id="${buttonID}">Join</button></td>`;
        $('#openGamesTable').append(nextRow);
        $('#' + buttonID).on(CLICK_EVENT, function() {
            socket.emit(JOIN_LOBBY_GAME_EVENT, gameID);
        });
    }

    function returnToLobby() {
        clearLobbyGamesTable();
        lobbyView();
        socket.emit(REQUEST_ALL_LOBBY_GAMES_EVENT);
    }

    socket.on(WAITING_FOR_PLAYERS_EVENT, function(numPlayers, playersJoined, gameID, abilityToCancel) {
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

    socket.on(POPULATE_LOBBY_GAMES_EVENT, function(lobbyGamesList) {
        for (let i = 0; i < lobbyGamesList.length; i++) {
            let game = lobbyGamesList[i];
            addSingleLobbyGame(game[0], game[1], game[2], game[3]);
        }
        socket.emit(REJOIN_LOBBY_EVENT);
    });

    socket.on(REMOVE_LOBBY_GAME_EVENT, function(game_id) {
        $('table#openGamesTable tr#' + game_id).remove();
    });

    socket.on(UPDATE_LOBBY_GAME_EVENT, function(remaining_spots, game_id) {
        $('table#openGamesTable tr#' + game_id).find('td').eq(2).text(remaining_spots);
    });

    socket.on(INIT_GAME_EVENT, function(gameID, screenNamesList) {
        joinedGameID = gameID;
        gameView();
        prepareCanvas(screenNamesList);
        if (!gameHasBeenPlayed()) {
            getCanvas().on('mouse:down', canvasMouseClickHandler);
            setGameHasBeenPlayed(true);
        }
        hideAllGamePlayButtons();
    });

    socket.on(DISPLAY_HAND_EVENT, function(hand) {
       for (let i = 0; i < hand.length; i++) {
           drawCardInHand(hand[i], i);
       }
    });

    socket.on(DISPLAY_TRUMP_CARD_EVENT, function(card) {
        drawTrumpCard(card);
        trumpSuit = getCardSuit(card);
    });

    socket.on(DISPLAY_CARDS_REMAINING_EVENT, updateCardsRemaining);
    socket.on(DISPLAY_CARDS_DISCARDED_EVENT, updateCardsDiscarded);
    socket.on(RETURN_TO_LOBBY_EVENT, returnToLobby);
    socket.on(UPDATE_WAITING_MESSAGE_EVENT, updateWaitingMessage);
    socket.on(ADD_LOBBY_GAME_EVENT, addSingleLobbyGame);
    socket.on(DISPLAY_TRUMP_SUIT_EVENT, drawTrumpSuitText);
    socket.on(UPDATE_USER_STATUS_MESSAGE_EVENT, updateUserStatusText);
    socket.on(DRAW_ATTACKING_EVENT, drawAttacking);
    socket.on(ERASE_ATTACKING_EVENT, eraseAttacking);
    socket.on(DRAW_DEFENDING_EVENT, drawDefending);
    socket.on(ERASE_DEFENDING_EVENT, eraseDefending);
    socket.on(DRAW_ADDING_EVENT, drawAdding);
    socket.on(ERASE_ADDING_EVENT, eraseAdding);
    socket.on(UPDATE_HAND_COUNTS_EVENT, updateCardsInHand);

    socket.on(ERASE_EVENT, function() {
        eraseAllCardsOnTable();
        socket.emit(GAME_RESPONSE_EVENT, joinedGameID, DONE_ERASING_RESPONSE, [], [], []);
    });

    socket.on(ON_ATTACK_EVENT, function(maxCards) {
        setGameBoardState(ON_ATTACK_STATE);
        hideAllGamePlayButtons();
        setAttackButtonVisibility(true);
        clearCardsOnTableVariables();
        displayCardsOnTable([], []);
        maxCardsToAddThisTurn = maxCards;
        attackOpenSquare = 0;
        openAttackSquares([attackOpenSquare]);
        cardSelected = '';
        cardsAddedThisTurn = [];
    });

    socket.on(ON_DEFENSE_EVENT, function(attackCards, defenseCards, slideToHandSize) {
        setGameBoardState(ON_DEFENSE_STATE);
        hideAllGamePlayButtons();
        setPickupButtonVisibility(true);
        requiredCardsToAddThisTurn = attackCards.length;
        populateCardsOnTableVariables(attackCards, defenseCards);
        displayCardsOnTable(attackCards, defenseCards);
        cardSelected = '';
        maxCardsToAddThisTurn = Math.min(slideToHandSize, CARDS_PER_DIGIT) - attackCards.length;
        canSlide = (maxCardsToAddThisTurn > 0);
        if (canSlide) {
            attackOpenSquare = attackCards.length;
            openAttackSquares([attackOpenSquare]);
        }
        canDefend = true;
        defenseOpenSquare = 0;
        openDefenseSquares([defenseOpenSquare]);
        cardsAddedThisTurn = [];
    });

    socket.on(DEFENDING_EVENT, function(attackCards, defenseCards) {
        setGameBoardState(DEFENDING_STATE);
        hideAllGamePlayButtons();
        setPickupButtonVisibility(true);
        requiredCardsToAddThisTurn = attackCards.length - defenseCards.length;
        populateCardsOnTableVariables(attackCards, defenseCards);
        displayCardsOnTable(attackCards, defenseCards);
        cardSelected = '';
        defenseOpenSquare = defenseCards.length;
        openDefenseSquares([defenseOpenSquare]);
        cardsAddedThisTurn = [];
    });

    socket.on(ADDING_EVENT, function(attackCards, defenseCards, maxCards) {
        setGameBoardState(ADDING_STATE);
        hideAllGamePlayButtons();
        setDoneButtonVisibility(true);
        maxCardsToAddThisTurn = maxCards;
        populateCardsOnTableVariables(attackCards, defenseCards);
        displayCardsOnTable(attackCards, defenseCards);
        cardSelected = '';
        attackOpenSquare = attackCards.length;
        openAttackSquares([attackOpenSquare]);
        cardsAddedThisTurn = [];
    });

    socket.on(DISABLE_GAME_BOARD_EVENT, function(attack_cards, defense_cards) {
        populateCardsOnTableVariables(attack_cards, defense_cards);
        displayCardsOnTable(attack_cards, defense_cards);
        setGameBoardState(DISABLED_STATE);
        hideAllGamePlayButtons();
    });

    socket.on(GAME_OVER_EVENT, function(message) {
        $('#gameOverText').text(message);
        gameOverView();
    });

    $('#newGameButton').on(CLICK_EVENT, function() {
        let numPlayers = $('#numPlayers input:radio:checked').val();
        socket.emit(NEW_GAME_EVENT, numPlayers);
    });

    $('#leaveGameButton').on(CLICK_EVENT, function() {
        socket.emit(LEAVE_LOBBY_GAME_EVENT, joinedGameID);
    });

    $('#cancelGameButton').on(CLICK_EVENT, function() {
        socket.emit(CANCEL_LOBBY_GAME_EVENT, joinedGameID);
    });

    $('#returnToLobbyButton').on(CLICK_EVENT, function() {
        returnToLobby();
    });

    $('#attackButton').on(CLICK_EVENT, function() {
        if (getGameBoardState() === ON_ATTACK_STATE) {
            if (cardsAddedThisTurn.length > 0) {
                socket.emit(GAME_RESPONSE_EVENT, joinedGameID, ON_ATTACK_GAME_RESPONSE, cardsOnAttackSide,
                    cardsOnDefenseSide, cardsAddedThisTurn);
            }
        }
    });

    $('#pickupButton').on(CLICK_EVENT, function() {
        if ((getGameBoardState() === ON_DEFENSE_STATE) || (getGameBoardState() === DEFENDING_STATE)) {
            socket.emit(GAME_RESPONSE_EVENT, joinedGameID, PICKUP_GAME_RESPONSE, cardsOnAttackSide,
                cardsOnDefenseSide, cardsAddedThisTurn);
        }
    });

    $('#slideButton').on(CLICK_EVENT, function() {
        if (getGameBoardState() === ON_DEFENSE_STATE) {
            socket.emit(GAME_RESPONSE_EVENT, joinedGameID, SLIDE_GAME_RESPONSE, cardsOnAttackSide,
                cardsOnDefenseSide, cardsAddedThisTurn);
        }
    });

    $('#doneButton').on(CLICK_EVENT, function() {
        if (getGameBoardState() === ADDING_STATE) {
            socket.emit(GAME_RESPONSE_EVENT, joinedGameID, DONE_ADDING_GAME_RESPONSE, cardsOnAttackSide,
                cardsOnDefenseSide, cardsAddedThisTurn);
        }
    });

    $('#defenseButton').on(CLICK_EVENT, function() {
        if ((getGameBoardState() === ON_DEFENSE_STATE) || (getGameBoardState() === DEFENDING_STATE)) {
            socket.emit(GAME_RESPONSE_EVENT, joinedGameID, DEFEND_GAME_RESPONSE, cardsOnAttackSide,
                cardsOnDefenseSide, cardsAddedThisTurn);
        }
    });
});
