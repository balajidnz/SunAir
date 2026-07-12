// @ts-check
import { DIALOGUE } from '../../data/dialogue.js';
import { BENCH } from './world.js';

/**
 * The story: three gates across one walk, with a detour indoors.
 *
 * Each act is a TRIGGER at a position plus a GATE that will not let you past
 * until the clue is solved. That is the lion's line — "you may not pass what you
 * cannot answer" — expressed as code.
 *
 * The puzzles are PLACEHOLDERS ("press E"). Deliberately: the game gets a
 * beginning, middle and end before any puzzle is real, so each real puzzle is a
 * swap-in and we can still ship if one of them isn't finished.
 */

export const LION_X = 800;
export const HOUSE_X = 1600;

/** How close you get to a gate before it stops you. */
const GATE_MARGIN = 70;

/**
 * @typedef {object} Stage
 * @property {string} id
 * @property {number} x            where the obstacle stands
 * @property {number} colorAfter   colorLevel once solved
 * @property {boolean} [indoors]   the puzzle happens inside the house
 */

/** @type {Stage[]} */
export const STAGES = [
  { id: 'lion', x: LION_X, colorAfter: 0.33 },
  { id: 'house', x: HOUSE_X, colorAfter: 0.66, indoors: true },
  { id: 'bench', x: BENCH.x, colorAfter: 1.0 },
];

/**
 * @param {object} deps
 * @param {{play: (lines: import('./dialogue.js').Line[], playerIsBoy: boolean) => Promise<void>, open: boolean}} deps.dialogue
 * @param {(to: number) => Promise<void>} deps.setColor
 * @param {(stage: Stage) => Promise<void>} deps.runPuzzle
 * @param {() => boolean} deps.playerIsBoy
 * @param {(inside: boolean) => Promise<void>} deps.setScene  fades out, swaps, fades in
 * @param {() => void} deps.onFinished
 */
export function createStory({ dialogue, setColor, runPuzzle, playerIsBoy, setScene, onFinished }) {
  let index = 0;
  let busy = false;
  let sightedBench = false;
  let started = false;
  let finished = false;

  const say = (/** @type {import('./dialogue.js').Line[]} */ lines) =>
    dialogue.play(lines, playerIsBoy());

  return {
    get busy() { return busy; },
    get finished() { return finished; },

    /** How far right the player may currently walk. */
    get gateX() {
      const stage = STAGES[index];
      return stage ? stage.x - GATE_MARGIN : Infinity;
    },

    async begin() {
      if (started) return;
      started = true;
      busy = true;
      await say(DIALOGUE.intro);
      busy = false;
    },

    /**
     * @param {number} playerX
     */
    async update(playerX) {
      if (busy || finished || !started) return;

      // Remark on the bench the moment it actually ENTERS VIEW — the one spot of
      // colour in a dead world. The threshold is derived, not guessed: the
      // camera centres the player, so its right edge is playerX + W/2, and the
      // bench sits at BENCH.x. Firing this line any earlier would have them
      // react to something that is not on screen.
      if (!sightedBench && playerX > BENCH.x - 240) {
        sightedBench = true;
        busy = true;
        await say(DIALOGUE.benchSighted);
        busy = false;
        return;
      }

      const stage = STAGES[index];
      if (!stage || playerX < stage.x - GATE_MARGIN - 4) return;

      busy = true;

      if (stage.id === 'lion') {
        await say(DIALOGUE.lion.approach);
        await runPuzzle(stage);
        await say(DIALOGUE.lion.riddle.solved);

      } else if (stage.id === 'house') {
        // The one place the game leaves the road.
        await say(DIALOGUE.house.approach);
        await setScene(true);
        await say(DIALOGUE.house.inside);
        await runPuzzle(stage);
        await say(DIALOGUE.house.puzzle.solved);
        await setScene(false);
        await say(DIALOGUE.house.leaving);

      } else {
        await say(DIALOGUE.bench.approach);
        await runPuzzle(stage);
        await say(DIALOGUE.bench.puzzle.solved);
      }

      await setColor(stage.colorAfter);

      index++;
      busy = false;

      if (index >= STAGES.length) {
        finished = true;
        onFinished();
      }
    },
  };
}
