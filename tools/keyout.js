// @ts-check

/**
 * Strip the painted-on transparency checkerboard from a generated image.
 *
 * The generator writes the transparency checkerboard into the image as ACTUAL
 * grey squares — the PNG has no alpha at all. Three things make this harder than
 * "delete everything grey":
 *
 *   1. The subject has its own light/grey pixels (a stone lion is grey all over,
 *      a bench has white highlights). Colour alone cannot discriminate.
 *   2. Regions of checkerboard get ENCLOSED by the subject (between a bench's
 *      backrest and its seat, between a lion's legs). A flood-fill from the
 *      border never reaches them.
 *   3. The renderer anti-aliases the checkerboard into the subject, leaving a
 *      pale fringe too impure to classify.
 *
 * The discriminator that actually works: a checkerboard region contains BOTH of
 * its two shades, touching. A real highlight is one flat colour.
 */

/**
 * @param {HTMLCanvasElement} canvas image already drawn into it
 * @param {(msg: string) => void} [log]
 * @returns {boolean} true if a checkerboard was found and removed
 */
export function keyOutCheckerboard(canvas, log = () => {}) {
  const W = canvas.width;
  const H = canvas.height;
  const cx = canvas.getContext('2d', { willReadFrequently: true });
  if (!cx) throw new Error('no 2d context');

  const img = cx.getImageData(0, 0, W, H);
  const data = img.data;

  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 8) transparent++;
  const pct = (transparent / (W * H)) * 100;
  log(`transparent pixels: ${pct.toFixed(1)}%`);

  if (pct >= 5) {
    log('alpha is real — nothing to key out');
    return false;
  }
  log('*** alpha is FAKE — the checkerboard is painted in. keying out. ***');

  /** 0 = not checker, 1 = darker square, 2 = lighter square. */
  const shade = (/** @type {number} */ i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const neutral = Math.abs(r - g) < 12 && Math.abs(g - b) < 12 && Math.abs(r - b) < 12;
    if (!neutral || r < 180) return 0;
    return r >= 235 ? 2 : 1;
  };

  const seen = new Uint8Array(W * H);
  let erased = 0;

  // Label every connected region of neutral-light pixels, then erase a region
  // only if it holds BOTH checker shades, or reaches the image edge.
  for (let p0 = 0; p0 < W * H; p0++) {
    if (seen[p0] || shade(p0 * 4) === 0) continue;

    /** @type {number[]} */
    const region = [];
    const stack = [p0];
    seen[p0] = 1;
    let hasDark = false;
    let hasLight = false;
    let touchesEdge = false;

    while (stack.length) {
      const p = /** @type {number} */ (stack.pop());
      const x = p % W;
      const y = (p / W) | 0;

      const s = shade(p * 4);
      if (s === 1) hasDark = true;
      else if (s === 2) hasLight = true;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) touchesEdge = true;
      region.push(p);

      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const np = ny * W + nx;
        if (seen[np] || shade(np * 4) === 0) continue;
        seen[np] = 1;
        stack.push(np);
      }
    }

    if ((hasDark && hasLight) || touchesEdge) {
      for (const p of region) data[p * 4 + 3] = 0;
      erased += region.length;
    } else {
      log(`kept a ${region.length}px light region (subject detail, not checker)`);
    }
  }

  // Erode the anti-aliased fringe: only pixels that are BOTH washed-out AND
  // already touching transparency, so interior detail survives.
  for (let pass = 0; pass < 3; pass++) {
    /** @type {number[]} */
    const kill = [];

    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const p = y * W + x;
        const i = p * 4;
        if (data[i + 3] === 0) continue;

        const r = data[i], g = data[i + 1], b = data[i + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if (!(max > 170 && max - min < 60)) continue; // pale + low-saturation

        const nextToHole =
          data[(p - 1) * 4 + 3] === 0 || data[(p + 1) * 4 + 3] === 0 ||
          data[(p - W) * 4 + 3] === 0 || data[(p + W) * 4 + 3] === 0;

        if (nextToHole) kill.push(i);
      }
    }

    if (!kill.length) break;
    for (const i of kill) data[i + 3] = 0;
    erased += kill.length;
    log(`fringe pass ${pass + 1}: eroded ${kill.length}px`);
  }

  cx.putImageData(img, 0, 0);
  log(`erased ${((erased / (W * H)) * 100).toFixed(1)}% as background`);
  return true;
}

/**
 * Opaque content box of a canvas.
 * @param {HTMLCanvasElement} canvas
 */
export function contentBounds(canvas) {
  const cx = canvas.getContext('2d', { willReadFrequently: true });
  if (!cx) throw new Error('no 2d context');
  const { data } = cx.getImageData(0, 0, canvas.width, canvas.height);

  let top = Infinity, bottom = -1, left = Infinity, right = -1;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] > 8) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  return { left, top, w: right - left + 1, h: bottom - top + 1 };
}
