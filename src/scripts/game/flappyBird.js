import { asset } from "./paths.js";
import {
  enemyInFiringLine,
  enemyInterval,
  narrowChance,
  nextPairTrick,
  pairGap,
  pairIntervalMs,
  pairSpacing,
  pickPairIndices,
  randomGap,
  rectHitsMask,
  rectsOverlap,
  rollCloseBy,
  shortenGap,
  snapChance,
  snapProgress,
  trickSpan,
} from "./rules.js";
import { state } from "./state.js";
import { Bird } from "./sprites/bird.js";
import { Bullet, DISPLAY_SCALE as BULLET_SCALE } from "./sprites/bullet.js";
import { Enemy } from "./sprites/enemy.js";
import { Obstacle } from "./sprites/obstacle.js";
import {
  CHOICE_HOME_RECT,
  CHOICE_PLAY_RECT,
  centerText,
  drawDigits,
  drawDigitsCentered,
  drawHomeButton,
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

    this.obsSpeed = 2; // obstacle travel speed, i.e. how fast the bird flies
    this.upSpeed = 8;
    this.downSpeed = 3;

    this.bulletSpeed = 10;
    this.fireRange = 280; // how far ahead auto-fire will engage — 2/3 of 420
    // Below this, auto-fire holds its round rather than take a shot with no
    // travel time to see: an enemy that only lines up with the shot once it
    // has already drifted this close got a bullet that spawned, crossed the
    // whole distance and connected within the same frame or two — the enemy
    // simply vanished, with nothing visibly fired at it.
    this.minFireRange = 80;

    this.level = 100; // ground height

    // How a pair springs shut. The gap does not ease closed over the whole
    // approach any more: at 20px spread across 340px of travel the change was
    // real and nobody saw it happen. It now holds its spawn height until the
    // pair is `snapTriggerAhead` in front of the bird's nose and then closes
    // over `snapTravel` px — about half a second, fast enough to read as an
    // event, with roughly two seconds of open runway left to react in.
    this.snapTriggerAhead = 180;
    this.snapTravel = 45;

    // The active pacing block, replaced per level from the table and by the
    // endless block when level 3's win screen resumes instead of stopping.
    this.pacing = null;
    this.endless = false;
    // Score at which the current pacing started counting, so the endless run
    // can carry level 3's 15 points without starting at its own late curve.
    this.progressBase = 0;
    this.nextAmmoAt = Infinity;

    this.firstRandomPair = 1;
    this.pairIndex = 0;
    this.narrowAt = [];
    this.closingAt = [];
  }

  // Points earned under the current pacing block.
  Progress() {
    return Math.max(0, this.score - this.progressBase);
  }

  // The opening an ordinary pair spawns with, right now. Constant through a
  // numbered level; closing steadily through the endless run.
  CurrentGap() {
    return pairGap(this.pacing, this.Progress());
  }

  // As above, but rolled fresh for levels that set `ordinaryGapMin` (2 and
  // 3): every pair but the first — which CreateMap builds straight from
  // CurrentGap() before this can run — gets its own width instead of the
  // same constant every time. Levels 1 and 4, and the endless run, have no
  // `ordinaryGapMin` and fall back to the deterministic value unchanged.
  RollGap() {
    if (this.pacing.ordinaryGapMin == null) {
      return this.CurrentGap();
    }
    return randomGap(this.pacing);
  }

  // How long until the next pair, right now. Recomputed every frame rather
  // than fixed per level: obstacle density is the difficulty dial that keeps
  // turning for as long as the player keeps scoring.
  PairIntervalMs(tickMs) {
    return pairIntervalMs(
      pairSpacing(this.pacing, this.Progress()),
      this.obsSpeed,
      tickMs,
    );
  }

  // Decides up front which pairs get a shortened gap and which spawn at full
  // height and snap shut. Called once per numbered level; the endless run
  // rolls its tricks per pair instead, having no last pair to plan up to.
  PlanSpecialPairs(pacing, targetScore, enemyCount) {
    const span = trickSpan(targetScore, enemyCount, pacing.firstRandom);
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

  // Pairs marked to snap come in at the height they spawned with, so they
  // read as an ordinary gap from across the screen, and then close hard once
  // the bird is committed to the approach. The player has to react to the gap
  // rather than line up against it from the far side.
  UpdateSnapPairs() {
    const nose = this.startX + (this.bird ? this.bird.width : 64);
    for (let i = 0; i + 1 < this.obsList.length; i += 2) {
      const top = this.obsList[i];
      const bottom = this.obsList[i + 1];
      if (!top.snapBy) {
        continue;
      }
      const progress = snapProgress(
        top.x,
        nose,
        this.snapTriggerAhead,
        this.snapTravel,
      );
      if (progress === 0) {
        continue;
      }
      const grow = (top.snapBy * progress) / 2;
      top.height = top.baseHeight + grow;
      bottom.height = bottom.baseHeight + grow;
      bottom.y = this.mapHeight - bottom.height;
    }
  }

  // Level 3 is cleared and the player chose to keep going rather than go
  // home. The score stays — it was earned — and becomes the baseline the
  // endless curve counts its own progress from.
  //
  // The field is cleared and restarted rather than resumed from where the win
  // screen froze it. That frame landed wherever the fifteenth point happened
  // to fall, which can be a wingtip from a cactus, and dropping the player
  // back into it would be a death they had no part in.
  EnterEndless(cfg) {
    this.endless = true;
    this.pacing = cfg;
    this.progressBase = this.score;
    this.nextAmmoAt = this.score + cfg.ammoEvery;

    this.obsSpeed = cfg.obsSpeed;
    this.upSpeed = cfg.upSpeed;
    this.downSpeed = cfg.downSpeed;
    this.firstRandomPair = cfg.firstRandom;
    // No target to reach and no supply to run out of: both of those are
    // endings, and this mode has exactly one.
    this.scoreLimitCount = Infinity;
    this.enemyLimitCount = Infinity;
    this.enemyIntervalCount = enemyInterval(cfg, 0);
    this.enemyCount = 0;
    this.bulletLimitCount = Math.max(this.bulletLimitCount, 2);

    this.gameOver = false;
    this.gameWin = false;
    this.touch = false;
    this.spaceTouch = false;
    this.bulletList = [];
    this.enemyList = [];
    this.narrowAt = [];
    this.closingAt = [];
    this.pairIndex = 0;

    this.bird.y = this.startY;
    const h = 200;
    const h2 = this.mapHeight - h - this.CurrentGap();
    const top = new Obstacle(this.mapWidth, 0, h, this.obs, "down");
    const bottom = new Obstacle(
      this.mapWidth, this.mapHeight - h2, h2, this.obs, "up");
    top.snapBy = 0;
    top.baseHeight = h;
    bottom.baseHeight = h2;
    this.obsList = [top, bottom];
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
        const h2 = this.mapHeight - h - this.CurrentGap();
        const obs1 = new Obstacle(this.mapWidth, 0, h, this.obs, "down");
        const obs2 = new Obstacle(this.mapWidth, this.mapHeight - h2, h2, this.obs, "up");
        obs1.snapBy = 0;
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
        const enemyY = 200 + this.CurrentGap() / 2 - this.enemy.height;
        this.enemyList.push(new Enemy(this.mapWidth, enemyY, this.enemy));
        this.enemyLimitCount--;
      }.bind(this);
      this.enemy.src = asset("img/enemy.png");
    }
  }

  // Which trick this pair gets. A numbered level works through the list
  // planned at the start; the endless run rolls for it, against odds that
  // climb with the score.
  PickTrick(carriesEnemy) {
    if (carriesEnemy) {
      // Two hazards on one pair is a wall, not a step up in difficulty.
      return "none";
    }
    if (!this.endless) {
      return nextPairTrick(
        this.pairIndex,
        this.firstRandomPair,
        carriesEnemy,
        this.narrowAt,
        this.closingAt,
      );
    }
    const progress = this.Progress();
    if (Math.random() < snapChance(this.pacing, progress)) {
      return "closing";
    }
    if (Math.random() < narrowChance(this.pacing, progress)) {
      return "narrow";
    }
    return "none";
  }

  // Spawn the next obstacle pair, and an enemy every enemyIntervalCount pairs.
  CreateObs() {
    this.pairIndex++;

    // Enemies close up as the endless run goes on; a numbered level keeps the
    // interval its table gave it.
    if (this.endless) {
      this.enemyIntervalCount = enemyInterval(this.pacing, this.Progress());
    }

    const carriesEnemy =
      this.enemyLimitCount > 0 &&
      this.enemyCount + 1 >= this.enemyIntervalCount;

    let gap = this.RollGap();
    let snapBy = 0;
    const trick = this.PickTrick(carriesEnemy);
    if (trick === "narrow") {
      this.narrowAt.shift();
      gap = shortenGap(gap, this.pacing.narrowBy);
    } else if (trick === "closing") {
      this.closingAt.shift();
      // The pair spawns at the full gap and loses this much on the approach.
      // The depth itself is rolled — a fixed depth mostly clamped to the same
      // floor regardless of what the pair spawned at, so nearly every closing
      // pair ended at the identical final width. Clamped the same way a
      // narrow gap is, so a late endless pair whose ordinary gap is already
      // tight cannot snap shut to nothing.
      const depth = rollCloseBy(this.pacing);
      snapBy = gap - shortenGap(gap, depth);
    }

    const h = Math.floor(
      Math.random() * (this.mapHeight - gap - this.level) + 10,
    );
    const h2 = this.mapHeight - h - gap;
    const obs1 = new Obstacle(this.mapWidth, 0, h, this.obs, "down");
    const obs2 = new Obstacle(this.mapWidth, this.mapHeight - h2, h2, this.obs, "up");
    obs1.snapBy = snapBy;
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
        const enemyY = h + gap / 2 - this.enemy.height;
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
    // Scaled down to match the bullet that is actually about to fly — the
    // vertical-alignment check below has to agree with the collision test
    // the fired round will face, or a round can pass a check built against a
    // taller box than the one that ends up chasing the enemy.
    const shot = {
      x: muzzleX,
      y: muzzleY,
      width: this.bullet.width * BULLET_SCALE,
      height: this.bullet.height * BULLET_SCALE,
    };

    // The decision itself lives in rules.js, where it can be tested without a
    // canvas: it fires within a frame or two of a level starting, which is
    // far too fast to catch reliably by driving a browser.
    if (!enemyInFiringLine(
        shot,
        this.enemyList.map((enemy) => enemy.hitbox()),
        this.fireRange,
        this.minFireRange,
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
    //
    // `bullet.hitbox()`, not the bullet itself: the sprite is drawn at two
    // thirds of its natural size, and nothing scaled the collision box to
    // match, so a hit used to register up to a third of the bullet's own
    // length past where the drawn pixels actually stopped.
    const bullet = this.bulletList[0];
    if (this.spaceTouch && bullet != null) {
      const hit = this.enemyList.findIndex((enemy) =>
        rectsOverlap(bullet.hitbox(), enemy.hitbox()),
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

    // The endless run keeps issuing rounds. Without this the enemies that
    // arrive every second pair late on would be gaps that can neither be
    // flown through nor shot open. `>=` rather than `===` on the target
    // because a frame can score twice — a pair passed and an enemy killed —
    // and stepping over the target used to mean the level never ended.
    if (this.endless) {
      while (this.score >= this.nextAmmoAt) {
        this.nextAmmoAt += this.pacing.ammoEvery;
        this.bulletLimitCount = Math.min(
          this.pacing.maxAmmo,
          this.bulletLimitCount + 1,
        );
      }
    } else if (this.score >= this.scoreLimitCount) {
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

  ShowWin(offerEndless) {
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

    if (!offerEndless) {
      drawPlayButton(ctx, RESTART_RECT);
      return;
    }
    // Two ways on rather than one. A house and an arrow are the whole of the
    // question — the brief allows no sentence explaining that one of them
    // keeps going.
    drawHomeButton(ctx, CHOICE_HOME_RECT);
    drawPlayButton(ctx, CHOICE_PLAY_RECT);
  }

  // How the endless run ends. It cannot be lost, because there was nothing to
  // win, so there is no GAME OVER banner: hitting something stops the run and
  // the run's whole result is the number, shown at the size the result of a
  // thing should be shown at.
  ShowFinalScore() {
    const ctx = state.ctx;
    overSound.currentTime = 0;
    overSound.play();
    drawDigitsCentered(ctx, this.score, this.mapWidth / 2, 200, 5);
    drawHomeButton(ctx, CHOICE_HOME_RECT);
    drawPlayButton(ctx, CHOICE_PLAY_RECT);
  }
}
