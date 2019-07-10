var remainingCardsDeck;
var cardsRemainingText;

function generateBackgroundGraphics(canvas) {
    var background = new fabric.Rect({
        left: 0,
        top: 0,
        fill: '#004C00',
        width: 700,
        height: 600,
        selectable: false
    });
    var table = new fabric.Ellipse({
        left: 350,
        top: 300,
        strokeWidth: 1,
        stroke: 'black',
        fill: '#BE9B7B',
        selectable: false,
        originX: 'center',
        originY: 'center',
        rx: 250,
        ry: 200
    });
    var attackAndDefenseSquares = new Array(12);
    for (let i = 0; i < 2; i += 1) {
        for (let j = 0; j < 6; j += 1) {
            square = new fabric.Rect({
                left: 185 + (j * 60),
                top: 160 + (i * 80),
                fill: '#4C814C',
                width: 40,
                height: 56,
                selectable: false
            });
            attackAndDefenseSquares[i * 6 + j] = square;
        }
    }
    var attackText = new fabric.Text('Attack', {
          fontFamily: 'sans-serif',
          left: 320,
          top: 120,
          fontSize: 20,
          textAlign: "left",
          fill:"#A40B0B"
    });
    var defenseText = new fabric.Text('Defense', {
        fontFamily: 'sans-serif',
        left: 320,
        top: 300,
        fontSize: 20,
        textAlign: "left",
        fill:"#A40B0B"
    });

    canvas.add(background);
    canvas.add(table);
    for (let i = 0; i < 12; i += 1) {
        canvas.add(attackAndDefenseSquares[i]);
    }
    canvas.add(attackText, defenseText);
}

function generateChairs(canvas, num_players) {
    var chair1 = new fabric.Circle({
       radius: 40,  fill: '#A40B0B', left:325, top:15
    });
    var chair2 = new fabric.Circle({
        radius: 40, fill: '#A40B0B', left: 80, top: 95
    });
    var chair3 = new fabric.Circle({
        radius: 40, fill: '#A40B0B', left: 540, top: 95
    });

    var chair4 = new fabric.Circle({
        radius: 40, fill: '#A40B0B', left: 80, top: 410
    });
    var chair5 = new fabric.Circle({
        radius: 40, fill: '#A40B0B', left: 540, top: 410
    });
    var chair6 = new fabric.Circle({
        radius: 40, fill:'#A40B0B', left: 325, top: 505
    });
    canvas.add(chair1);
    canvas.add(chair2);
    canvas.add(chair3);
    canvas.add(chair4);
    canvas.add(chair5);
    canvas.add(chair6);
}

function drawDeck(canvas) {
    var backImage = document.getElementById('card-back-image');
    remainingCardsDeck = new fabric.Image(backImage, {
        left: 200,
        top: 330

    });
    remainingCardsDeck.scale(0.3);
    canvas.add(remainingCardsDeck);
}

function drawCardsRemaining(canvas) {
    cardsRemainingText = new fabric.Text('Cards Remaining: 20', {
        fontFamily: 'sans-serif',
        left: 160,
        top: 390,
        fontSize: 12,
        textAlign: "left",
        fill:"#A40B0B"
    });
    canvas.add(cardsRemainingText);
}

function updateCardsRemaining(canvas, numCards) {
    cardsRemainingText.text = 'Cards Remaining: ' + numCards;
}

$(document).ready(function() {
    var canvas = new fabric.Canvas('durak-table');
    generateBackgroundGraphics(canvas);
    generateChairs(canvas, 1);

    var basicCard = document.getElementById('my-image');
    var imgInstance = new fabric.Image(basicCard, {
        left: 185,
        top: 220,
    });
    imgInstance.scale(0.3);
    canvas.add(imgInstance);
    drawDeck(canvas);
    drawCardsRemaining(canvas);
    updateCardsRemaining(canvas, 10);
});