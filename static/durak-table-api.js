var canvas;
var cardsRemainingText;
var cardsDiscardedText;
var attackingStatusText, defendingStatusText, addingStatusText;
var userStatusText;
const userStatusTextLocation = generateLocation(2, 500);
var cards = {};
var gameBoardState;
let digitMap = new Map();
digitMap.set('0', 0);
digitMap.set('1', 1);
digitMap.set('2', 2);
digitMap.set('3', 3);
digitMap.set('4', 4);
digitMap.set('5', 5);
digitMap.set('6', 6);
digitMap.set('7', 7);
digitMap.set('8', 8);
digitMap.set('9', 9);
digitMap.set('10', 10);
digitMap.set('j', 11);
digitMap.set('q', 12);
digitMap.set('k', 13);
digitMap.set('a', 14);
const DISABLED_STATE = 'DISABLED';
const ON_ATTACK_STATE = 'ON_ATTACK';
const ON_DEFENSE_STATE = 'ON_DEFENSE';
const ADDING_STATE = 'ADDING';
const DEFENDING_STATE = 'DEFENDING';
const deckLocation = generateLocation(520, 330);
const trumpLocation = generateLocation(570, 330);
const discardLocation= generateLocation(790, 330);

const chairLocations = [generateLocation(430, 95), generateLocation(675, 15), generateLocation(890, 95),
    generateLocation(890, 410), generateLocation(675, 505), generateLocation(430, 410)];
const usernameLocations = [generateLocation(280, 90), generateLocation(640, 10), generateLocation(960, 95),
    generateLocation(960, 410), generateLocation(640, 510), generateLocation(280, 410)];
const statusTextLocations = [generateLocation(280, 105), generateLocation(640, 25), generateLocation(960, 110),
    generateLocation(960, 425), generateLocation(640, 525), generateLocation(280, 425)];
const individualCardsRemainingLocations = [generateLocation(280, 120), generateLocation(640, 40), generateLocation(960, 125),
    generateLocation(960, 440), generateLocation(640, 540), generateLocation(640, 440)];
const playerIndices = [[1, 4], [0, 2, 4], [0, 2, 3, 5], [0, 1, 2, 3, 5], [0, 1, 2, 3, 4, 5]];
var trumpCard;

var firstCardLocation = generateLocation(80, 630);

var attackSquareLocations = new Array(6);
var defenseSquareLocations = new Array(6);
for (let i = 0; i < 6; i++) {
    let leftCoordinate = 535 + (i * 60);
    attackSquareLocations[i] = generateLocation(leftCoordinate, 160);
    defenseSquareLocations[i] = generateLocation(leftCoordinate, 240);
}

var cardsDrawnInHand = new Set();
var cardsDrawnOnTable = new Set();

var objectToCard = {};

var attackSquares = new Array(6);
var defenseSquares = new Array(6);
var individualCardsRemainingTexts;
let deckFlag = false;
let eraseFlag = false;
let trumpFlag = false;

function generateBackgroundGraphics() {
    generatePlayersStatusTexts();
    var background = generateRect(generateLocation(0, 0), '#004C00', 1400, 600, String('background'));
    var handBackground = generateRect(generateLocation(0, 600), '#BE9B7B', 1400, 200, String('background'));
    var messageBackground = generateRect(generateLocation(0, 500), 'black', 400, 200, String('background'));
    var table = generateEllipse(generateLocation(700, 300), 'black', '#BE9B7B', 250, 200);
    for (let i = 0; i < 6; i++) {
        attackSquares[i] = generateRect(attackSquareLocations[i], '#4C814C', 40, 56, getAttackSquareName(i));
        defenseSquares[i] = generateRect(defenseSquareLocations[i], '#4C814C', 40, 56, getDefenseSquareName(i));
    }
    var attackText = generateTextObject('Attack', generateLocation(680, 120), 20, '#A40B0B');
    var defenseText = generateTextObject('Defense', generateLocation(680, 300), 20, '#A40B0B');
    var yourHandText = generateTextObject('Your Hand:', generateLocation(0, 600), 20, '#A40B0B');
    canvas.add(background, table);
    canvas.add(messageBackground);
    canvas.add(handBackground);
    for (let i = 0; i < 6; i++) {
        canvas.add(attackSquares[i], defenseSquares[i]);
    }
    canvas.add(attackText, defenseText);
    canvas.add(yourHandText);
}

function generateUserStatusText() {
    userStatusText = generateTextObject('', userStatusTextLocation, 15, 'white');
}

function updateUserStatusText(text) {
    userStatusText.text = text;
    canvas.add(userStatusText);
}

function getAttackSquareName(squareIndex) {
    return 'attack' + squareIndex
}

function getDefenseSquareName(squareIndex) {
    return 'defense' + squareIndex
}

