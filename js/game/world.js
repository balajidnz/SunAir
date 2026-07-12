// @ts-check
import { createAtlas } from '../engine/sprites.js';

/**
 * The world.
 *
 * Two mechanisms run at once, and they are NOT the same thing:
 *
 *   colorLevel (0..1) -> a CSS filter on the whole canvas. Removes SATURATION.
 *   bloom      (0..1) -> drawn here. ADDS CONTENT: grass, leaves, flowers.
 *
 * Day 1 taught us that desaturation alone just yields "a less grey world".
 * The world coming back to life has to grow things. Bloom is that.
 */

export const W = 480;
export const H = 270;
export const GROUND_Y = 200; // top of the ground surface

/**
 * Level length and landmark spacing.
 *
 * These were originally 3200 long with the bench 1000px past the house — about
 * 16 seconds of walking through empty ground with nothing to look at. Pulled in
 * so each leg is a beat, not a commute. At 62px/s the walks are now roughly
 * 11s / 13s / 9s.
 */
export const LEVEL_W = 2450;

const T = 18;  // Kenney tile size (tiles + farm)
const BG = 24; // Kenney background tile size

export const BENCH = { x: 2150, y: GROUND_Y };

// --- tile indices -----------------------------------------------------------
// Chosen by eye from tools/atlas.html, which labels every tile with its index.

// Kenney's ground tiles come as a CAPPED STRIP: [left-cap, middle, middle,
// right-cap]. Tiling all four repeats the caps and draws a seam every 4 tiles.
// Only the middles tile cleanly.
const GROUND_DEAD = [41, 42];   // dry tan-topped earth
const GROUND_ALIVE = [1, 2];    // grass-topped
const FILL = [121, 122];        // plain dirt, below the surface

// Verified in tools/zoom.html rather than guessed from the atlas thumbnail:
//   137 = trunk base with roots
//   117 = trunk with bare branch stubs  <- these two alone read as a dead tree
const TRUNK = 117;
const TRUNK_BASE = 137;

// The foliage is a self-contained 3x3 block with its own rounded outline.
// (Tile 16 is a standalone bush and 36/56/76 a 1-wide hedge — different shapes.
// Mixing pieces from all three is what produced the floating green box.)
const CANOPY = [
  [17, 18, 19],
  [37, 38, 39],
  [57, 58, 59],
];

/** Solid dirt below the surface row. Tiled sprites here show a seam on every
 *  tile border, so the mass of underground earth is flat colour instead —
 *  matched to the dirt inside Kenney's surface tile, or a band shows at the
 *  join. */
const DIRT = '#c87d55';
const DIRT_SPECK = '#a9613f';

const SHRUBS = [124, 125, 126];  // small green plants
const MUSHROOM = 128;

// Farm atlas (16 cols).
const SUNFLOWER = [20, 36]; // head, stem — 1 wide, 2 tall
const SPROUTS = [42, 43, 88, 89, 90, 91];

// Background panels: 2 tiles wide x 3 tall, in an 8-col sheet.
const BG_DEAD = [[4, 5], [12, 13], [20, 21]];  // barren orange desert
const BG_ALIVE = [[6, 7], [14, 15], [22, 23]]; // lush green

const SKY_DEAD = '#d9c3a1';
const SKY_ALIVE = '#8ecae6';

const CLOUD_DEAD = '#efe3cd';  // dull, heavy overcast
const CLOUD_ALIVE = '#ffffff'; // clean white
const CLOUD_SHADE_DEAD = '#d3c3a6';
const CLOUD_SHADE_ALIVE = '#d8ecf7';

/**
 * Deterministic pseudo-random in [0,1). No Math.random: the world must look
 * identical every run, or the captured shots are meaningless.
 * @param {number} n
 */
function rand(n) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * The world must GROW back, not FADE back.
 *
 * Fading every plant and leaf by the global bloom value makes the whole world
 * translucent at the midpoints — at bloom 0.33 you can see straight through the
 * trees and it looks like a rendering bug, not a season.
 *
 * Instead each object gets its own threshold and crosses from invisible to
 * SOLID over a narrow window. Things appear one after another; nothing lingers
 * as a ghost.
 *
 * @param {number} bloom global 0..1
 * @param {number} threshold when this object starts appearing
 * @param {number} [window] how quickly it becomes solid
 * @returns {number} alpha 0..1
 */
