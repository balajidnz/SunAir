// @ts-check
import { W } from './world.js';

/**
 * Inside the house.
 *
 * A second, tiny "scene": no scrolling, no camera. Just the room, a wall of
 * photographs whose pictures never resolve, and the one frame that has come
 * apart.
 *
 * The room is a single generated background image (480x270, exactly the backing
 * store) rather than a tileset — there is no CC0 side-view domestic interior in
 * existence. Kenney's only indoor pack is top-down; LimeZu's has what we want
 * but forbids redistribution, which a public repo cannot honour.
 */

/** Where they stand: on the floorboards, near the front — but with a little
 *  board left in front of them, so they aren't pressed against the frame edge. */
export const FLOOR_Y = 244;

/**
 * The characters are drawn at DOUBLE size indoors.
 *
 * Not a fudge — it is what the room's own perspective demands. Those floorboards
 * recede hard, so the front of the room is close to the camera and the wall is
 * far away. Drawn at their outdoor size the pair look like dolls in a warehouse;
 * at 2x they read as two people standing near you, with the room behind them.
 *
 * It must be an INTEGER scale. 1.5x resamples pixel art and turns it to mush;
 * 2x is exact nearest-neighbour and stays crisp.
 */
export const CHAR_SCALE = 2;

/**
 * The broken frame, placed in the bare stretch of wall the room image leaves
 * empty in the middle. This is the only part of the room the game DRAWS, because
 * it is the only part that is interactive.
 */
export const BROKEN_FRAME = { x: W / 2, y: 64, w: 78, h: 66 };

/**
 * @param {CanvasRenderingContext2D} c
 * @param {HTMLImageElement} room
 * @param {number} bloom 0..1
 */
export function drawInterior(c, room, bloom) {
  c.drawImage(room, 0, 0);
  drawBrokenFrame(c, bloom);
}

/**
 * A 3x3 grid with one piece missing — the sliding-tile puzzle's target. Stands
 * in until the real puzzle lands (day 6), at which point the DOM grid takes over
 * and this becomes just the empty frame behind it.
 *
 * @param {CanvasRenderingContext2D} c
 * @param {number} bloom
 */
function drawBrokenFrame(c, bloom) {
  const f = BROKEN_FRAME;
  const x = Math.round(f.x - f.w / 2);
  const y = Math.round(f.y);

  // Moulding — gilt, so it reads as the one frame that matters.
  c.fillStyle = '#8f7119';
  c.fillRect(x - 4, y - 4, f.w + 8, f.h + 8);
  c.fillStyle = '#c9a227';
  c.fillRect(x - 3, y - 3, f.w + 6, f.h + 6);
  c.fillStyle = '#7a5f14';
  c.fillRect(x - 3, y + f.h + 1, f.w + 6, 2);

  const cols = 3;
  const rows = 3;
  const tw = Math.floor(f.w / cols);
  const th = Math.floor(f.h / rows);

  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const i = r * cols + col;

      if (i === 8) {
        c.fillStyle = '#241d1a'; // the gap
        c.fillRect(x + col * tw, y + r * th, tw, th);
        continue;
      }

      // Scrambled: the shade of each piece is deliberately out of order, so it
      // reads as a picture in pieces rather than a picture.
      const base = 118 + ((i * 53) % 88);
      const warm = Math.round(base * (0.78 + 0.22 * bloom));
      c.fillStyle = `rgb(${warm + 26},${warm},${Math.round(warm * 0.82)})`;
      c.fillRect(x + col * tw, y + r * th, tw - 1, th - 1);
    }
  }
}
