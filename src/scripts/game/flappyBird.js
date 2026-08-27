import { asset } from "./paths.js";
import { rectsOverlap } from "./rules.js";
import { state } from "./state.js";
import { Bird } from "./sprites/bird.js";
import { Enemy } from "./sprites/enemy.js";
import { Obstacle } from "./sprites/obstacle.js";
import {
  drawDigits,
  drawPlayButton,
  GAME_OVER_RECT,
  gameOverImg,
  RESTART_RECT,
} from "./ui.js";

// Sound effects. bulletSound is exported because the keyboard handler in
// init.js fires it at the moment a shot is created.
const attackSound = new Audio(asset("audio/attack.mp3"));
attackSound.volume = 0.8;
export const bulletSound = new Audio(asset("audio/bullet.mp3"));
bulletSound.volume = 0.8;
const winSound = new Audio(asset("audio/win.mp3"));
winSound.volume = 0.7;
const overSound = new Audio(asset("audio/over.mp3"));
overSound.volume = 0.7;

// The three arrays below used to sit on the prototype, where they would be
// shared by every FlappyBird ever created — harmless while there is exactly
// one, and a confusing bug the moment there isn't.
export class FlappyBird {
  constructor() {
    this.bird = null;
    this.bg = null;

    this.obs = null;
    this.obsList = [];

    this.bullet = null;
    this.bulletList = [];

    this.enemy = null;
    this.enemyList = [];
    this.enemyCount = 0; // obstacles seen since the last enemy was spawned

    this.score = 0;
    this.touch = false; // pointer is held down
    this.spaceTouch = false; // a shot is in flight
    this.gameOver = false;
    this.gameWin = false;

    // Set per level from the level table.
    this.bulletLimitCount = 0;
    this.enemyLimitCount = 0;
    this.enemyIntervalCount = 0;
    this.scoreLimitCount = 0;

    // Tuning constants.
    this.mapWidth = 800;
    this.mapHeight = 600;

    this.startX = 360; // the bird never moves horizontally
    this.startY = 260;

    this.obsDistance = 200; // the gap between an obstacle pair
    this.obsSpeed = 2; // obstacle travel speed, i.e. how fast the bird flies
    this.upSpeed = 8;
    this.downSpeed = 3;

    this.obsInterval = 6000; // ms between obstacle pairs

    this.bulletSpeed = 10;

    this.level = 100; // ground height
  }

  // Load this level's images and lay out the opening screen.
  CreateMap() {
    // Arriving in the easter-egg level carries the score across; any other
    // level starts from zero.
    if (
      (state.curStage.jump[0].to === 3 || state.curStage.jump[0].to === 4) &&
      state.isJump
    ) {
      this.score = state.score3JumpTemp;
    } else {
      this.score = 0;
    }

    this.bg = new Image();
    this.bg.onerror = function () {
      console.log("failed to load a game image");
    };
    this.bg.src = state.gameBgSrc;

    const img = new Image();
    img.onload = function () {
      if (!state.isJump) {
        this.bird = new Bird(this.startX, this.startY, img);
      }
    }.bind(this);
    img.src = state.birdBgSrc;

    if (this.bulletLimitCount !== 0) {
      this.bullet = new Image();
      this.bullet.src = asset("img/bullet.png");
    }

    this.obs = new Image();
    // Jumping between levels keeps the obstacles already on screen.
    if (!state.isJump) {
      this.obs.onload = function () {
        const h = 200; // height of the first hanging obstacle
        const h2 = this.mapHeight - h - this.obsDistance;
        const obs1 = new Obstacle(this.mapWidth, 0, h, this.obs);
        const obs2 = new Obstacle(this.mapWidth, this.mapHeight - h2, h2, this.obs);
        this.obsList.push(obs1);
        this.obsList.push(obs2);
      }.bind(this);
    }
    this.obs.src = state.obsImgSrc;

    if (this.enemyLimitCount !== 0 && !state.isJump) {
      this.enemy = new Image();
      this.enemy.onload = function () {
        // Positioned in the gap of the first obstacle pair, whose h is 200.
        const enemyY = 200 + this.obsDistance / 2 - this.enemy.height;
        this.enemyList.push(new Enemy(this.mapWidth, enemyY, this.enemy));
        this.enemyLimitCount--;
      }.bind(this);
      this.enemy.src = asset("img/enemy.png");
    }
  }

