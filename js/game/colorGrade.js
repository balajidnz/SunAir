// @ts-check

/**
 * The visual thesis of the whole game, in about ten lines.
 *
 * The world is authored once, in full colour. A single `colorLevel` (0..1)
 * desaturates it, and each solved clue lifts that value. There is no second
 * set of "grey" art anywhere in the project.
 *
 * Implemented as a CSS filter on the canvas element rather than per-frame
 * canvas work: it is GPU-composited, costs zero JS per frame, and avoids
 * canvas `globalCompositeOperation: 'saturation'`, whose non-separable blend
 * modes are inconsistent across engines.
 *
 * `saturate(0)` alone yields a flat, neutral grey — technically colourless but
 * emotionally inert. The contrast and brightness terms, plus a cool overlay,
 * are what make it read as a *dead* world rather than a black-and-white photo.
 */

const clamp01 = (/** @type {number} */ c) => Math.min(1, Math.max(0, c));

/** How strongly the cool wash sits over the world at colorLevel 0. */
export const TINT_MAX = 0.22;

/**
 * The filter string, as a value. Exported separately so tooling can bake the
 * grade into actual pixels via `ctx.filter` — a CSS filter on an element never
 * shows up in `canvas.toDataURL()`.
 *
 * @param {number} c colorLevel, 0..1
 * @returns {string}
 */
export function gradeFilter(c) {
  const t = clamp01(c);
  return [
    `saturate(${t.toFixed(3)})`,
    `contrast(${(0.85 + 0.15 * t).toFixed(3)})`,
    `brightness(${(0.92 + 0.08 * t).toFixed(3)})`,
  ].join(' ');
}

/** @param {number} c colorLevel, 0..1 */
export const tintOpacity = (c) => (1 - clamp01(c)) * TINT_MAX;

/**
 * @param {HTMLElement} canvasEl the world canvas
 * @param {HTMLElement} tintEl   a plain cool-grey overlay div
 * @param {number} c             colorLevel, 0..1
 */
export function applyGrade(canvasEl, tintEl, c) {
  canvasEl.style.filter = gradeFilter(c);
  tintEl.style.opacity = tintOpacity(c).toFixed(3);
}
