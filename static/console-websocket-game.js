var canvas;
var cardsRemainingText;
var cardsDiscardedText;
var cards = {};
var deckLocation = generateLocation(170, 330);
var trumpLocation = generateLocation(220, 330);
var discardLocation= generateLocation(440, 330);
var attackSquareLocations = new Array(6);
var defenseSquareLocations = new Array(6);
var chairLocations = [generateLocation(430, 95), generateLocation(675, 15), generateLocation(890, 95),
    generateLocation(890, 410), generateLocation(675, 505), generateLocation(430, 410)];
var playerIndices = [[1, 4], [0, 2, 4], [0, 2, 3, 5], [0, 1, 2, 3, 5], [0, 1, 2, 3, 4, 5]];
var trumpCard;

var firstCardLocation = generateLocation(80, 630);

for (let i = 0; i < 6; i++) {
    let leftCoordinate = 535 + (i * 60);
    attackSquareLocations[i] = generateLocation(leftCoordinate, 160);
    defenseSquareLocations[i] = generateLocation(leftCoordinate, 240);
}

function generateBackgroundGraphics() {
    var background = generateRect(generateLocation(0, 0), '#004C00', 1400, 600);
    var handBackground = generateRect(generateLocation(0, 600), '#BE9B7B', 1400, 200);
    var table = generateEllipse(generateLocation(700, 300), 'black', '#BE9B7B', 250, 200);
    var attackSquares = new Array(6);
    var defenseSquares = new Array(6);
    for (let i = 0; i < 6; i++) {
        attackSquares[i] = generateRect(attackSquareLocations[i], '#4C814C', 40, 56);
        defenseSquares[i] = generateRect(defenseSquareLocations[i],'#4C814C', 40, 56);
    }
    var attackText = generateTextObject('Attack', generateLocation(680, 120), 20);
    var defenseText = generateTextObject('Defense', generateLocation(680, 300), 20);
    var yourHandText = generateTextObject('Your Hand:', generateLocation(0, 600), 20);
    canvas.add(background, table);
    canvas.add(handBackground);
    for (let i = 0; i < 6; i ++) {
        canvas.add(attackSquares[i], defenseSquares[i]);
    }
    canvas.add(attackText, defenseText);
    canvas.add(yourHandText);
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

function generateRect(location, fill, width, height) {
    return new fabric.Rect({
        left: location.left,
        top: location.top,
        fill: fill,
        width: width,
        height: height,
        selectable: false
    });
}

function generateTextObject(text, location, fontSize) {
    return new fabric.Text(text, {
        fontFamily: 'sans-serif',
        left: location.left,
        top: location.top,
        fontSize: fontSize,
        textAlign: 'left',
        fill:'#A40B0B',
        selectable: false
    });
}

function drawStatusText() {
    cardsRemainingText = generateTextObject('Cards Remaining: 00', generateLocation(510, 390), 12);
    canvas.add(cardsRemainingText);
    cardsDiscardedText = generateTextObject('Cards Discarded: 00', generateLocation(750, 390), 12);
    canvas.add(cardsDiscardedText);
}

function updateCardsRemaining(numCards) {
    cardsRemainingText.text = 'Cards Remaining: ' + numCards;
}

function generateCardObject(id) {
    var image = document.getElementById('card-' + id);
    var cardCanvasObject = new fabric.Image(image, {selectable: false});
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
        }
        for (let i = 0; i < royals.length; i++) {
            let cardString = String(suits.charAt(suitIndex)) + String(royals.charAt(i));
            cards[cardString] = generateCardObject(cardString);
        }
    }
    cards['deck'] = generateCardObject('back');
    cards['discard'] = generateCardObject('back');
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

function drawDiscard() {
    drawCard('discard', discardLocation);
}

function eraseDeck() {
    eraseCard('deck');
}

function eraseDiscard() {
    eraseCard('discard');
}

function eraseTrumpCard() {
    eraseCard(trumpCard);
}

function prepareCanvas(numPlayers) {
    canvas = new fabric.Canvas('durak-table');
    pregenerateCardObjects();
    generateBackgroundGraphics();
    generateChairs(numPlayers);
    drawStatusText();
}

function placeCardInHand(card, position) {
    let left = firstCardLocation.left + (position * 42);
    let top = firstCardLocation.top;
    if (position > 25) {
        top += 60;
        left -= 26 * 42;
    }
    const location = generateLocation(left, top);
    console.log(location);
    drawCard(card, location);
}

$(document).ready(function() {
    prepareCanvas(6);
    placeCardInHand('ca', 0);
    placeCardInHand('c2', 1);
    placeCardInHand('da', 10);
    placeCardInHand('d10', 25);
    placeCardInHand('d9', 26);
    placeCardInHand('d3', 27);
    placeCardInHand('d4', 51);
});