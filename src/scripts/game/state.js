// State the original game kept as bare `var`s shared across seven <script>
// tags. Two of those files write values the other one reads, so as ES modules
// they can't simply import from each other: an imported binding is read-only
// in the importing module, and the dependency runs both ways. Everything
// mutable that crosses a module boundary therefore hangs off this one object.
export const state = {
  /** @type {HTMLCanvasElement|null} */
  canvas: null,
  /** @type {CanvasRenderingContext2D|null} */
  ctx: null,

  // Which screen is showing (was IsHome / IsSlect / IsPlay / IsJump).
  isHome: true,
  isSelect: false,
  isPlay: false,
  isJump: false,

  // The level being played (was curStage / curIndex). flappyBird.js reads
  // these to decide whether a level change should carry the score over.
  curStage: null,
  curIndex: null,

  // Per-level image paths: init.js writes them, flappyBird.js reads them.
  gameBgSrc: "",
  birdBgSrc: "",
  obsImgSrc: "",

  // Easter-egg counters: flappyBird.js decrements, init.js tests and resets.
  jumpEnemyCount: 3,
  score3JumpTemp: 0,
};

export function setCanvas(canvas) {
  state.canvas = canvas;
  state.ctx = canvas.getContext("2d");
}
