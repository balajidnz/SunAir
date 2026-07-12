// @ts-check

/**
 * Asset loading. Everything is preloaded before the game starts — a 7-minute
 * game has no business streaming, and a missing sprite mid-scene is worse than
 * a two-second wait.
 */

/** @param {string} src @returns {Promise<HTMLImageElement>} */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

/**
 * @template {Record<string, string>} T
 * @param {T} manifest map of name -> url
 * @param {(loaded: number, total: number) => void} [onProgress]
 * @returns {Promise<Record<keyof T, HTMLImageElement>>}
 */
export async function loadImages(manifest, onProgress) {
  const entries = Object.entries(manifest);
  let loaded = 0;

  const images = await Promise.all(
    entries.map(async ([, url]) => {
      const img = await loadImage(url);
      onProgress?.(++loaded, entries.length);
      return img;
    }),
  );

  return /** @type {any} */ (
    Object.fromEntries(entries.map(([name], i) => [name, images[i]]))
  );
}
