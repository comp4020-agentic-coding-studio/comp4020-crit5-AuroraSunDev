import { FlappyBird } from "./flappyBird.js";
import { endless, levels } from "./levels.js";
import { asset } from "./paths.js";
import { setCanvas, state } from "./state.js";
import {
  breathe,
  centerText,
  CHOICE_HOME_RECT,
  CHOICE_PLAY_RECT,
  drawPlayButton,
  drawPressPrompt,
  font,
  hits,
  HOME_PLAY_RECT,
  READY_RECT,
  readyImg,
  RESTART_RECT,
} from "./ui.js";

// Background music.
const sound = new Audio(asset("audio/bgsound.wav"));
sound.volume = 0.4;

// Level-select screen.
let mousePos = null;
const startBG = new Image();
const levelBGImg = new Image();
const level1Img = new Image();
const level2Img = new Image();
const level3Img = new Image();
const levelXY = [
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
];

// Where the next load should land: read once at startup, then forgotten, so
// it can only ever act on the reload that set it. A restart after a level
// ends goes back to the level tiles rather than all the way to the title —
// the player already chose a level once, and Game Over is not the moment to
// make them choose the game itself again. The very first visit, and the
// house icon on a two-button screen, are deliberately not this path, so
// they still land on the title.
const START_AT_KEY = "desertbird:startAt";
let startAt = null;
let bgReady = false;
let levelBgReady = false;

function ReloadToSelect() {
  try {
    sessionStorage.setItem(START_AT_KEY, "select");
  } catch {
    // Storage can be unavailable (private mode, a locked-down browser); the
    // worst outcome is landing on the title, which is what happened before.
  }
  location.reload();
}

// Fires once both the images the select screen itself draws are in, and only
// if a restart asked for this screen specifically. Gated on two images
// rather than one: the level thumbnails always have a running start (the
// player saw them once already, to have reached Game Over at all), but this
// screen also draws the desert title background and the tile chrome, so both
// have to be ready before painting over what CreateMap's own background load
// might otherwise still have on screen for a frame.
function MaybeEnterSelectDirectly() {
  if (startAt !== "select" || !bgReady || !levelBgReady) {
    return;
  }
  startAt = null;
  state.isSelect = true;
  state.isHome = false;
  state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
  DrawSelect();
}

const game = new FlappyBird();
// Whether this level issues ammo at all, and so whether to draw the count.
let levelHasAmmo = false;
let Speed; // ms between frames, per level
// Set while a screen is showing two buttons rather than one: level 3's win
// screen, and the end of an endless run. Null the rest of the time, so the
// single-button end screens keep hit-testing against their own rect.
let choiceScreen = null;
// True from the moment Level 1 is chosen until the first tap: the level's
// world is loaded and on screen, but CreateObs/RunGame have not started, so
// nothing can fall out of the sky before the player has done anything.
let awaitingClickToStart = false;

