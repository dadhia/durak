let canvas;
let cardsRemainingText, cardsDiscardedText, attackingStatusText, defendingStatusText, addingStatusText, userStatusText;
let cards = {};
let digitMap = new Map([['0', 0], ['1', 1], ['2', 2], ['3', 3], ['4', 4], ['5', 5], ['6', 6], ['7', 7], ['8', 8],
    ['9', 9], ['10', 10], ['j', 11], ['q', 12], ['k', 13], ['a', 14]]);
let gameBoardState;
const DISABLED_STATE = 'DISABLED';
const ON_ATTACK_STATE = 'ON_ATTACK';
const ON_DEFENSE_STATE = 'ON_DEFENSE';
const ADDING_STATE = 'ADDING';
const DEFENDING_STATE = 'DEFENDING';
const DISCARD_PILE_NAME = 'discard';
const DRAW_PILE_NAME = 'deck';
const TRUMP_CARD_NAME = 'trump';

const deckLocation = generateLocation(520, 330);
const trumpLocation = generateLocation(570, 330);
const discardLocation= generateLocation(790, 330);
const firstCardLocation = generateLocation(80, 630);
const userStatusTextLocation = generateLocation(2, 500);
const chairLocations = [generateLocation(430, 95), generateLocation(675, 15), generateLocation(890, 95),
    generateLocation(890, 410), generateLocation(675, 505), generateLocation(430, 410)];
const usernameLocations = [generateLocation(280, 90), generateLocation(640, 10), generateLocation(960, 95),
    generateLocation(960, 410), generateLocation(640, 510), generateLocation(280, 410)];
const statusTextLocations = [generateLocation(280, 105), generateLocation(640, 25), generateLocation(960, 110),
    generateLocation(960, 425), generateLocation(640, 525), generateLocation(280, 425)];
const individualCardsRemainingLocations = [generateLocation(280, 120), generateLocation(640, 40), generateLocation(960, 125),
    generateLocation(960, 440), generateLocation(640, 540), generateLocation(640, 440)];
let attackSquareLocations = new Array(6);
let defenseSquareLocations = new Array(6);
for (let i = 0; i < 6; i++) {
    let leftCoordinate = 535 + (i * 60);
    attackSquareLocations[i] = generateLocation(leftCoordinate, 160);
    defenseSquareLocations[i] = generateLocation(leftCoordinate, 240);
}

const playerIndices = [[1, 4], [0, 2, 4], [0, 2, 3, 5], [0, 1, 2, 3, 5], [0, 1, 2, 3, 4, 5]];
let trumpCard;
let cardsDrawnInHand = new Set();
let cardsDrawnOnTable = new Set();
let generalGameCardStatuses = new Map([[DISCARD_PILE_NAME, false], [TRUMP_CARD_NAME, false], [DRAW_PILE_NAME, false]]);

let attackSquares = new Array(6);
let defenseSquares = new Array(6);
let individualCardsRemainingTextObjects;
let usernameTextObjects;
let chairCircleObjects;
let gamePlayed = false;

function generateBackgroundGraphics() {
    if (!gameHasBeenPlayed()) {
        let background = generateRect(generateLocation(0, 0), '#004C00', 1400, 600, String('background'));
        let handBackground = generateRect(generateLocation(0, 600), '#BE9B7B', 1400, 200, String('background'));
        let messageBackground = generateRect(generateLocation(0, 500), 'black', 400, 200, String('background'));
        let cardTable = generateEllipse(generateLocation(700, 300), 'black', '#BE9B7B', 250, 200);

        canvas.add(background, cardTable);
        canvas.add(messageBackground);
        canvas.add(handBackground);

        for (let i = 0; i < 6; i++) {
            attackSquares[i] = generateRect(attackSquareLocations[i], '#4C814C', 40, 56, getAttackSquareName(i));
            defenseSquares[i] = generateRect(defenseSquareLocations[i], '#4C814C', 40, 56, getDefenseSquareName(i));
        }
        for (let i = 0; i < 6; i++) {
            canvas.add(attackSquares[i], defenseSquares[i]);
        }

        let attackText = generateTextObject('Attack', generateLocation(680, 120), 20, '#A40B0B');
        let defenseText = generateTextObject('Defense', generateLocation(680, 300), 20, '#A40B0B');
        canvas.add(attackText, defenseText);

        let yourHandText = generateTextObject('Your Hand:', generateLocation(0, 600), 20, '#A40B0B');
        canvas.add(yourHandText);

        generateStatusTexts();
    }
}

