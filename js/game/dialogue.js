// @ts-check
import { safeRender } from '../share/render.js';

/**
 * The dialogue box.
 *
 * DOM, never canvas. Canvas text means reimplementing wrapping, emoji, and font
 * fallback for non-Latin scripts — a two-day hole for zero gain. The canvas
 * draws the world; the DOM draws the words.
 */

const CHARS_PER_SEC = 42;

/**
 * @typedef {{who: string, text: string, shows?: string}} Line
 */

/**
 * @param {HTMLElement} root the #ui layer
 * @param {{boy: string, girl: string}} names
 */
export function createDialogue(root, names) {
  const box = document.createElement('div');
  box.className = 'dialogue';
  box.hidden = true;

  const who = document.createElement('p');
  who.className = 'dialogue-who';

  const text = document.createElement('p');
  text.className = 'dialogue-text';

  const more = document.createElement('span');
  more.className = 'dialogue-more';
  more.textContent = '▾';

  box.append(who, text, more);
  root.append(box);

  let open = false;
  /** @type {(() => void) | null} */
  let advance = null;

  /** Speaker label. 'player'/'companion' resolve against who you chose to be. */
  const label = (/** @type {string} */ speaker, /** @type {boolean} */ playerIsBoy) => {
    if (speaker === 'player') return playerIsBoy ? names.boy : names.girl;
    if (speaker === 'companion') return playerIsBoy ? names.girl : names.boy;
    if (speaker === 'lion') return 'THE LION';
    if (speaker === 'system') return '';
    return speaker;
  };

  /** Any key or click moves the dialogue on. */
  const onKey = (/** @type {KeyboardEvent} */ e) => {
    if (!open) return;
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') {
      e.preventDefault();
      advance?.();
    }
  };
  document.addEventListener('keydown', onKey);
  box.addEventListener('click', () => advance?.());

  return {
    get open() { return open; },

    /**
     * Play a run of lines. Resolves once the last one is dismissed.
     *
     * @param {Line[]} lines
     * @param {boolean} playerIsBoy
     * @returns {Promise<void>}
     */
    async play(lines, playerIsBoy) {
      open = true;
      box.hidden = false;

      for (const line of lines) {
        box.classList.toggle('is-system', line.who === 'system');
        safeRender(who, label(line.who, playerIsBoy));

        // Typewriter. A click or key mid-reveal completes the line instantly
        // rather than skipping it — impatience should never cost you words.
        await new Promise((done) => {
          let shown = 0;
          let finished = false;
          let last = performance.now();
          let raf = 0;

          const complete = () => {
            finished = true;
            cancelAnimationFrame(raf);
            safeRender(text, line.text);
            more.hidden = false;
            advance = () => { advance = null; done(undefined); };
          };

          /** @param {number} now */
          const step = (now) => {
            shown += ((now - last) / 1000) * CHARS_PER_SEC;
            last = now;

            if (shown >= line.text.length) { complete(); return; }
            safeRender(text, line.text.slice(0, Math.floor(shown)));
            raf = requestAnimationFrame(step);
          };

          more.hidden = true;
          advance = () => { if (!finished) complete(); };
          raf = requestAnimationFrame(step);
        });
      }

      open = false;
      box.hidden = true;
      advance = null;
    },

    destroy() {
      document.removeEventListener('keydown', onKey);
      box.remove();
    },
  };
}