export function initGame(canvas) {
  setCanvas(canvas);

  // Single-use: whatever this load finds, no later reload should see it
  // again unless something sets it again first.
  try {
    startAt = sessionStorage.getItem(START_AT_KEY);
    sessionStorage.removeItem(START_AT_KEY);
  } catch {
    startAt = null;
  }

  startBG.src = asset("img/GameStartBG1.jpg");
  level1Img.src = levels[1].imgSrc[0].birdSrc;
  level2Img.src = levels[2].imgSrc[0].birdSrc;
  level3Img.src = levels[3].imgSrc[0].birdSrc;
  levelBGImg.src = asset("img/levelBG.png");

  levelXY[0].x = 100;
  levelXY[0].y = 240;
  levelXY[1].x = levelXY[0].x + 128 + 110;
  levelXY[1].y = levelXY[0].y;
  levelXY[2].x = levelXY[1].x + 128 + 110;
  levelXY[2].y = levelXY[0].y;

  startBG.onload = function () {
    bgReady = true;
    if (startAt === "select") {
      MaybeEnterSelectDirectly();
    } else if (state.isHome) {
      RunHomeLoop();
    }
  };
  startBG.onerror = function () {
    console.log("failed to load a game image");
  };
  levelBGImg.onload = function () {
    levelBgReady = true;
    MaybeEnterSelectDirectly();
  };

  canvas.onmousedown = function (e) {
    PointerDown(e.clientX, e.clientY);
  };
  canvas.onmouseup = PointerUp;
  canvas.onclick = HandlePrimaryTap;

  // Touch mirrors the mouse. touchstart is passive because `touch-action:
  // none` in the stylesheet already stops the browser scrolling or zooming;
  // touchend is not, because it has to suppress the synthetic click that
  // would otherwise run HandlePrimaryTap a second time.
  canvas.addEventListener(
    "touchstart",
    function (e) {
      const touch = e.changedTouches[0];
      PointerDown(touch.clientX, touch.clientY);
    },
    { passive: true },
  );
  canvas.addEventListener(
    "touchend",
    function (e) {
      e.preventDefault();
      PointerUp();
      HandlePrimaryTap();
    },
    { passive: false },
  );
  canvas.addEventListener("touchcancel", PointerUp, { passive: true });

  window.addEventListener("keypress", HandleKeyPress, false);
}

// Press and release drive the bird: held means climb, released means fall.
function PointerDown(clientX, clientY) {
  game.touch = true;
  if (!state.isPlay) {
    mousePos = GetPointerPos(clientX, clientY);
  }
}

function PointerUp() {
  game.touch = false;
}

// The one place a tap is acted on, shared by mouse click and touchend so the
// two input paths can never drift apart.
function HandlePrimaryTap() {
  // The tap that ends the Level 1 prompt: it can land anywhere on the
  // canvas, unlike every other tap here, which is checked against a rect.
  if (awaitingClickToStart) {
    awaitingClickToStart = false;
    BeginRunning();
    return;
  }
  if (!state.isSelect && state.isHome) {
    HomeClick();
  }
  if (!state.isPlay && state.isSelect && mousePos != null) {
    Select();
  }
  // A screen with two answers: the house goes home, the arrow keeps going.
  // Checked before the single-button case because both are drawn while
  // gameOver or gameWin is set.
  if (choiceScreen != null && mousePos != null) {
    if (hits(CHOICE_HOME_RECT, mousePos)) {
      location.reload(); // a reload lands on the home screen
    } else if (hits(CHOICE_PLAY_RECT, mousePos)) {
      // Resuming from the win keeps the fifteen points that got you here;
      // going again after an endless run ended starts a new one from nothing.
      const keepScore = choiceScreen === "win";
      choiceScreen = null;
      StartEndless(keepScore);
    }
    return;
  }
  // An end screen: the same play icon restarts. Without this a mouse- or
  // touch-only player who reaches Game Over can only get a second go by
  // knowing about the Enter key, which is an instruction nobody gave them.
  // It lands on the level tiles, not the title: the player already chose a
  // level once to get here.
  if ((game.gameOver || game.gameWin) && mousePos != null) {
    if (hits(RESTART_RECT, mousePos)) {
      ReloadToSelect();
    }
  }
}

// The endless run: level 3's pacing with the target taken off it and every
// dial still turning. Started from the win screen, or from the end of a
// previous run.
function StartEndless(keepScore) {
  if (!keepScore) {
    game.score = 0;
  }
  game.EnterEndless(endless);
  state.jumpEnemyCount = 3; // unused while endless, but not left at zero
  levelHasAmmo = true;
  state.isPlay = true;
  state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
  sound.currentTime = 0;
  sound.play();
  RunGame(Speed);
}