function gameHasBeenPlayed() {
    return gamePlayed;
}

function setGameHasBeenPlayed(value) {
    gamePlayed = value;
}

/**
 * Generates four different text objects: labels for attacking, defending, and adding as well as a user status text
 * which provides generic info on the current move being played.
 */
function generateStatusTexts() {
    attackingStatusText = generateTextObject('Attacking', generateLocation(0,0), 12, '#FBA92E');
    defendingStatusText = generateTextObject('Defending', generateLocation(0, 0), 12, '#FBA92E');
    addingStatusText = generateTextObject('Adding', generateLocation(0, 0), 12, '#FBA92E');
    userStatusText = userStatusText = generateTextObject('', userStatusTextLocation, 15, 'white');
    canvas.add(userStatusText);
    cardsRemainingText = generateTextObject('Cards Remaining: 00', generateLocation(510, 390), 12, '#A40B0B');
    canvas.add(cardsRemainingText);
    cardsDiscardedText = generateTextObject('Cards Discarded: 00', generateLocation(750, 390), 12, '#A40B0B');
    canvas.add(cardsDiscardedText);
}

function updateUserStatusText(text) {
    userStatusText.text = text;
}

function getAttackSquareName(squareIndex) {
    return 'attack' + squareIndex
}

function getDefenseSquareName(squareIndex) {
    return 'defense' + squareIndex
}

function generateUsernameTexts(usernames) {
    individualCardsRemainingTextObjects = [];
    usernameTextObjects = [];
    let numPlayers = usernames.length;
    for (let i = 0; i < numPlayers; i++) {
        const location = usernameLocations[playerIndices[numPlayers-2][i]];
        const textObject = generateTextObject(usernames[i], location, 12, '#f4f6f8');
        canvas.add(textObject);
        usernameTextObjects.push(textObject);

        const cardsRemainingLocation = individualCardsRemainingLocations[playerIndices[numPlayers-2][i]];
        let cardsInHandTextObject = generateTextObject('Cards In Hand: 0', cardsRemainingLocation, 12, '#C6E2FF');

        canvas.add(cardsInHandTextObject);
        individualCardsRemainingTextObjects.push(cardsInHandTextObject);
    }
}

function drawAttacking(numPlayers, playerNo) {
    attackingStatusText.set(statusTextLocations[playerIndices[numPlayers-2][playerNo]]);
    canvas.add(attackingStatusText);
}

function drawDefending(numPlayers, playerNo) {
    defendingStatusText.set(statusTextLocations[playerIndices[numPlayers-2][playerNo]]);
    canvas.add(defendingStatusText);
}

function drawAdding(numPlayers, playerNo) {
    addingStatusText.set(statusTextLocations[playerIndices[numPlayers-2][playerNo]]);
    canvas.add(addingStatusText);
}

function eraseAttacking() {
    canvas.remove(attackingStatusText);
}

function eraseDefending() {
    canvas.remove(defendingStatusText);
}

function eraseAdding() {
    canvas.remove(addingStatusText);
}

function drawTrumpSuitText(suit) {
    const text = generateTextObject('Trump Suit: ' + suit, generateLocation(510, 415), 12, '#A40B0B');
    canvas.add(text);
}

function generateChairs(numPlayers) {
    chairCircleObjects = [];
    for (let i = 0; i < numPlayers; i++) {
        const location = chairLocations[playerIndices[numPlayers-2][i]];
        const chair = generateCircle(location, '#A40B0B', 40);
        canvas.add(chair);
        chairCircleObjects.push(chair);
    }
}

function generateLocation(left, top) {
    return {left: left, top: top};
}

function generateCircle(location, fill, radius) {
    return new fabric.Circle({
        left: location.left,
        top: location.top,
        fill: fill,
        radius: radius,
        selectable: false
    })
}

function generateEllipse(location, stroke, fill, rx, ry) {
    return new fabric.Ellipse({
        left: location.left,
        top: location.top,
        strokeWidth: 1,
        stroke: stroke,
        fill: fill,
        selectable: false,
        originX: 'center',
        originY: 'center',
        rx: rx,
        ry: ry
    });
}

