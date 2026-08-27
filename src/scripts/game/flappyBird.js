import { asset } from "./paths.js";
import {
  enemyInFiringLine,
  nextPairTrick,
  pickPairIndices,
  rectHitsMask,
  rectsOverlap,
} from "./rules.js";
import { state } from "./state.js";
import { Bird } from "./sprites/bird.js";
import { Bullet } from "./sprites/bullet.js";
import { Enemy } from "./sprites/enemy.js";
import { Obstacle } from "./sprites/obstacle.js";
import {
  centerText,
  drawDigits,
  drawPlayButton,
  GAME_OVER_RECT,
  font,
  gameOverImg,
  RESTART_RECT,
} from "./ui.js";

// Sound effects.
const attackSound = new Audio(asset("audio/attack.mp3"));
attackSound.volume = 0.8;
const bulletSound = new Audio(asset("audio/bullet.mp3"));
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
    this.fireRange = 420; // how far ahead auto-fire will engage

    this.level = 100; // ground height

    // Difficulty pacing, replaced per level from the table's `pacing` block.
    this.narrowBy = 20;
    this.firstRandomPair = 1;
    this.pairIndex = 0;
    this.narrowAt = [];
    this.closingAt = [];
  }

  // Decides up front which pairs get a shortened gap and which start normal
  // and squeeze shut as the bird nears. Called once per level.
  PlanSpecialPairs(pacing, targetScore) {
    // Roughly one pair per point, plus a little headroom for pairs skipped
    // because they carry an enemy.
    const span = targetScore + 3;
    const picks = pickPairIndices(
      pacing.narrowGaps + pacing.closingGaps,
      pacing.firstRandom,
      span,
    );
    const ascending = (a, b) => a - b;
    this.narrowAt = picks.slice(0, pacing.narrowGaps).sort(ascending);
    this.closingAt = picks.slice(pacing.narrowGaps).sort(ascending);
    this.pairIndex = 0;
  }

  // Pairs marked closing start at a normal gap and tighten as the bird gets
  // close, so the player has to react to the gap rather than read it from the
  // far side of the screen.
  UpdateClosingPairs() {
    const from = this.startX + 340;
    const to = this.startX;
    for (let i = 0; i + 1 < this.obsList.length; i += 2) {
      const top = this.obsList[i];
      const bottom = this.obsList[i + 1];
      if (!top.closing) {
        continue;
      }
      const progress = Math.min(1, Math.max(0, (from - top.x) / (from - to)));
      const shrink = (top.closing * progress) / 2;
      top.height = top.baseHeight + shrink;
      bottom.height = bottom.baseHeight + shrink;
      bottom.y = this.mapHeight - bottom.height;
    }
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
        const obs1 = new Obstacle(this.mapWidth, 0, h, this.obs, "down");
        const obs2 = new Obstacle(this.mapWidth, this.mapHeight - h2, h2, this.obs, "up");
        obs1.closing = 0;
        obs1.baseHeight = h;
        obs2.baseHeight = h2;
        this.obsList.push(obs1);
        this.obsList.push(obs2);
        this.pairIndex = 0;
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
    this.pairIndex++;

    // A pair that also carries an enemy is left alone: two hazards at once is
    // not a step up in difficulty, it is a wall.
    const carriesEnemy =
      this.enemyLimitCount > 0 &&
      this.enemyCount + 1 >= this.enemyIntervalCount;

    let gap = this.obsDistance;
    let closing = 0;
    const trick = nextPairTrick(
      this.pairIndex,
      this.firstRandomPair,
      carriesEnemy,
      this.narrowAt,
      this.closingAt,
    );
    if (trick === "narrow") {
      this.narrowAt.shift();
      gap -= this.narrowBy;
    } else if (trick === "closing") {
      this.closingAt.shift();
      closing = this.narrowBy;
    }

    const h = Math.floor(
      Math.random() * (this.mapHeight - gap - this.level) + 10,
    );
    const h2 = this.mapHeight - h - gap;
    const obs1 = new Obstacle(this.mapWidth, 0, h, this.obs, "down");
    const obs2 = new Obstacle(this.mapWidth, this.mapHeight - h2, h2, this.obs, "up");
    obs1.closing = closing;
    obs1.baseHeight = h;
    obs2.baseHeight = h2;
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
      this.obsList[i].draw(state.ctx);
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

  // Shooting happens on its own when an enemy lines up ahead of the bird.
  // It used to be the A key, which the home screen explained in a block of
  // text the brief forbids. Removing the text left a control nobody could
  // discover and that a touch device cannot press at all, which also made the
  // easter-egg level unreachable. Firing is now something the game does for
  // you: the ammo count is the only thing the player has to read, and it
  // reads as a number going down.
  AutoFire() {
    if (
      this.bulletLimitCount <= 0 || // out of ammo
      this.bulletList.length > 0 || // one shot in flight at a time
      this.bird == null ||
      this.bullet == null ||
      !this.bullet.complete
    ) {
      return;
    }

    const muzzleX = this.bird.x + this.bird.width;
    const muzzleY = this.bird.y + this.bird.height / 2;
    const shot = {
      x: muzzleX,
      y: muzzleY,
      width: this.bullet.width,
      height: this.bullet.height,
    };

    // The decision itself lives in rules.js, where it can be tested without a
    // canvas: it fires within a frame or two of a level starting, which is
    // far too fast to catch reliably by driving a browser.
    if (!enemyInFiringLine(
        shot,
        this.enemyList.map((enemy) => enemy.hitbox()),
        this.fireRange,
      )) {
      return;
    }

    this.bulletList.push(new Bullet(muzzleX, muzzleY, this.bullet));
    this.bulletLimitCount -= 1;
    this.spaceTouch = true;
    bulletSound.currentTime = 0;
    bulletSound.play();
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
    ctx.font = font(12);
    ctx.fillStyle = "rgba(60,40,20,0.55)";
    ctx.fillText("AMMO " + this.bulletLimitCount, 28, 111);
    ctx.fillStyle = "#fff";
    ctx.fillText("AMMO " + this.bulletLimitCount, 27, 110);
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
        rectsOverlap(bullet, enemy.hitbox()),
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
        this.enemyList.some((enemy) => {
        const box = enemy.hitbox();
        return bullet.x >= box.x + box.width;
      })
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
    drawDigits(state.ctx, this.score, 26, 22, 3);
  }

  // Collision detection: the bird against the ceiling, the floor, every enemy
  // and every obstacle. The rectangle test lives in rules.js — see the note
  // there on why the four-corner version it replaces let the bird fly through
  // the middle of a cactus.
  CanMove() {
    const bird = this.bird.hitbox();

    if (bird.y < 0 || bird.y + bird.height > this.mapHeight) {
      this.gameOver = true;
      return;
    }

    for (let w = 0; w < this.enemyList.length; w++) {
      if (rectsOverlap(bird, this.enemyList[w].hitbox())) {
        this.gameOver = true;
        return;
      }
    }

    for (let i = 0; i < this.obsList.length; i++) {
      const obstacle = this.obsList[i];
      const mask = obstacle.mask();
      // Outline where the pixels are known, box until the sheet has loaded.
      const hit =
        mask == null
          ? rectsOverlap(bird, obstacle)
          : rectHitsMask(bird, mask);
      if (hit) {
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
    ctx.save();
    ctx.font = font(34);
    ctx.lineWidth = 0;
    ctx.fillStyle = "rgba(70,35,15,0.4)";
    centerText(ctx, "YOU WIN", this.mapWidth / 2 + 3, 263);
    ctx.fillStyle = "#fff";
    centerText(ctx, "YOU WIN", this.mapWidth / 2, 260);
    ctx.restore();
    drawPlayButton(ctx, RESTART_RECT);
  }
}