// Apply a level's data to the running game.
function InitScript(stage) {
  state.gameBgSrc = stage.imgSrc[0].gameSrc;
  state.birdBgSrc = stage.imgSrc[0].birdSrc;
  state.obsImgSrc = stage.imgSrc[0].obsSrc;

  game.bulletLimitCount = stage.num[0].bulletC; // 0 means no shooting
  game.enemyLimitCount = stage.num[0].enemyC; // 0 means no enemies
  game.enemyIntervalCount = stage.num[0].enemyIC; // obstacles between enemies
  game.scoreLimitCount = stage.num[0].scoreC; // score that wins the level

  levelHasAmmo = stage.num[0].bulletC > 0;
  Speed = stage.IntervalSpeed[0].ITVSpeed;

  // Difficulty: how fast the world moves, how far one press throws the bird,
  // how far apart the pairs start, and which of them get a shortened or a
  // snapping gap.
  const pacing = stage.pacing;
  game.pacing = pacing;
  game.endless = false;
  game.progressBase = 0;
  game.nextAmmoAt = Infinity;
  game.obsSpeed = pacing.obsSpeed;
  game.upSpeed = pacing.upSpeed;
  game.downSpeed = pacing.downSpeed;
  game.firstRandomPair = pacing.firstRandom;
  // The enemy count matters to the plan: a point comes from a kill as well as
  // from a pair, so a level with enemies reaches its target in fewer pairs
  // than its target score suggests.
  game.PlanSpecialPairs(pacing, stage.num[0].scoreC, stage.num[0].enemyC);
}

// The loop runs on requestAnimationFrame rather than a fixed setInterval, so
// it draws at the display's refresh rate instead of a hard 33fps and stops
// when the tab is hidden. Frame rate must not become game speed, so every
// movement is scaled by `step`: the fraction of one original tick that this
// frame actually covered. step === 1 reproduces the old cadence exactly.
function RunGame(speed) {
  let last = performance.now();
  let sinceLastObs = 0;

  const frame = function (now) {
    // A backgrounded tab or a slow first paint can hand back a huge delta.
    // Clamping stops the bird teleporting through an obstacle on the frame
    // after the player switches back.
    const elapsed = Math.min(now - last, 100);
    last = now;
    const step = elapsed / speed;

    // CreateMap builds the bird and the first obstacle pair from image loads,
    // so the first frame can arrive before either exists — CountScore reads
    // obsList[0] unguarded. The old fixed 30ms tick usually gave the images
    // just enough time to win the race; a rAF frame at ~16ms does not, and
    // cactus.png is 130KB and not preloaded by the level-select screen.
    if (!game.bird || game.obsList.length === 0) {
      requestAnimationFrame(frame);
      return;
    }

    game.CanMove();
    if (game.gameOver) {
      sound.pause();
      state.isPlay = false;
      // An endless run cannot be lost, because there was nothing to win. It
      // gets its score, not a banner saying it failed.
      if (game.endless) {
        game.ShowFinalScore();
        choiceScreen = "over";
      } else {
        game.ShowOver();
      }
      return;
    }
    if (game.gameWin) {
      sound.pause();
      const offerEndless = state.curStage.endless === true;
      game.ShowWin(offerEndless);
      choiceScreen = offerEndless ? "win" : null;
      state.isPlay = false;
      if (!state.curStage.IsCleared[0].flag) {
        state.curStage.IsCleared[0].flag = true;
        SaveLocal(state.curIndex, state.curStage.IsCleared[0].flag);
      }
      return;
    }

    // Obstacle density is not a fixed count per level: the interval is read
    // back every frame from the current score, so the field keeps closing up
    // for as long as the player keeps scoring.
    sinceLastObs += elapsed;
    const interval = game.PairIntervalMs(speed);
    if (sinceLastObs >= interval) {
      sinceLastObs -= interval;
      game.CreateObs();
    }

    // Clear, then draw, then update.
    game.ClearScreen();
    game.UpdateSnapPairs();
    game.DrawObs(step);
    if (game.enemyLimitCount >= 0) {
      game.DrawEnemy(step);
    }
    game.AutoFire();
    game.CheckTouch(step);
    game.CountScore();
    game.ShowScore();

    CheckJump(state.curStage);

    if (levelHasAmmo) {
      game.ShowBullet();
    }

    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}

// The canvas is displayed at whatever size fits the viewport, but every
// hit-test in this file is written against the fixed 800x600 drawing buffer.
// Converting here is what keeps a tap landing where it looks like it landed;
// without the scale factor the buttons quietly stop responding as soon as the
// display size differs from 800x600.
function GetPointerPos(clientX, clientY) {
  const canvas = state.canvas;
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height),
  };
}