function generateRect(location, fill, width, height, id) {
    return new fabric.Rect({
        left: location.left,
        top: location.top,
        fill: fill,
        width: width,
        height: height,
        selectable: false,
        id: id
    });
}

function generateTextObject(text, location, fontSize, fill) {
    return new fabric.Text(text, {
        fontFamily: 'sans-serif',
        left: location.left,
        top: location.top,
        fontSize: fontSize,
        textAlign: 'left',
        fill: fill,
        selectable: false
    });
}

function updateCardsRemaining(numCards) {
    cardsRemainingText.text = `Cards Remaining: ${numCards}`;
    if ((numCards >= 2) && !generalGameCardStatuses.get(DRAW_PILE_NAME)) {
        drawDeck();
        generalGameCardStatuses.set(DRAW_PILE_NAME, true);
    } else if ((numCards === 1) && generalGameCardStatuses.get(DRAW_PILE_NAME)) {
        eraseDeck();
    } else if ((numCards === 0) && generalGameCardStatuses.get(TRUMP_CARD_NAME)) {
        eraseTrumpCard();
        if (generalGameCardStatuses.get(DRAW_PILE_NAME)) {
            eraseDeck();
        }
    }
}

function generateCardObject(id, cardObjectID) {
    let image = document.getElementById(`card-${id}`);
    let cardCanvasObject = new fabric.Image(image, {selectable: false, id:cardObjectID});
    cardCanvasObject.scale(0.3);
    return cardCanvasObject;
}

function pregenerateCardObjects() {
    let suits = 'cdhs';
    let royals = 'jqka';
    for (let suitIndex = 0; suitIndex < suits.length; suitIndex++) {
        for (let i = 2; i < 11; i ++) {
            let cardString = String(suits.charAt(suitIndex)) + String(i);
            cards[cardString] = generateCardObject(cardString, cardString);
        }
        for (let i = 0; i < royals.length; i++) {
            let cardString = String(suits.charAt(suitIndex)) + String(royals.charAt(i));
            cards[cardString] = generateCardObject(cardString, cardString);
        }
    }
    cards[DRAW_PILE_NAME] = generateCardObject('back', DRAW_PILE_NAME);
    cards[DISCARD_PILE_NAME] = generateCardObject('back', DISCARD_PILE_NAME);
}

function drawCard(card, location) {
    cards[card].set(location);
    canvas.add(cards[card]);
}

function eraseCard(card) {
    canvas.remove(cards[card]);
}

function drawTrumpCard(card) {
    trumpCard = generateCardObject(card, TRUMP_CARD_NAME);
    trumpCard.set(trumpLocation);
    canvas.add(trumpCard);
    generalGameCardStatuses.set(TRUMP_CARD_NAME, true);
}

function eraseTrumpCard() {
    canvas.remove(trumpCard);
    generalGameCardStatuses.set(TRUMP_CARD_NAME, false);
}

function drawDeck() {
    drawCard(DRAW_PILE_NAME, deckLocation);
    generalGameCardStatuses.set(DRAW_PILE_NAME, true);
}

function eraseDeck() {
    eraseCard(DRAW_PILE_NAME);
    generalGameCardStatuses.set(DRAW_PILE_NAME, false);
}

function drawDiscard() {
    drawCard(DISCARD_PILE_NAME, discardLocation);
    generalGameCardStatuses.set(DISCARD_PILE_NAME, true);
}

function eraseDiscard() {
    eraseCard(DISCARD_PILE_NAME);
    generalGameCardStatuses.set(DISCARD_PILE_NAME, false);
}

function updateCardsDiscarded(numCards) {
    cardsDiscardedText.text = `Cards Discarded: ${numCards}`;
    if ((numCards > 0) && !generalGameCardStatuses.get(DISCARD_PILE_NAME)) {
        drawDiscard();
        generalGameCardStatuses.set(DISCARD_PILE_NAME, true);
    }
}

function prepareCanvas(usernames) {
    if (!gameHasBeenPlayed()) {
        canvas = new fabric.Canvas('durak-table');
        canvas.hoverCursor = 'default';
        pregenerateCardObjects();
        generateBackgroundGraphics();
    } else {
        clearGameSpecificGraphics();
    }
    eraseGeneralGameCards();
    generateGameSpecificGraphics(usernames);
}