function growth(bloom, threshold, window = GROW_WINDOW) {
  return Math.min(1, Math.max(0, (bloom - threshold) / window));
}

/** @param {string} a @param {string} b @param {number} t */
function mixHex(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/**
 * @typedef {object} Atlases
 * @property {import('../engine/sprites.js').Atlas} tiles
 * @property {import('../engine/sprites.js').Atlas} farm
 * @property {import('../engine/sprites.js').Atlas} bg
 */

/**
 * @param {Record<string, HTMLImageElement>} images
 * @returns {Atlases}
 */
export function createAtlases(images) {
  return {
    tiles: createAtlas(images.tiles, T),
    farm: createAtlas(images.farm, T),
    bg: createAtlas(images.bg, BG),
  };
}

// --- static scenery ---------------------------------------------------------
// Placed once, deterministically, so the level is stable.

/**
 * colorLevel RESTS at 0, 0.33, 0.66 and 1.0 — one per solved clue. Growth
 * thresholds must therefore sit strictly BETWEEN those rest points, so that at
 * every resting state each object is fully present or fully absent. A threshold
 * that straddles a rest point leaves something frozen half-transparent, which
 * reads as a rendering bug rather than a season.
 *
 * Each wave completes (threshold + GROW_WINDOW) before the next rest point.
 */
const GROW_WINDOW = 0.10;
const WAVES = [0.15, 0.42, 0.72]; // full by 0.30, 0.58, 0.88 — all safely short
const JITTER = 0.05;

/**
 * CROWN SHAPES — the tuning knob for how the trees look. Retune here.
 *
 * Each entry is one tree silhouette: a list of 3x3 foliage blobs positioned in
 * tile units relative to the trunk's top-left. One shape is assigned per tree,
 * so the treeline varies instead of reading as a single tree copy-pasted.
 *
 * Kenney's own sample builds a tree as a TALL trunk crowned with two or three
 * OVERLAPPING blobs — one blob on a short trunk is a lollipop. Two rules any new
 * shape must respect:
 *
 *   - Blobs are 3 tiles WIDE, so neighbouring dx values must differ by LESS than
 *     3. At exactly 3 they merely abut, and the crown reads as separate bushes
 *     parked side by side rather than one canopy.
 *   - The lowest blob's dy should sink INTO the trunk (-1 or lower), so the bark
 *     disappears up inside the leaves instead of holding them aloft like a hat.
 *
 * Blobs are drawn in order and each leafs out on its own growth wave, so list
 * them bottom-up and keep them to three or fewer (there are three waves).
 */
const CROWN_SHAPES = [
  // broad and low
  [{ dx: -2, dy: -1 }, { dx: 0, dy: -2 }, { dx: -1, dy: -3 }],
  // tall and narrow
  [{ dx: -1, dy: -1 }, { dx: -1, dy: -3 }, { dx: 0, dy: -4 }],
  // leaning right
  [{ dx: -1, dy: -1 }, { dx: 1, dy: -2 }, { dx: 0, dy: -4 }],
  // leaning left
  [{ dx: -1, dy: -1 }, { dx: -3, dy: -2 }, { dx: -2, dy: -4 }],
  // squat, two blobs only — a younger tree
  [{ dx: -2, dy: -1 }, { dx: -1, dy: -3 }],
];

// NOTE: TREES reads CROWN_SHAPES at module-evaluation time, so CROWN_SHAPES must
// be declared ABOVE it — a `const` referenced before its declaration throws.
const TREES = Array.from({ length: 14 }, (_, i) => ({
  x: 220 + i * 205 + Math.floor(rand(i) * 60),
  height: 4 + Math.floor(rand(i + 90) * 2), // trunk tiles above the base
  crown: CROWN_SHAPES[Math.floor(rand(i + 41) * CROWN_SHAPES.length)],
  // One crown blob per wave: the tree leafs out over the whole arc, and no two
  // trees leaf in unison.
  leafAt: WAVES.map((t, k) => t + rand(i * 3 + k + 11) * JITTER),
}));

/**
 * Clouds. The slowest parallax layer in the game, plus a slow drift of their
 * own, so the sky moves even when the player is standing still — which is what
 * stops a dead, empty world reading as a frozen one.
 *
 * They wrap over CLOUD_SPAN rather than the level length, so a handful of clouds
 * cover the whole walk.
 */
const CLOUD_SPAN = 900;

const CLOUDS = Array.from({ length: 9 }, (_, i) => ({
  x: (i * CLOUD_SPAN) / 9 + rand(i + 200) * 60,
  y: 18 + rand(i + 210) * 62,
  scale: 1 + Math.floor(rand(i + 220) * 3), // 1..3, in whole pixels
  drift: 2.6 + rand(i + 230) * 3.4,         // px/sec
}));

const PLANTS = Array.from({ length: 60 }, (_, i) => ({
  x: 60 + i * 51 + Math.floor(rand(i + 7) * 28),
  kind: Math.floor(rand(i + 31) * 3), // 0 shrub, 1 sprout, 2 sunflower
  variant: Math.floor(rand(i + 55) * 3),
  // Assigned to one of the three waves, so plants are never caught mid-fade at
  // a resting colorLevel.
  growAt: WAVES[i % WAVES.length] + rand(i + 77) * JITTER,
}));

// --- drawing ----------------------------------------------------------------

/**
 * Everything subject to the colour grade.
 *
 * @param {CanvasRenderingContext2D} c
 * @param {Atlases} atlas
 * @param {number} cam camera.x
 * @param {number} bloom 0..1 — how alive the world is
 * @param {number} [t] seconds, for the cloud drift
 */
export function drawWorld(c, atlas, cam, bloom, t = 0) {
  const b = Math.min(1, Math.max(0, bloom));

  // Sky.
  c.fillStyle = mixHex(SKY_DEAD, SKY_ALIVE, b);
  c.fillRect(0, 0, W, H);

  drawClouds(c, cam * 0.06, t, b);
  drawBackdrop(c, atlas, cam * 0.2, b);
  drawGround(c, atlas, cam, b);
  drawTrees(c, atlas, cam, b);
  drawPlants(c, atlas, cam, b);
}

/**
 * Blocky clouds, built from rectangles rather than a sprite so they stay crisp
 * at any integer scale — the same trick Kenney's foliage uses.
 *
 * @param {CanvasRenderingContext2D} c
 * @param {number} ox parallax offset
 * @param {number} t seconds
 * @param {number} b bloom
 */
function drawClouds(c, ox, t, b) {
  const body = mixHex(CLOUD_DEAD, CLOUD_ALIVE, b);
  const shade = mixHex(CLOUD_SHADE_DEAD, CLOUD_SHADE_ALIVE, b);

  for (const cloud of CLOUDS) {
    // Wrap into [-margin, W + margin] so clouds enter and leave rather than pop.
    const drifted = cloud.x + t * cloud.drift - ox;
    const x = Math.round(((drifted % CLOUD_SPAN) + CLOUD_SPAN) % CLOUD_SPAN) - 120;
    if (x > W + 80) continue;

    const y = Math.round(cloud.y);
    const s = cloud.scale;

    // Underside first, then the body sitting one pixel proud of it — a cheap
    // way to get volume out of two flat colours.
    c.fillStyle = shade;
    c.fillRect(x, y + 5 * s, 30 * s, 3 * s);

    c.fillStyle = body;
    c.fillRect(x, y + 3 * s, 30 * s, 3 * s);      // base
    c.fillRect(x + 4 * s, y, 9 * s, 4 * s);       // left puff
    c.fillRect(x + 15 * s, y - 2 * s, 11 * s, 6 * s); // right puff, taller
    c.fillRect(x + 11 * s, y + 1 * s, 6 * s, 3 * s);  // the dip between them
  }
}

/**
 * Far parallax. Kenney ships a barren desert panel and a lush green panel at
 * identical dimensions — so "the world comes back to life" is a cross-fade
 * between two panels by the same artist.
 *
 * @param {CanvasRenderingContext2D} c
 * @param {Atlases} atlas
 * @param {number} ox
 * @param {number} b
 */
function drawBackdrop(c, atlas, ox, b) {
  const panelW = BG * 2;
  const top = GROUND_Y - BG * 3;
  const start = -Math.floor(((ox % panelW) + panelW) % panelW);

  /** @param {number[][]} panel */
  const paint = (panel) => {
    for (let x = start; x < W; x += panelW) {
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 2; col++) {
          atlas.bg.draw(c, panel[row][col], x + col * BG, top + row * BG);
        }
      }
    }
  };

  paint(BG_DEAD);

  if (b > 0) {
    c.globalAlpha = b;
    paint(BG_ALIVE);
    c.globalAlpha = 1;
  }
}

