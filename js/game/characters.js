// @ts-check
import { loadImage } from '../engine/assets.js';

/**
 * Character definitions.
 *
 * The geometry here is MEASURED (tools/measure.html), not guessed. The two
 * exports differ — the boy's frames are 56px and the girl's 48px, and both
 * carry transparent padding beneath the feet. Anchoring on the image box is
 * what made them hover above the ground.
 *
 * Source frames face EAST; walking west is a horizontal flip.
 */

/** @type {Record<string, {size: number, padBelow: number, centreX: number}>} */
const GEOMETRY = {
  boy: { size: 56, padBelow: 8, centreX: 28 },
  girl: { size: 48, padBelow: 6, centreX: 23 },
};

const WALK_FRAMES = 6;

/** Seconds per walk frame. 6 frames at ~11fps reads as a walk, not a scurry. */
export const WALK_FPS = 11;

/**
 * @param {'boy' | 'girl'} who
 * @returns {Promise<import('../engine/sprites.js').Character>}
 */
export async function loadCharacter(who) {
  const [idle, ...walk] = await Promise.all([
    loadImage(`assets/img/${who}/idle.png`),
    ...Array.from({ length: WALK_FRAMES }, (_, i) =>
      loadImage(`assets/img/${who}/walk/frame_00${i}.png`),
    ),
  ]);

  return { idle, walk, ...GEOMETRY[who] };
}

/**
 * @param {import('../engine/sprites.js').Character} ch
 * @param {boolean} moving
 * @param {number} t seconds
 */
export function frameFor(ch, moving, t) {
  if (!moving || ch.walk.length === 0) return ch.idle;

  // Guard the index. A NaN or negative `t` silently yields walk[NaN] ===
  // undefined, and the failure surfaces far away inside drawImage as an
  // inscrutable "value is not of type HTMLImageElement".
  const i = Math.floor(t * WALK_FPS) % ch.walk.length;
  const frame = ch.walk[i];
  if (!frame) throw new Error(`bad walk frame: i=${i} t=${t} frames=${ch.walk.length}`);
  return frame;
}
