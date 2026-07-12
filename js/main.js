// @ts-check
import { startLoop } from './engine/loop.js';
import { createInput } from './engine/input.js';
import { installDevReporter } from './engine/devreport.js';
import { loadImages } from './engine/assets.js';
import { drawCharacter } from './engine/sprites.js';
import { createTween } from './engine/tween.js';
import { createFade } from './engine/fade.js';
import { gradeFilter, tintOpacity } from './game/colorGrade.js';
import { loadCharacter, frameFor } from './game/characters.js';
import { createDialogue } from './game/dialogue.js';
import { createStory, LION_X, HOUSE_X } from './game/story.js';
import { showTitle, showPlaceholderPuzzle, showEnding } from './game/screens.js';
import { drawInterior, FLOOR_Y, CHAR_SCALE } from './game/interior.js';
import { NAMES, DIALOGUE } from '../data/dialogue.js';
import {
  W, H, GROUND_Y, LEVEL_W,
  createAtlases, drawWorld, drawBench, drawProps,
} from './game/world.js';

installDevReporter();

const $ = (/** @type {string} */ id) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
};

const stage = $('stage');
const canvas = /** @type {HTMLCanvasElement} */ ($('game'));
const tint = $('tint');
const ui = $('ui');

const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('no 2d context');
ctx.imageSmoothingEnabled = false;

/**
 * The world renders to an offscreen buffer, then composites ONCE with the grade
 * applied. That is what lets the bench sit at the correct depth — behind the
 * actors — while staying exempt from the grade:
 *
 *   filtered    world buffer
 *   UNFILTERED  bench          <- stays red in a grey world
 *   filtered    actors
 *
 * A CSS filter on the whole canvas (with the bench on a canvas stacked above it)
 * forced the bench to draw in FRONT of the characters, which breaks the moment
 * they sit on it.
 */
const worldBuf = document.createElement('canvas');
worldBuf.width = W;
worldBuf.height = H;
const wctx = worldBuf.getContext('2d');
if (!wctx) throw new Error('no 2d context');
wctx.imageSmoothingEnabled = false;

const [images, boy, girl] = await Promise.all([
  loadImages({
    tiles: 'assets/img/tiles/tiles.png',
    farm: 'assets/img/tiles/farm.png',
    bg: 'assets/img/tiles/backgrounds.png',
    bench: 'assets/img/props/bench.png',
    lion: 'assets/img/props/lion.png',
    house: 'assets/img/props/house.png',
    room: 'assets/img/rooms/house.png',
  }),
  loadCharacter('boy'),
  loadCharacter('girl'),
]);

const atlases = createAtlases(images);
const input = createInput(stage);
const dialogue = createDialogue(ui, NAMES);
const fade = createFade($('fade'));
const color = createTween(0);

const SPEED = 62;
const COMPANION_LAG = 34;

const state = {
  playerIsBoy: true,
  /** 'road' | 'house' */
  scene: 'road',
  player: { x: 60, facing: 1, moving: false, t: 0 },
  companion: { x: 20, facing: 1, moving: false, t: 0 },
  camera: { x: 0 },
  /** Wall-clock, for the sky. Runs regardless of whether anyone is walking. */
  t: 0,
};

/**
 * The cutscene. Fade to black, swap the scene, fade back in — with a line of
 * dialogue playing OVER the black, which is what makes it read as a cut rather
 * than a stutter.
 *
 * @param {boolean} inside
 */
async function setScene(inside) {
  await fade.out(650);

  if (inside) {
    await dialogue.play(DIALOGUE.house.entering, state.playerIsBoy);
    state.scene = 'house';
    // Stand them in the room, facing each other's side of the wall.
    state.player.x = W / 2 + 62;
    state.companion.x = W / 2 - 68;
    state.player.facing = -1;
    state.companion.facing = 1;
  } else {
    state.scene = 'road';
    // Back out on the road, just past the door, so they don't re-trigger it.
    state.player.x = HOUSE_X + 40;
    state.companion.x = HOUSE_X + 6;
    state.player.facing = 1;
    state.companion.facing = 1;
  }

  await fade.in(650);
}

const story = createStory({
  dialogue,
  setColor: (to) => color.to(color.value, to, 2.2),
  runPuzzle: (s) => showPlaceholderPuzzle(ui, s.id),
  playerIsBoy: () => state.playerIsBoy,
  setScene,
  onFinished: () => showEnding(ui),
});

/** @param {number} dt */
function update(dt) {
  color.update(dt);
  state.t += dt;

  const p = state.player;
  const cm = state.companion;

  // Frozen during dialogue, puzzles, cutscenes and the ending. Indoors there is
  // nowhere to walk, so movement is off there too.
  const frozen =
    story.busy || dialogue.open || story.finished || state.scene === 'house';

  const axis = frozen ? 0 : input.axis;
  const limit = Math.min(LEVEL_W - 20, story.gateX);

  p.moving = axis !== 0;
  p.x = Math.max(20, Math.min(limit, p.x + axis * SPEED * dt));
  if (axis !== 0) p.facing = axis;

  if (state.scene === 'road') {
    const target = p.x - COMPANION_LAG * p.facing;
    const before = cm.x;
    cm.x += (target - cm.x) * Math.min(1, dt * 3.4);

    const drift = cm.x - before;
    cm.moving = Math.abs(drift) > 0.12;
    if (cm.moving) cm.facing = drift > 0 ? 1 : -1;

    state.camera.x = Math.max(0, Math.min(LEVEL_W - W, p.x - W / 2));
  } else {
    cm.moving = false;
  }

  // Animation clocks only advance while walking, so a stopped character settles
  // on the idle pose rather than freezing mid-stride.
  if (p.moving) p.t += dt;
  if (cm.moving) cm.t += dt;

  input.endFrame();
  void story.update(p.x);
}

function render() {
  const bloom = color.value;
  const grade = gradeFilter(bloom);
  const indoors = state.scene === 'house';
  const cam = indoors ? 0 : state.camera.x;
  const ground = indoors ? FLOOR_Y : GROUND_Y;
  const scale = indoors ? CHAR_SCALE : 1;

  // 1. the world (or the room), into its own buffer
  if (indoors) {
    drawInterior(wctx, images.room, bloom);
  } else {
    drawWorld(wctx, atlases, cam, bloom, state.t);
    drawProps(wctx, images.lion, images.house, cam, LION_X, HOUSE_X);
  }

  // 2. composite it, graded
  ctx.filter = grade;
  ctx.drawImage(worldBuf, 0, 0);

  // 3. the bench — UNFILTERED, so it keeps its red, and BEHIND the actors
  ctx.filter = 'none';
  if (!indoors) drawBench(ctx, images.bench, cam);

  // 4. the actors, graded like the world
  ctx.filter = grade;

  const p = state.player;
  const cm = state.companion;
  const playerCh = state.playerIsBoy ? boy : girl;
  const companionCh = state.playerIsBoy ? girl : boy;

  drawCharacter(ctx, frameFor(companionCh, cm.moving, cm.t), companionCh,
    cm.x - cam, ground, cm.facing < 0, scale);
  drawCharacter(ctx, frameFor(playerCh, p.moving, p.t), playerCh,
    p.x - cam, ground, p.facing < 0, scale);

  ctx.filter = 'none';

  tint.style.opacity = tintOpacity(bloom).toFixed(3);
}

// --- boot -------------------------------------------------------------------

startLoop(update, render);

state.playerIsBoy = await showTitle(ui);
await story.begin();