/**
 * @param {CanvasRenderingContext2D} c
 * @param {Atlases} atlas
 * @param {number} cam
 * @param {number} b
 */
function drawGround(c, atlas, cam, b) {
  // Underground: flat colour, not tiles. Every tiled sprite shows its border,
  // and a screen-wide mass of dirt turns those borders into a visible grid.
  c.fillStyle = DIRT;
  c.fillRect(0, GROUND_Y + T, W, H - GROUND_Y - T);

  c.fillStyle = DIRT_SPECK;
  for (let i = 0; i < 90; i++) {
    const wx = i * 37;
    const x = wx - cam;
    if (x < -4 || x > W) continue;
    c.fillRect(Math.round(x), GROUND_Y + T + 8 + ((i * 17) % 46), 2, 2);
  }

  // Surface row: real tiles, because this is where the dead/alive change reads.
  const first = Math.floor(cam / T);
  const cols = Math.ceil(W / T) + 1;

  for (let i = 0; i < cols; i++) {
    const col = first + i;
    const x = col * T - cam;
    const v = col & 1; // must match the tile-array length, or tiles come back undefined

    atlas.tiles.draw(c, GROUND_DEAD[v], x, GROUND_Y);

    if (b > 0) {
      c.globalAlpha = b;
      atlas.tiles.draw(c, GROUND_ALIVE[v], x, GROUND_Y);
      c.globalAlpha = 1;
    }
  }
}