// The easter egg: kill jumpEnemyCount enemies and the level swaps under you.
//
// Switched off during an endless run. Being yanked into level 4 is an ending
// of sorts — a new level, a new target — and not stopping is the whole of
// what that mode is.
function CheckJump(cStage) {
  if (game.endless) {
    return;
  }
  if (state.jumpEnemyCount === 0) {
    state.isJump = true;
  }
  if (state.isJump) {
    // Jumping between levels 3 and 4 keeps accumulating the same score.
    if (cStage.jump[0].to === 4 || cStage.jump[0].to === 3) {
      state.score3JumpTemp = game.score;
    }
    const jumpStage = levels[cStage.jump[0].to];
    state.curIndex = cStage.jump[0].to;
    InitScript(jumpStage);
    state.curStage = jumpStage;
    game.CreateMap();
    state.jumpEnemyCount = 3;
    state.isJump = false;
  }
}

// Home screen: tapping the play icon opens level select.
function HomeClick() {
  if (hits(HOME_PLAY_RECT, mousePos)) {
    state.isSelect = true;
    state.isHome = false; // also stops the home screen's frame loop
    state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
    DrawSelect();
  }
}

// Level select: the tile positions match the order of the level table.
function Select() {
  for (let i = 0; i < levelXY.length; i++) {
    const betweenX =
      mousePos.x >= levelXY[i].x &&
      mousePos.x <= levelXY[i].x + levelBGImg.width;
    const betweenY =
      mousePos.y >= levelXY[i].y &&
      mousePos.y <= levelXY[i].y + levelBGImg.height;
    if (betweenX && betweenY) {
      state.curStage = levels[i + 1];
      state.curIndex = i + 1;
      InitScript(state.curStage);
      state.isSelect = false;
      state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
      if (!state.isPlay) {
        state.isPlay = true;
        game.CreateMap();
        // Level 1 is the one a stranger reaches with nothing behind them:
        // every other level is chosen by someone who has already survived
        // this one. Hold it on its opening frame until the first tap rather
        // than let gravity start working on a bird nobody has touched yet.
        if (i + 1 === 1) {
          awaitingClickToStart = true;
          RunAwaitingStart();
        } else {
          BeginRunning();
        }
      }
      break;
    }
  }
}

// Starts the obstacle clock and the frame loop for real, and the music with
// it. Shared by every level's ordinary start and by the tap that ends
// Level 1's prompt.
function BeginRunning() {
  RunGame(Speed);
  sound.addEventListener(
    "ended",
    function () {
      this.currentTime = 0;
      this.play();
    },
    false,
  );
  sound.play();
}

