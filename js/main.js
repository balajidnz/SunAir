// @ts-check
import { startLoop } from './engine/loop.js';
import { createInput } from './engine/input.js';
import { installDevReporter } from './engine/devreport.js';
import { applyGrade } from './game/colorGrade.js';
import { W, GROUND_Y, LEVEL_W, drawWorld, drawExempt, drawActor } from './game/world.js';

installDevReporter();

/**
 * Day-1 scaffold.
 *
 * Placeholder rectangles, no art. The point is to prove the three things that
 * are expensive to retrofit later: the fixed 320x180 backing store, the
 * parallax layer stack, and the colorLevel grade — including the one object
 * that is exempt from it.
 */

const $ = (/** @type {string} */ id) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
};

const stage = $('stage');
const gameCanvas = /** @type {HTMLCanvasElement} */ ($('game'));
const fxCanvas = /** @type {HTMLCanvasElement} */ ($('fx'));
const tint = $('tint');

const ctx = gameCanvas.getContext('2d');
const fx = fxCanvas.getContext('2d');
if (!ctx || !fx) throw new Error('no 2d context');

// Pixel art must never be smoothed. The backing store never resizes, so once.
ctx.imageSmoothingEnabled = false;
fx.imageSmoothingEnabled = false;

const input = createInput(stage);

const state = {
  /** 0 = dead world, 1 = fully alive. Raised by solving clues. */
  colorLevel: 0,
  player: { x: 40, y: GROUND_Y, facing: 1 },
  companion: { x: 16, y: GROUND_Y },
  camera: { x: 0 },
};

const SPEED = 58;         // px/sec in world units
const COMPANION_LAG = 26; // how far behind she trails

/** @param {number} dt */
function update(dt) {
  const p = state.player;
  const axis = input.axis;

  p.x = Math.max(8, Math.min(LEVEL_W - 8, p.x + axis * SPEED * dt));
  if (axis !== 0) p.facing = axis;

  // Companion trails on whichever side the player came from.
  const target = p.x - COMPANION_LAG * p.facing;
  state.companion.x += (target - state.companion.x) * Math.min(1, dt * 3.2);

  state.camera.x = Math.max(0, Math.min(LEVEL_W - W, p.x - W / 2));

  input.endFrame();
}

function render() {
  const cam = state.camera.x;

  drawWorld(ctx, cam);
  drawActor(ctx, state.companion.x - cam, state.companion.y, '#b8607a');
  drawActor(ctx, state.player.x - cam, state.player.y, '#5f7fa8');

  // Unfiltered layer: the bench keeps its red while the world is grey.
  drawExempt(fx, cam);

  applyGrade(gameCanvas, tint, state.colorLevel);
}

// --- dev --------------------------------------------------------------------

const slider = /** @type {HTMLInputElement} */ ($('debug-color'));
const readout = $('debug-color-value');

slider.addEventListener('input', () => {
  state.colorLevel = Number(slider.value);
  readout.textContent = state.colorLevel.toFixed(2);
});

startLoop(update, render);