/**
 * Dead trunks are always there. Leaves grow in.
 *
 * @param {CanvasRenderingContext2D} c
 * @param {Atlases} atlas
 * @param {number} cam
 * @param {number} b
 */
function drawTrees(c, atlas, cam, b) {
  for (const tree of TREES) {
    const x = tree.x - cam;
    if (x < -80 || x > W + 80) continue;

    atlas.tiles.draw(c, TRUNK_BASE, x, GROUND_Y - T);
    for (let i = 1; i <= tree.height; i++) {
      atlas.tiles.draw(c, TRUNK, x, GROUND_Y - T * (i + 1));
    }

    if (b <= 0) continue;

    // Crown: overlapping 3x3 blobs around the top of the trunk. The topmost
    // trunk tile's top edge sits at GROUND_Y - T*(height+1).
    const trunkTop = GROUND_Y - T * (tree.height + 1);

    // Each blob has its own threshold, so a tree leafs out blob by blob rather
    // than materialising as a translucent ghost.
    for (let i = 0; i < tree.crown.length; i++) {
      const blob = tree.crown[i];
      const a = growth(b, tree.leafAt[i]);
      if (a <= 0) continue;

      const settle = (1 - a) * 5; // the blob drops onto the branch as it fills in

      c.globalAlpha = a;
      for (let row = 0; row < CANOPY.length; row++) {
        for (let col = 0; col < CANOPY[row].length; col++) {
          atlas.tiles.draw(
            c,
            CANOPY[row][col],
            x + (blob.dx + col) * T,
            trunkTop + (blob.dy + row) * T + settle,
          );
        }
      }
      c.globalAlpha = 1;
    }
  }
}

/**
 * Shrubs, sprouts and sunflowers. Pure bloom — none of this exists in the dead
 * world, so it is skipped entirely at b == 0.
 *
 * @param {CanvasRenderingContext2D} c
 * @param {Atlases} atlas
 * @param {number} cam
 * @param {number} b
 */
