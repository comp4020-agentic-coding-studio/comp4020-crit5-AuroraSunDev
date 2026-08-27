import { bulletSound, FlappyBird } from "./flappyBird.js";
import { levels } from "./levels.js";
import { asset } from "./paths.js";
import { setCanvas, state } from "./state.js";
import { Bullet } from "./sprites/bullet.js";
import {
  breathe,
  drawPlayButton,
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

const game = new FlappyBird();
// Whether this level issues ammo at all, and so whether to draw the count.
let levelHasAmmo = false;
let Speed; // ms between frames, per level

export function initGame(canvas) {
  setCanvas(canvas);

  startBG.src = asset("img/GameStartBG1.png");
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
    if (state.isHome) {
      RunHomeLoop();
    }
  };
  startBG.onerror = function () {
    console.log("failed to load a game image");
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
  window.addEventListener("keydown", HandleKeyDown, false);
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
  if (!state.isSelect && state.isHome) {
    HomeClick();
  }
  if (!state.isPlay && state.isSelect && mousePos != null) {
    Select();
  }
  // An end screen: the same play icon restarts. Without this a mouse- or
  // touch-only player who reaches Game Over can only get a second go by
  // knowing about the Enter key, which is an instruction nobody gave them.
  if ((game.gameOver || game.gameWin) && mousePos != null) {
    if (hits(RESTART_RECT, mousePos)) {
      location.reload();
    }
  }
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
      game.ShowOver();
      state.isPlay = false;
      return;
    }
    if (game.gameWin) {
      sound.pause();
      game.ShowWin();
      state.isPlay = false;
      if (!state.curStage.IsCleared[0].flag) {
        state.curStage.IsCleared[0].flag = true;
        SaveLocal(state.curIndex, state.curStage.IsCleared[0].flag);
      }
      return;
    }

    sinceLastObs += elapsed;
    if (sinceLastObs >= game.obsInterval) {
      sinceLastObs -= game.obsInterval;
      game.CreateObs();
    }

    // Clear, then draw, then update.
    game.ClearScreen();
    game.DrawObs(step);
    if (game.enemyLimitCount >= 0) {
      game.DrawEnemy(step);
    }
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
function CheckJump(cStage) {
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
      break;
    }
  }
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
  ctx.strokeStyle = "rgb(160,82,45)";
  ctx.lineWidth = 0.5;
  ctx.fillStyle = "#fff";
  ctx.font = "900 oblique 120px sans-serif";
  ctx.fillText("DesertBird", 145, 140);
  ctx.strokeText("DesertBird", 145, 140);
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

function DrawGameLevel(i, img, x, y, levelStr, difficultyStr, scoreStr) {
  const ctx = state.ctx;

  // Cleared marker.
  ctx.save();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 0.25;
  ctx.fillStyle = "#D2691E";
  ctx.font = "30px sans-serif";
  const clearedStr = FindLocal(i) ? "Cleared" : "Not cleared";
  ctx.fillText(clearedStr, x + 25, y - 10);
  ctx.strokeText(clearedStr, x + 25, y - 10);
  ctx.restore();

  // Tile background.
  ctx.save();
  ctx.drawImage(levelBGImg, x, y);
  ctx.restore();

  // The level's bird.
  ctx.save();
  ctx.drawImage(img, 0, 0, (img.width / 3) * 2, img.height,
    x + 20, y + 20, 128 - 40, 128 - 40);
  ctx.restore();

  // Level name.
  ctx.save();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 0.25;
  ctx.fillStyle = "#8B4513";
  ctx.font = "35px sans-serif";
  ctx.fillText(levelStr, x + 5, y + 160);
  ctx.strokeText(levelStr, x + 5, y + 160);
  ctx.restore();

  // Difficulty.
  ctx.save();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 0.25;
  ctx.fillStyle = "#D2691E";
  ctx.font = "30px sans-serif";
  ctx.fillText(difficultyStr, x + 30, y + 200);
  ctx.strokeText(difficultyStr, x + 30, y + 200);
  ctx.restore();

  // Target score.
  ctx.save();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 0.25;
  ctx.fillStyle = "#D2691E";
  ctx.font = "30px sans-serif";
  ctx.fillText(scoreStr, x - 5, y + 230);
  ctx.strokeText(scoreStr, x - 5, y + 230);
  ctx.restore();
}

function SaveLocal(i, flag) {
  localStorage.setItem(i, flag);
}

function FindLocal(i) {
  if (localStorage.getItem(i) != undefined) {
    return localStorage.getItem(i);
  }
  return null;
}

function HandleKeyDown(e) {
  if (e.keyCode == "65") {
    // A fires. Creating the bullet here puts it at the bird's beak.
    if (game.bulletLimitCount > 0) {
      game.spaceTouch = true;
      // Only one shot at a time: wait for the last one to be destroyed.
      if (game.bulletList[0] == null) {
        const bullet1 = new Bullet(
          game.bird.x + game.bird.width,
          game.bird.y + game.bird.height / 2,
          game.bullet,
        );
        game.bulletList.push(bullet1);
        game.bulletLimitCount -= 1;
        bulletSound.currentTime = 0;
        bulletSound.play();
      }
    }
  }
}

function HandleKeyPress(e) {
  if (e.keyCode == "13" || e.keyCode == "108") {
    if (game.gameOver || game.gameWin) {
      location.reload();
    }
  }
}
