// @ts-check

/**
 * The world: dimensions, parallax layers, props.
 *
 * Kept separate from main.js so that offline tooling (tools/shots.html) can
 * render the exact same scene the game renders, without booting the game.
 */

export const W = 320;
export const H = 180;
export const GROUND_Y = 148;
export const LEVEL_W = 1800;

/** The bench. Authored in colour and drawn on the UNFILTERED canvas, so it
 *  keeps its red while the rest of the world is grey. */
export const BENCH = { x: 1520, y: GROUND_Y };

/** @param {CanvasRenderingContext2D} c @param {number} ox */
function drawHills(c, ox) {
  c.fillStyle = '#5c6f7a';
  for (let i = -1; i < 6; i++) {
    const x = i * 90 - (ox % 90);
    c.beginPath();
    c.moveTo(x, GROUND_Y);
    c.lineTo(x + 45, 96);
    c.lineTo(x + 90, GROUND_Y);
    c.closePath();
    c.fill();
  }
}

/** @param {CanvasRenderingContext2D} c @param {number} ox */
function drawBuildings(c, ox) {
  c.fillStyle = '#46505f';
  for (let i = -1; i < 10; i++) {
    const x = i * 70 - (ox % 70);
    const h = 34 + ((i * 37) % 30);
    c.fillRect(x, GROUND_Y - h, 46, h);
  }
}

/** @param {CanvasRenderingContext2D} c @param {number} ox */
function drawGround(c, ox) {
  c.fillStyle = '#6b6152';
  c.fillRect(0, GROUND_Y, W, H - GROUND_Y);

  c.fillStyle = '#5a5145';
  for (let i = 0; i < 60; i++) {
    c.fillRect(i * 61 - ox, GROUND_Y + 6 + ((i * 13) % 18), 9, 1);
  }

  // Dead trees. These get replaced by blossoming ones as colorLevel rises —
  // for now they are just bare.
  c.fillStyle = '#4a4038';
  for (let i = 0; i < 8; i++) {
    const x = 180 + i * 210 - ox;
    c.fillRect(x, GROUND_Y - 26, 3, 26);
    c.fillRect(x - 5, GROUND_Y - 24, 5, 2);
    c.fillRect(x + 3, GROUND_Y - 20, 6, 2);
  }
}

/** Back to front. Each is offset by camera.x * parallax. */
const LAYERS = [
  { parallax: 0.15, draw: drawHills },
  { parallax: 0.45, draw: drawBuildings },
  { parallax: 1.0, draw: drawGround },
];

/**
 * Draw everything that IS subject to the colour grade.
 * @param {CanvasRenderingContext2D} c
 * @param {number} cam camera.x
 */
export function drawWorld(c, cam) {
  c.fillStyle = '#8e9aa6'; // sky — zero parallax
  c.fillRect(0, 0, W, H);

  for (const layer of LAYERS) layer.draw(c, cam * layer.parallax);
}

/**
 * Draw everything that is EXEMPT from the grade. Currently just the bench.
 * @param {CanvasRenderingContext2D} c
 * @param {number} cam
 */
export function drawExempt(c, cam) {
  c.clearRect(0, 0, W, H);

  const x = Math.round(BENCH.x - cam);
  const y = BENCH.y;
  if (x < -40 || x > W + 40) return;

  c.fillStyle = '#c8433f';
  c.fillRect(x - 14, y - 8, 28, 3);  // seat
  c.fillRect(x - 14, y - 15, 28, 2); // back
  c.fillStyle = '#96322f';
  c.fillRect(x - 12, y - 5, 2, 5);   // legs
  c.fillRect(x + 10, y - 5, 2, 5);
  c.fillRect(x - 12, y - 15, 2, 8);
  c.fillRect(x + 10, y - 15, 2, 8);
}

/**
 * @param {CanvasRenderingContext2D} c
 * @param {number} x screen x
 * @param {number} y baseline
 * @param {string} fill
 */
export function drawActor(c, x, y, fill) {
  if (x < -20 || x > W + 20) return;
  c.fillStyle = fill;
  c.fillRect(Math.round(x) - 4, Math.round(y) - 18, 8, 18);
}