function drawCardInHand(card, position) {
    let left = firstCardLocation.left + (position * 42);
    let top = firstCardLocation.top;
    if (position > 25) {
        top += 60;
        left -= 26 * 42;
    }
    const location = generateLocation(left, top);
    drawCard(card, location);
    cardsDrawnInHand.add(cards[card]);
}

function drawCardOnTable(card, side, square) {
    if (side === 'attack') {
        drawCard(card, attackSquareLocations[square]);
    } else if (side === 'defense') {
        drawCard(card, defenseSquareLocations[square]);
    }
    cardsDrawnOnTable.add(cards[card]);
}

function eraseCardsOnTable() {
    for (let card of cardsDrawnOnTable) {
        canvas.remove(card);
    }
    cardsDrawnOnTable.clear();
}

function eraseCardsInHand() {
    for (let card of cardsDrawnInHand) {
        canvas.remove(card);
    }
    cardsDrawnInHand.clear();
}

function closeAttackSquares(squares) {
    for (let i = 0; i < squares.length; i++) {
        attackSquares[squares[i]].set({opacity: 0.4});
    }
}

function closeDefenseSquares(squares) {
    for (let i = 0; i < squares.length; i++) {
        defenseSquares[squares[i]].set({opacity: 0.4});
    }
}

function openDefenseSquares(squares) {
    for (let i = 0; i < squares.length; i++) {
        defenseSquares[squares[i]].set({opacity: 1.0});
    }
}

function openAttackSquares(squares) {
    for (let i = 0; i < squares.length; i++) {
        attackSquares[squares[i]].set({opacity: 1.0});
    }
}

function setAttackButtonVisibility(visible) {
    if (visible) {
        $('#attackButton').show();
    } else {
        $('#attackButton').hide();
    }
}

function setDefenseButtonVisibility(visible) {
    if (visible) {
        $('#defenseButton').show();
    } else {
        $('#defenseButton').hide();
    }
}

function setDoneButtonVisibility(visible) {
    if (visible) {
        $('#doneButton').show();
    } else {
        $('#doneButton').hide();
    }
}

function setSlideButtonVisibility(visible) {
    if (visible) {
        $('#slideButton').show();
    } else {
        $('#slideButton').hide();
    }
}

function setPickupButtonVisibility(visible) {
    if (visible) {
        $('#pickupButton').show();
    } else {
        $('#pickupButton').hide();
    }
}

function setGameBoardState(newGameBoardState) {
    gameBoardState = newGameBoardState;
}

function getGameBoardState() {
    return gameBoardState;
}

function getCanvas() {
    return canvas;
}

function getCardDigit(card) {
    return digitMap.get(card.substring(1));
}

function getCardSuit(card) {
    return card.substring(0, 1);
}

function updateCardsInHand(cardsPerHand) {
    for (let i = 0; i < cardsPerHand.length; i++) {
        if (cardsPerHand[i] > 0) {
            individualCardsRemainingTextObjects[i].text = `Cards in Hand: ${cardsPerHand[i]}`;
        } else {
            individualCardsRemainingTextObjects[i].text = 'Cards in Hand: 0 (Done)';
        }
    }
}

function clearGameSpecificGraphics() {
    for (let i = 0; i < chairCircleObjects.length; i++) {
        canvas.remove(chairCircleObjects[i]);
        canvas.remove(usernameTextObjects[i]);
        canvas.remove(individualCardsRemainingTextObjects[i])
    }
}

function generateGameSpecificGraphics(usernames) {
    generateChairs(usernames.length);
    generateUsernameTexts(usernames);
}

function eraseAllCardsOnTable() {
    eraseCardsOnTable();
    eraseCardsInHand();
}

function eraseGeneralGameCards() {
    if (generalGameCardStatuses.get(DRAW_PILE_NAME)) {
        eraseDeck();
    }
    if (generalGameCardStatuses.get(DISCARD_PILE_NAME)) {
        eraseDiscard();
    }
    if (generalGameCardStatuses.get(TRUMP_CARD_NAME)) {
        eraseTrumpCard();
    }
}