// @ts-check

/**
 * Tile atlas.
 *
 * Kenney's `_packed` sheets have no spacing between tiles, which normally
 * invites texture bleed — a scaled draw samples a neighbouring tile's edge
 * pixels and you get seams. We avoid it structurally rather than with padding:
 * the game draws every tile 1:1 into the fixed backing store and lets CSS
 * upscale the whole canvas. No sub-pixel sampling can occur.
 *
 * (Bleed IS visible in tools that scale the context while drawing sub-rects —
 * that's a tooling artefact, not a game bug.)
 */

/**
 * @typedef {object} Atlas
 * @property {HTMLImageElement} image
 * @property {number} tile tile size in px
 * @property {number} cols
 * @property {(ctx: CanvasRenderingContext2D, index: number, x: number, y: number) => void} draw
 */

/**
 * @param {HTMLImageElement} image
 * @param {number} tile size in px (Kenney: 18 for tiles/farm, 24 for characters/bg)
 * @returns {Atlas}
 */
export function createAtlas(image, tile) {
  const cols = Math.round(image.width / tile);

  return {
    image,
    tile,
    cols,

    /**
     * Draw tile `index` with its TOP-LEFT at x,y. Coordinates are rounded so a
     * fractional camera never produces a half-pixel sample.
     */
    draw(ctx, index, x, y) {
      const sx = (index % cols) * tile;
      const sy = Math.floor(index / cols) * tile;
      ctx.drawImage(image, sx, sy, tile, tile, Math.round(x), Math.round(y), tile, tile);
    },
  };
}

/**
 * A character sprite sheet, plus the geometry needed to plant it on the ground.
 *
 * The two exports are NOT the same size (boy 56px, girl 48px) and both carry
 * transparent padding beneath the feet (8px and 6px). Anchoring on the image
 * box therefore leaves the character hovering. We anchor on the FEET instead —
 * measured with tools/measure.html, not guessed.
 *
 * @typedef {object} Character
 * @property {HTMLImageElement} idle
 * @property {HTMLImageElement[]} walk
 * @property {number} size       frame width/height in px
 * @property {number} padBelow   transparent rows beneath the feet
 * @property {number} centreX    x of the character's visual centre in the frame
 */

/**
 * Draw a character anchored at its FEET: `x` is the visual centre, `y` is the
 * ground line the feet stand on.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} frame
 * @param {Character} ch
 * @param {number} x centre, in screen px
 * @param {number} y the ground line
 * @param {boolean} [flip] mirror horizontally (walking left)
 */
export function drawCharacter(ctx, frame, ch, x, y, flip = false, scale = 1) {
  const w = ch.size * scale;
  const h = ch.size * scale;

  // Bottom of the opaque content must land on the ground line.
  const dy = Math.round(y - (ch.size - ch.padBelow) * scale);
  const cx = ch.centreX * scale;

  if (!flip) {
    ctx.drawImage(frame, Math.round(x - cx), dy, w, h);
    return;
  }

  // Mirror about the character's centre, not the frame's, or a flipped sprite
  // shifts sideways.
  ctx.save();
  ctx.translate(Math.round(x), dy);
  ctx.scale(-1, 1);
  ctx.drawImage(frame, -cx, 0, w, h);
  ctx.restore();
}