function generateUsernameTexts(numPlayers, names) {
    individualCardsRemainingTexts = [];
    for (let i = 0; i < numPlayers; i++) {
        const location = usernameLocations[playerIndices[numPlayers-2][i]];
        const text = generateTextObject(names[i], location, 12, '#f4f6f8');
        canvas.add(text);
        const cardsRemainingLocation = individualCardsRemainingLocations[playerIndices[numPlayers-2][i]]
        let handCards = generateTextObject('Cards In Hand: 0', cardsRemainingLocation, 12, '#C6E2FF');
        canvas.add(handCards);
        individualCardsRemainingTexts.push(handCards);
    }
}

function generatePlayersStatusTexts() {
    attackingStatusText = generateTextObject('Attacking', generateLocation(0,0), 12, '#FBA92E');
    defendingStatusText = generateTextObject('Defending', generateLocation(0, 0), 12, '#FBA92E');
    addingStatusText = generateTextObject('Adding', generateLocation(0, 0), 12, '#FBA92E');
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
    for (let i = 0; i < numPlayers; i++) {
        const location = chairLocations[playerIndices[numPlayers-2][i]];
        const chair = generateCircle(location, '#A40B0B', 40);
        canvas.add(chair);
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

function drawStatusText() {
    cardsRemainingText = generateTextObject('Cards Remaining: 00', generateLocation(510, 390), 12, '#A40B0B');
    canvas.add(cardsRemainingText);
    cardsDiscardedText = generateTextObject('Cards Discarded: 00', generateLocation(750, 390), 12, '#A40B0B');
    canvas.add(cardsDiscardedText);
}

function updateCardsRemaining(numCards) {
    cardsRemainingText.text = `Cards Remaining: ${numCards}`;
    if ((numCards >= 2) && !deckFlag) {
        deckFlag = true;
        drawDeck();
    } else if ((numCards === 1) && !eraseFlag) {
        eraseDeck();
        eraseFlag = true;
    } else if ((numCards === 0) && !trumpFlag) {
        eraseTrumpCard();
        trumpFlag = true;
        if (!eraseFlag) {
            eraseDeck();
            eraseFlag = true;
        }
    }
}

function generateCardObject(id) {
    var image = document.getElementById(`card-${id}`);
    var cardCanvasObject = new fabric.Image(image, {selectable: false, id:id});
    cardCanvasObject.scale(0.3);
    return cardCanvasObject;
}

function pregenerateCardObjects() {
    let suits = 'cdhs';
    let royals = 'jqka';
    for (let suitIndex = 0; suitIndex < suits.length; suitIndex++) {
        for (let i = 2; i < 11; i ++) {
            let cardString = String(suits.charAt(suitIndex)) + String(i);
            cards[cardString] = generateCardObject(cardString);
            objectToCard[cards[cardString]] = cardString;
        }
        for (let i = 0; i < royals.length; i++) {
            let cardString = String(suits.charAt(suitIndex)) + String(royals.charAt(i));
            cards[cardString] = generateCardObject(cardString);
            objectToCard[cards[cardString]] = cardString;
        }
    }
    cards['deck'] = generateCardObject('back');
    cards['discard'] = generateCardObject('back');
    objectToCard[cards['discard']] = 'discard';
    objectToCard[cards['deck']] = 'deck';
}

function drawCard(card, location) {
    cards[card].set(location);
    canvas.add(cards[card]);
}

function eraseCard(card) {
    canvas.remove(cards[card]);
}

function drawTrumpCard(card) {
    drawCard(card, trumpLocation);
    trumpCard = card;
}

function drawDeck() {
    drawCard('deck', deckLocation);
}

function updateCardsDiscarded(numCards) {
    cardsDiscardedText.text = `Cards Discarded: ${numCards}`;
    if (numCards > 0) {
        drawCard('discard', discardLocation);
    } else {
        eraseCard('discard');
    }
}

function eraseDeck() {
    eraseCard('deck');
}

function eraseTrumpCard() {
    eraseCard(trumpCard);
}

function prepareCanvas(numPlayers, usernames) {
    canvas = new fabric.Canvas('durak-table');
    canvas.hoverCursor = 'default';
    pregenerateCardObjects();
    generateBackgroundGraphics();
    generateChairs(numPlayers);
    drawStatusText();
    generateUsernameTexts(numPlayers, usernames);
    generateUserStatusText();
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

function makeCardUnselectable(card) {
    cards[card].set({opacity: 0.4});
}

function makeCardSelectable(card) {
    cards[card].set({opacity: 1.0});
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
            individualCardsRemainingTexts[i].text = `Cards in Hand: ${cardsPerHand[i]}`;
        } else {
            individualCardsRemainingTexts[i].text = 'Cards in Hand: 0 (Done)';
        }
    }
}