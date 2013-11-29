/**
 * spine-draw.js
 * Daniel Goldbach
 * 2013 November 29
 */

if(window.addEventListener) {
  window.addEventListener('load', function () {
    // var canvas, context, canvaso, ctx;
    var staticCanvas, drawCanvas;
    var staticCtx, drawCtx;

  // The active tool instance (always pencil here)
  var tool;


  function init () {
    // Find the canvas element.
    staticCanvas = document.getElementById('staticCanvas');
    staticCtx = staticCanvas.getContext('2d');
    draw_head_and_legs(staticCtx);

    // Add the temporary canvas.
    drawCanvas = document.getElementById('drawCanvas');
    drawCtx = drawCanvas.getContext('2d');
    drawCtx.lineWidth = 0.5;
    drawCtx.save();

    tool = new pencil();

    // Attach the mousedown, mousemove and mouseup event listeners.
    drawCanvas.addEventListener('mousedown', onDrawCanvasEvent, false);
    drawCanvas.addEventListener('mousemove', onDrawCanvasEvent, false);
    drawCanvas.addEventListener('mouseup',   onDrawCanvasEvent, false);

    var clearBtn = document.getElementById('clearBtn');
    var submitBtn = document.getElementById('submitBtn');
    var typeText = document.getElementById('typeText');
  }

  function draw_head_and_legs(ctx) {
    // Draw head
    ctx.beginPath();
    ctx.arc(150, 100, 40, 0, 2*Math.PI);
    ctx.stroke();

    // Draw legs
    ctx.moveTo(150, 320);
    ctx.lineTo(250, 320);
    ctx.lineTo(250, 420);
    ctx.stroke();
  }

  // The general-purpose event handler. This function just determines the mouse
  // position relative to the canvas element.
  function onDrawCanvasEvent(ev) {
    if (ev.layerX || ev.layerX == 0) { // Firefox
      ev._x = ev.layerX;
      ev._y = ev.layerY;
    } else if (ev.offsetX || ev.offsetX == 0) { // Opera
      ev._x = ev.offsetX;
      ev._y = ev.offsetY;
    }

    // Call the event handler of the tool.
    var func = tool[ev.type];
    if (func) {
      func(ev);
    }
  }

  function clearDrawCanvas(ev) {
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  }

  // The drawing pencil.
  var pencil = function () {
    var tool = this;
    this.started = false;

    // This is called when you start holding down the mouse button.
    // This starts the pencil drawing.
    this.mousedown = function (ev) {
      clearDrawCanvas(ev);
      drawCtx.beginPath();
      drawCtx.moveTo(ev._x, ev._y);
      tool.started = true;
    };

    // This function is called every time you move the mouse. Obviously, it only
    // draws if the tool.started state is set to true (when you are holding down
    // the mouse button).
    this.mousemove = function (ev) {
      if (tool.started) {
        drawCtx.lineTo(ev._x, ev._y);
        drawCtx.stroke();
      }
    };

    // This is called when you release the mouse button.
    this.mouseup = function (ev) {
      if (tool.started) {
        tool.mousemove(ev);
        tool.started = false;
        var type = processSpine();
        typeText.textContent = type;
      }
    };
  };

  /**
   * Image processing functions
   */

  CURVE_DELTA_THRESHOLD = 15;

  function processSpine() {
    var imgData = drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);
    var x_coords = [], delta_x = [];

    var monotonic = true;

    for (var y = 0; y < imgData.height; y++) {
      for (var x = 0; x < imgData.width; x++) {
        var rgba = getPixel(imgData, x, y);
        if (rgba[3] !== 0) {  // If non-transparent pixel
          x_coords.push(x);
          break;
        }
      }
    }

    var n = x_coords.length;

    // each pivot is {x:.., y:..} where y is the y coord from top of spine
    var pivots = [{x: x_coords[0], y: 0}];

    var step = 8;
    for (var i = 1; i < step; i++) {
      delta_x.push(0);
    }
    for (var i = step; i < n; i++) {
      delta_x.push(x_coords[i] - x_coords[i-step]);
      // console.log(x_coords[i] - x_coords[i-step]);
    }


    for (var i = step; i < n; i += step) {
      // Every time the sign of the curve changes, check to see if it's
      // substantial enough to count as a curve

      if ((delta_x[i] >= 0 && delta_x[i - step] < 0) || (delta_x[i] <= 0 && delta_x[i - step] > 0)) { // this is
        // If change of concavity
        if (Math.abs(pivots[pivots.length - 1].x - x_coords[i]) >= CURVE_DELTA_THRESHOLD) {
          // and noticeable change, then It's a curve!
          pivots.push({x: x_coords[i], y: i});
        }
      }
    }

    var output = '';
    // console.log(pivots);

    if (pivots.length === 1) {
      output += 'straight';
    } else if (pivots.length === 2) {
      switch (intervalIn(pivots[1].y, n)) {
        case 0: output += 'upper'; break;
        case 1: output += 'centered'; break;
        case 2: output += 'bottom'; break;
      }
      output += (pivots[1].x > pivots[0].x) ? ' right-curved' : ' left-curved';

    } else if (pivots.length === 3) {
      if (intervalIn(pivots[1].y, n) === 0 && intervalIn(pivots[2].y, n) === 2) {
        if (pivots[1].x > pivots[0].x && pivots[2].x < pivots[1].x) {
          output += 'inverted S-curved'
        } else {
          output += 'S-curved'
        }
      } else {
        switch (intervalIn(pivots[1].y, n)) {
          case 0: output += 'upper'; break;
          case 1: output += 'centered'; break;
          case 2: output += 'bottom'; break;
        }
        output += (pivots[1].x > pivots[0].x) ? ' right-curved' : ' left-curved';
      }
    } else {
      output += 'unrecognised'
    }
    return output + ' spine';
  }

  // Return [r,g,b,a] of pixel at (x,y)
  function getPixel(imageData, x, y) {
    var pixStart = 4 * (y * imageData.width + x);
    // console.log(pixStart)
    imageData.data[pixStart] = 255 - imageData.data[pixStart];

    return [imageData.data[pixStart], imageData.data[pixStart+1],
            imageData.data[pixStart+2], imageData.data[pixStart+3]];
  }

  // Returns 0,1,2 based on which one-thirdth interval of n i is in
  function intervalIn(i, n) {
    if      (i < n/3)   return 0;
    else if (i < 2*n/3) return 1;
    else                return 2;
  }




  init();

}, false); }