  // Spawn the next obstacle pair, and an enemy every enemyIntervalCount pairs.
  CreateObs() {
    const h = Math.floor(
      Math.random() * (this.mapHeight - this.obsDistance - this.level) + 10,
    );
    const h2 = this.mapHeight - h - this.obsDistance;
    const obs1 = new Obstacle(this.mapWidth, 0, h, this.obs);
    const obs2 = new Obstacle(this.mapWidth, this.mapHeight - h2, h2, this.obs);
    this.obsList.push(obs1);
    this.obsList.push(obs2);
    // Drop the pair that has left the screen.
    if (this.obsList[0].x < -this.obsList[0].width) {
      this.obsList.splice(0, 2);
    }

    if (this.enemyLimitCount > 0) {
      this.enemyCount++;
      if (this.enemyCount >= this.enemyIntervalCount) {
        const enemyY = h + this.obsDistance / 2 - this.enemy.height;
        this.enemyList.push(new Enemy(this.mapWidth, enemyY, this.enemy));
        this.enemyCount = 0;
        this.enemyLimitCount--;
      }
      if (
        this.enemyList[0] != null &&
        !this.enemyList[0].defeat &&
        this.enemyList[0].x < -this.enemyList[0].width
      ) {
        this.enemyList.splice(0, 1);
      }
    }
  }

  // `step` is how much of one original tick this frame covers; every speed
  // below is per-tick, so multiplying keeps the game's pace independent of
  // the refresh rate.
  DrawObs(step) {
    for (let i = 0; i < this.obsList.length; i++) {
      this.obsList[i].x -= this.obsSpeed * step;
      // The list alternates hanging, standing, hanging, standing.
      this.obsList[i].draw(state.ctx, i % 2 ? "up" : "down");
    }
  }

  DrawEnemy(step) {
    for (let i = 0; i < this.enemyList.length; i++) {
      if (!this.enemyList[i].defeat) {
        this.enemyList[i].x -= this.obsSpeed * step;
        // Bob up and down as it travels. The offset is added per frame, so it
        // scales with step like any other movement.
        this.enemyList[i].y =
          this.enemyList[i].y +
          4 * Math.sin((Math.PI / 15) * this.enemyList[i].x) * step;
        this.enemyList[i].draw(state.ctx);
      }
    }
  }

  DrawBullet(step) {
    this.bulletList[0].draw(state.ctx);
    this.bulletList[0].x += this.bulletSpeed * step;
    // Drop it once it leaves the screen, which frees the next shot.
    if (this.bulletList[0] != null && this.bulletList[0].x >= this.mapWidth) {
      this.bulletList.splice(0, 1);
      this.spaceTouch = false;
    }
  }

  ShowBullet() {
    const ctx = state.ctx;
    ctx.save();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#fff";
    ctx.font = "35px sans-serif";
    ctx.fillText("Ammo: " + this.bulletLimitCount, 24, 95);
    ctx.strokeText("Ammo: " + this.bulletLimitCount, 24, 95);
    ctx.restore();
  }

