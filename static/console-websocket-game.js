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
                top: 220 + (i * 80),
                fill: '#4C814C',
                width: 40,
                height: 60,
                selectable: false
            });
            attackAndDefenseSquares[i * 6 + j] = square;
        }
    }
    var attackText = new fabric.Text('Attack', {
          fontFamily: 'sans-serif',
          left: 320,
          top: 190,
          fontSize: 20,
          textAlign: "left",
          fill:"#A40B0B"
    });
    var defenseText = new fabric.Text('Defense', {
        fontFamily: 'sans-serif',
        left: 320,
        top: 370,
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

$(document).ready(function() {
    var canvas = new fabric.Canvas('durak-table');
    generateBackgroundGraphics(canvas);
});