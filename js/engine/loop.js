// @ts-check

/**
 * Fixed-ish game loop. `dt` is clamped so that alt-tabbing away and back does
 * not teleport the player across the level in a single 4-second frame.
 *
 * @param {(dt: number) => void} update seconds since last frame
 * @param {() => void} render
 * @returns {() => void} stop
 */
export function startLoop(update, render) {
  const MAX_DT = 1 / 30;
  let last = performance.now();
  let raf = 0;
  let running = true;

  /** @param {number} now */
  function frame(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, MAX_DT);
    last = now;

    update(dt);
    render();

    raf = requestAnimationFrame(frame);
  }

  raf = requestAnimationFrame(frame);

  // A backgrounded tab stops firing rAF; without this, `last` goes stale and
  // the first frame back would produce a huge dt (clamped, but still a jump).
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) last = performance.now();
  });

  return () => {
    running = false;
    cancelAnimationFrame(raf);
  };
}