// Draws the level's own background and its bird, resting, under a dim
// click-and-mouse icon — nothing moves and nothing can end the run — until
// awaitingClickToStart is cleared by the first tap.
function RunAwaitingStart() {
  const frame = function (timestamp) {
    if (!awaitingClickToStart) {
      return;
    }
    // CreateMap's bird image load can still be in flight on the first frame.
    if (!game.bird) {
      requestAnimationFrame(frame);
      return;
    }
    game.ClearScreen();
    game.bird.draw(state.ctx, "down");
    drawPressPrompt(state.ctx, timestamp);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function DrawBG_Title() {
  const ctx = state.ctx;
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.drawImage(startBG, 0, 0);
  ctx.restore();
  DrawTitle();
}

function DrawTitle() {
  const ctx = state.ctx;
  ctx.save();
  ctx.font = font(46);
  // A soft drop shadow instead of an outline: at pixel-font weights a stroke
  // fills in the counters and the word turns to mush.
  ctx.fillStyle = "rgba(70,35,15,0.35)";
  centerText(ctx, "DesertBird", 403, 133);
  ctx.fillStyle = "#fff";
  ctx.lineWidth = 0;
  centerText(ctx, "DesertBird", 400, 130);
  ctx.restore();
}

// The home screen carries no instructions: the game's name, a status banner,
// and the play icon breathing to invite a tap. Everything else the player
// learns by playing.
function DrawHomePage(timestamp) {
  const ctx = state.ctx;
  ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
  DrawBG_Title();

  ctx.drawImage(readyImg, READY_RECT.x, READY_RECT.y,
    READY_RECT.width, READY_RECT.height);
  drawPlayButton(ctx, HOME_PLAY_RECT, breathe(timestamp));
}

// The breathing animation needs a frame loop, which the static screens did
// not. It stops itself as soon as the home screen is no longer showing.
function RunHomeLoop() {
  const frame = function (timestamp) {
    if (!state.isHome) {
      return;
    }
    DrawHomePage(timestamp);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// Three tiles, no caption. The bottom bar used to read "click the character
// you like to enter the level", which is an instruction; the tiles are the
// only thing on the screen and the player has already tapped once to get here.
function DrawSelect() {
  DrawBG_Title();

  DrawGameLevel("1", level1Img, levelXY[0].x, levelXY[0].y, "Level 1", "Easy",
    "Target " + levels[1].num[0].scoreC);
  DrawGameLevel("2", level2Img, levelXY[1].x, levelXY[1].y, "Level 2", "Harder",
    "Target " + levels[2].num[0].scoreC);
  DrawGameLevel("3", level3Img, levelXY[2].x, levelXY[2].y, "Level 3", "Hard",
    "Target " + levels[3].num[0].scoreC);
}

// Every label is centred on the tile by measurement rather than by a
// hand-tuned x offset, so nothing drifts when a string or the face changes.
function DrawGameLevel(i, img, x, y, levelStr, difficultyStr, scoreStr) {
  const ctx = state.ctx;
  const mid = x + 64; // tiles are 128 wide

  ctx.save();
  ctx.lineWidth = 0;

  // Cleared marker.
  ctx.font = font(10);
  ctx.fillStyle = FindLocal(i) ? "#3f7d20" : "rgba(90,60,40,0.75)";
  centerText(ctx, FindLocal(i) ? "CLEARED" : "NOT YET", mid, y - 14);

  // Tile background and the level's bird.
  ctx.drawImage(levelBGImg, x, y);
  ctx.drawImage(img, 0, 0, (img.width / 3) * 2, img.height,
    x + 20, y + 20, 128 - 40, 128 - 40);

  // Level name.
  ctx.font = font(15);
  ctx.fillStyle = "#6b3410";
  centerText(ctx, levelStr, mid, y + 162);

  // Difficulty and target score.
  ctx.font = font(11);
  ctx.fillStyle = "#9c5a24";
  centerText(ctx, difficultyStr, mid, y + 192);
  centerText(ctx, scoreStr, mid, y + 214);

  ctx.restore();
}

// Which levels have been cleared, kept in localStorage so the record survives
// the reload that the restart button performs.
function SaveLocal(i, flag) {
  localStorage.setItem(String(i), String(flag));
}

// Compares against "true" rather than returning the raw string: the stored
// value is text, so a stored "false" is every bit as truthy as "true" and
// would have shown a level as cleared when it wasn't.
function FindLocal(i) {
  return localStorage.getItem(String(i)) === "true";
}

function HandleKeyPress(e) {
  if (e.keyCode == "13" || e.keyCode == "108") {
    if (game.gameOver || game.gameWin) {
      ReloadToSelect();
    }
  }
}