function drawPlants(c, atlas, cam, b) {
  if (b <= 0.02) return;

  for (const p of PLANTS) {
    const x = p.x - cam;
    if (x < -40 || x > W + 40) continue;

    const a = growth(b, p.growAt);
    if (a <= 0) continue;

    // Each plant pushes up out of the ground as it grows, rather than fading in
    // where it already stood.
    const rise = (1 - a) * 9;

    c.globalAlpha = a;
    if (p.kind === 0) {
      atlas.tiles.draw(c, SHRUBS[p.variant], x, GROUND_Y - T + rise);
    } else if (p.kind === 1) {
      atlas.farm.draw(c, SPROUTS[p.variant % SPROUTS.length], x, GROUND_Y - T + rise);
    } else {
      atlas.farm.draw(c, SUNFLOWER[1], x, GROUND_Y - T + rise);
      atlas.farm.draw(c, SUNFLOWER[0], x, GROUND_Y - T * 2 + rise);
    }
    c.globalAlpha = 1;
  }

  // Mushrooms only once the world is properly alive — the last thing to return.
  for (let i = 0; i < 20; i++) {
    const x = 140 + i * 157 - cam;
    if (x < -40 || x > W + 40) continue;

    const a = growth(b, 0.86 + rand(i + 3) * 0.08);
    if (a <= 0) continue;

    c.globalAlpha = a;
    atlas.tiles.draw(c, MUSHROOM, x, GROUND_Y - T + (1 - a) * 6);
    c.globalAlpha = 1;
  }
}

/**
 * Everything EXEMPT from the grade — drawn on a separate, unfiltered canvas.
 * The bench keeps its red in the dead world: the one spot of colour, visible
 * long before you reach it.
 *
 * @param {CanvasRenderingContext2D} c
 * @param {number} cam
 */
/**
 * The bench sprite, cropped to its content — so its bottom row IS the feet and
 * it can be planted directly on the ground line.
 *
 * Sourced from a generated render whose transparency turned out to be FAKE (the
 * checkerboard was painted into the image). tools/bench.html keys it out and
 * downsamples it to the game's pixel grid; the result is committed so the game
 * never does that work at runtime.
 */
export const BENCH_W = 45;
export const BENCH_H = 30;

/**
 * The bench: the ONE object exempt from the colour grade.
 *
 * Drawn by the caller BETWEEN the world and the actors, with the filter off —
 * not on a canvas stacked above everything, which is what previously made it
 * draw in front of the characters. Behind the actors is right for both cases:
 * walking past it, and sitting on it.
 *
 * @param {CanvasRenderingContext2D} c
 * @param {HTMLImageElement} bench
 * @param {number} cam
 */
export function drawBench(c, bench, cam) {
  const x = Math.round(BENCH.x - cam);
  if (x < -BENCH_W || x > W + BENCH_W) return;

  c.drawImage(bench, x - Math.round(BENCH_W / 2), BENCH.y - BENCH_H);
}

// --- landmarks --------------------------------------------------------------

// Generated, keyed and downsampled by tools/import.html. Both are cropped to
// their content, so the bottom row IS the ground line.
export const LION = { w: 52, h: 78 };
export const HOUSE = { w: 175, h: 130 };

/**
 * Landmarks the player walks up to. Drawn into the WORLD buffer, so they are
 * graded with everything else and the characters pass in FRONT of them.
 *
 * The house's door sits at the bottom centre of its sprite, which is exactly
 * where the gate stops the player — so they end up standing on the doorstep when
 * the cutscene takes over.
 *
 * @param {CanvasRenderingContext2D} c
 * @param {HTMLImageElement} lion
 * @param {HTMLImageElement} house
 * @param {number} cam
 * @param {number} lionX
 * @param {number} houseX
 */
export function drawProps(c, lion, house, cam, lionX, houseX) {
  const hx = Math.round(houseX - cam);
  if (hx > -HOUSE.w && hx < W + HOUSE.w) {
    c.drawImage(house, hx - Math.round(HOUSE.w / 2), GROUND_Y - HOUSE.h);
  }

  const lx = Math.round(lionX - cam);
  if (lx > -LION.w && lx < W + LION.w) {
    c.drawImage(lion, lx - Math.round(LION.w / 2), GROUND_Y - LION.h);
  }
}