  CountScore() {
    // Obstacles that leave the screen are destroyed, so at most two pairs are
    // ever to the left of the bird — checking the first and third is enough.
    if (
      this.obsList[0].x + this.obsList[0].width < this.startX &&
      this.obsList[0].flypast === false
    ) {
      this.score += 1;
      this.obsList[0].flypast = true;
    }
    if (
      this.obsList[2] != null &&
      this.obsList[2].x + this.obsList[2].width < this.startX &&
      this.obsList[2].flypast === false
    ) {
      this.score += 1;
      this.obsList[2].flypast = true;
    }

    // A bullet that reaches an enemy destroys it and scores a point. Same
    // rectangle test as the bird's collisions — this was the last copy of the
    // four-corner version, and it had the same blind spot.
    const bullet = this.bulletList[0];
    if (this.spaceTouch && bullet != null) {
      const hit = this.enemyList.findIndex((enemy) =>
        rectsOverlap(bullet, enemy),
      );
      if (hit !== -1) {
        this.score += 1;
        this.enemyList.splice(hit, 1);
        this.bulletList.splice(0, 1);
        this.spaceTouch = false;
        attackSound.currentTime = 0;
        attackSound.play();
        state.jumpEnemyCount--;
      } else if (
        // The shot has travelled past an enemy without connecting: retire it
        // so the player gets their next round back.
        this.enemyList.some((enemy) => bullet.x >= enemy.x + enemy.width)
      ) {
        this.bulletList.splice(0, 1);
        this.spaceTouch = false;
      }
    }

    if (this.score === this.scoreLimitCount) {
      this.gameWin = true;
    }
  }

  ShowScore() {
    drawDigits(state.ctx, this.score, 24, 20, 2);
  }

  // Collision detection: the bird against the ceiling, the floor, every enemy
  // and every obstacle. The rectangle test lives in rules.js — see the note
  // there on why the four-corner version it replaces let the bird fly through
  // the middle of a cactus.
  CanMove() {
    if (this.bird.y < 0 || this.bird.y > this.mapHeight - this.bird.height) {
      this.gameOver = true;
      return;
    }

    for (let w = 0; w < this.enemyList.length; w++) {
      if (rectsOverlap(this.bird, this.enemyList[w])) {
        this.gameOver = true;
        return;
      }
    }

    for (let i = 0; i < this.obsList.length; i++) {
      if (rectsOverlap(this.bird, this.obsList[i])) {
        this.gameOver = true;
        return;
      }
    }
  }

  // Apply the pointer state to the bird and draw it.
  CheckTouch(step) {
    if (this.touch) {
      this.bird.y -= this.upSpeed * step;
      this.bird.draw(state.ctx, this.spaceTouch ? "attack" : "up");
    } else {
      this.bird.y += this.downSpeed * step;
      this.bird.draw(state.ctx, this.spaceTouch ? "attack" : "down");
    }
    if (this.spaceTouch) {
      this.DrawBullet(step);
    }
  }

  // Redrawing the background is what clears the previous frame.
  ClearScreen() {
    state.ctx.drawImage(this.bg, 0, 0);
  }

  // Both end screens show the play icon again rather than naming a key. It is
  // the same control the player already used to start, so it needs no caption.
  ShowOver() {
    const ctx = state.ctx;
    overSound.currentTime = 0;
    overSound.play();
    ctx.drawImage(gameOverImg, GAME_OVER_RECT.x, GAME_OVER_RECT.y,
      GAME_OVER_RECT.width, GAME_OVER_RECT.height);
    drawPlayButton(ctx, RESTART_RECT);
  }

  ShowWin() {
    const ctx = state.ctx;
    winSound.currentTime = 0;
    winSound.play();
    // No asset was supplied for this one, so it stays as drawn text. "You Win"
    // is a status word, not an instruction.
    const x = this.mapWidth / 2 - 140;
    const y = this.mapHeight / 2 - 20;
    ctx.save();
    ctx.strokeStyle = "#DC143C";
    ctx.lineWidth = 0.25;
    ctx.fillStyle = "#fff";
    ctx.font = "900 oblique 90px sans-serif";
    ctx.fillText("You Win", x, y);
    ctx.strokeText("You Win", x, y);
    ctx.restore();
    drawPlayButton(ctx, RESTART_RECT);
  }
}
