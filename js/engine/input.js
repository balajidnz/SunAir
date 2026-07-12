// @ts-check

/**
 * Input. Keyboard is the primary path — she plays on a laptop — with touch
 * kept as a supported secondary for Android.
 *
 * Deliberately tiny: the game only ever needs "walk", "interact" and "hint".
 */

/**
 * @typedef {object} Input
 * @property {number} axis   -1, 0 or 1 — horizontal walk
 * @property {boolean} interact edge-triggered; true for one frame only
 * @property {boolean} hint     edge-triggered; true for one frame only
 * @property {() => void} endFrame clears the edge-triggered flags
 * @property {() => void} destroy
 */

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const INTERACT = new Set(['Space', 'Enter', 'KeyE']);
const HINT = new Set(['KeyH']);

/**
 * @param {HTMLElement} touchTarget element that receives touch/hold input
 * @returns {Input}
 */
export function createInput(touchTarget) {
  const held = new Set();
  let touchAxis = 0;
  let interact = false;
  let hint = false;

  /** True while a text field has focus, so typing "a" doesn't walk the player. */
  const typing = () => {
    const el = document.activeElement;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  };

  /** @param {KeyboardEvent} e */
  const onKeyDown = (e) => {
    if (typing()) return;

    if (LEFT.has(e.code) || RIGHT.has(e.code)) {
      held.add(e.code);
      e.preventDefault(); // stop arrow keys scrolling the page
    } else if (INTERACT.has(e.code)) {
      if (!e.repeat) interact = true;
      e.preventDefault(); // stop Space scrolling the page
    } else if (HINT.has(e.code)) {
      if (!e.repeat) hint = true;
    }
  };

  /** @param {KeyboardEvent} e */
  const onKeyUp = (e) => held.delete(e.code);

  // Releases keys that would otherwise stick down when focus leaves the window
  // mid-walk (alt-tab while holding right => player walks forever).
  const onBlur = () => held.clear();

  /** @param {PointerEvent} e */
  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse') return; // mouse is for UI, not walking
    const { left, width } = touchTarget.getBoundingClientRect();
    touchAxis = e.clientX - left < width / 2 ? -1 : 1;
    touchTarget.setPointerCapture(e.pointerId);
  };

  const onPointerUp = () => { touchAxis = 0; };

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  touchTarget.addEventListener('pointerdown', onPointerDown);
  touchTarget.addEventListener('pointerup', onPointerUp);
  touchTarget.addEventListener('pointercancel', onPointerUp);

  return {
    get axis() {
      const kb = ([...held].some((k) => RIGHT.has(k)) ? 1 : 0)
               - ([...held].some((k) => LEFT.has(k)) ? 1 : 0);
      return kb || touchAxis;
    },
    get interact() { return interact; },
    get hint() { return hint; },

    endFrame() {
      interact = false;
      hint = false;
    },

    destroy() {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      touchTarget.removeEventListener('pointerdown', onPointerDown);
      touchTarget.removeEventListener('pointerup', onPointerUp);
      touchTarget.removeEventListener('pointercancel', onPointerUp);
    },
  };
}
