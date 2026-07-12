// @ts-check

/**
 * Minimal tween. The colour never snaps — every clue solved eases the world
 * back over a couple of seconds, and that easing is most of the feeling.
 */

/** @param {number} t */
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/**
 * @typedef {object} Tween
 * @property {(dt: number) => void} update
 * @property {(from: number, to: number, seconds: number) => Promise<void>} to
 * @property {number} value
 * @property {boolean} running
 */

/**
 * @param {number} initial
 * @returns {Tween}
 */
export function createTween(initial) {
  let value = initial;
  let from = initial;
  let target = initial;
  let elapsed = 0;
  let duration = 0;
  /** @type {(() => void) | null} */
  let resolve = null;

  return {
    get value() { return value; },
    get running() { return duration > 0; },

    update(dt) {
      if (duration <= 0) return;

      elapsed += dt;
      const t = Math.min(1, elapsed / duration);
      value = from + (target - from) * easeOutCubic(t);

      if (t >= 1) {
        value = target;
        duration = 0;
        resolve?.();
        resolve = null;
      }
    },

    to(a, b, seconds) {
      // A zero-length tween must still resolve. Otherwise update() short-circuits
      // on `duration <= 0`, the promise never settles, and any `await` on it
      // hangs the story forever.
      if (seconds <= 0) {
        from = a;
        target = b;
        value = b;
        duration = 0;
        return Promise.resolve();
      }

      from = a;
      target = b;
      value = a;
      elapsed = 0;
      duration = seconds;
      return new Promise((r) => { resolve = r; });
    },
  };
}
