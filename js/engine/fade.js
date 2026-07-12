// @ts-check

/**
 * Cutscene fade. Covers the world but not the UI, so dialogue can play over
 * black — which is how "they step inside" reads as a cut rather than a glitch.
 */

/**
 * @param {HTMLElement} el the #fade overlay
 */
export function createFade(el) {
  /** @param {number} opacity @param {number} ms */
  const to = (opacity, ms) =>
    new Promise((resolve) => {
      el.style.transition = `opacity ${ms}ms ease`;
      el.style.opacity = String(opacity);
      el.style.pointerEvents = opacity > 0 ? 'auto' : 'none';
      // transitionend can be skipped entirely if the value doesn't change, so
      // don't depend on it — a timer always fires.
      setTimeout(resolve, ms + 20);
    });

  return {
    /** @param {number} [ms] */
    out: (ms = 700) => to(1, ms),
    /** @param {number} [ms] */
    in: (ms = 700) => to(0, ms),
  };
}
