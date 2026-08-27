import { asset } from "./paths.js";
import { state } from "./state.js";
import { Bird } from "./sprites/bird.js";
import { Enemy } from "./sprites/enemy.js";
import { Obstacle } from "./sprites/obstacle.js";

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

export function FlappyBird() {}

FlappyBird.prototype = {
  bird: null,
  bg: null,

  obs: null,
  obsList: [],

  bullet: null,
  bulletList: [],

  enemy: null,
  enemyList: [],
  enemyCount: 0, // obstacles seen since the last enemy was spawned

  mapWidth: 800,
  mapHeight: 600,

  startX: 360, // the bird never moves horizontally
  startY: 260,

  obsDistance: 200, // the gap between an obstacle pair
  obsSpeed: 2, // how fast obstacles travel left, i.e. how fast the bird flies
  upSpeed: 8,
  downSpeed: 3,

  obsInterval: 6000, // ms between obstacle pairs

  bulletSpeed: 10,

  level: 100, // ground height
  score: 0,
  touch: false, // pointer is held down
  spaceTouch: false, // a shot is in flight
  gameOver: false,
  gameWin: false,

  // Set per level from the level table.
  bulletLimitCount: 0,
  enemyLimitCount: 0,
  enemyIntervalCount: 0,
  scoreLimitCount: 0,

  // Load this level's images and lay out the opening screen.
  CreateMap: function () {
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
  },

  // Spawn the next obstacle pair, and an enemy every enemyIntervalCount pairs.
  CreateObs: function () {
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
  },

  DrawObs: function () {
    for (let i = 0; i < this.obsList.length; i++) {
      this.obsList[i].x -= this.obsSpeed;
      // The list alternates hanging, standing, hanging, standing.
      this.obsList[i].draw(state.ctx, i % 2 ? "up" : "down");
    }
  },

  DrawEnemy: function () {
    for (let i = 0; i < this.enemyList.length; i++) {
      if (!this.enemyList[i].defeat) {
        this.enemyList[i].x -= this.obsSpeed;
        // Bob up and down as it travels.
        this.enemyList[i].y =
          this.enemyList[i].y + 4 * Math.sin((Math.PI / 15) * this.enemyList[i].x);
        this.enemyList[i].draw(state.ctx);
      }
    }
  },

  DrawBullet: function () {
    this.bulletList[0].draw(state.ctx);
    this.bulletList[0].x += this.bulletSpeed;
    // Drop it once it leaves the screen, which frees the next shot.
    if (this.bulletList[0] != null && this.bulletList[0].x >= this.mapWidth) {
      this.bulletList.splice(0, 1);
      this.spaceTouch = false;
    }
  },

  ShowBullet: function () {
    const ctx = state.ctx;
    ctx.save();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#fff";
    ctx.font = "35px sans-serif";
    ctx.fillText("剩余子弹: " + this.bulletLimitCount, 20, 105);
    ctx.strokeText("剩余子弹: " + this.bulletLimitCount, 20, 105);
    ctx.restore();
  },

  CountScore: function () {
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

    // A bullet that reaches an enemy destroys it and scores a point.
    if (this.spaceTouch) {
      const boundary2 = [
        { x: this.bulletList[0].x, y: this.bulletList[0].y },
        {
          x: this.bulletList[0].x + this.bulletList[0].width,
          y: this.bulletList[0].y,
        },
        {
          x: this.bulletList[0].x,
          y: this.bulletList[0].y + this.bulletList[0].height,
        },
        {
          x: this.bulletList[0].x + this.bulletList[0].width,
          y: this.bulletList[0].y + this.bulletList[0].height,
        },
      ];
      for (let e = 0; e < this.enemyList.length; e++) {
        for (let r = 0; r < 4; r++) {
          if (
            boundary2[r].x >= this.enemyList[e].x &&
            boundary2[r].x <= this.enemyList[e].x + this.enemyList[e].width &&
            boundary2[r].y >= this.enemyList[e].y &&
            boundary2[r].y <= this.enemyList[e].y + this.enemyList[e].height
          ) {
            this.score += 1;
            this.enemyList[e].defeat = true;
            this.enemyList.splice(e, 1);
            this.bulletList.splice(0, 1);
            this.spaceTouch = false;
            attackSound.currentTime = 0;
            attackSound.play();
            state.jumpEnemyCount--;
            break;
          } else if (
            // The shot went past this enemy: retire it.
            !this.enemyList[e].defeat &&
            boundary2[0].x >= this.enemyList[e].x + this.enemyList[e].width
          ) {
            this.enemyList[e].defeat = false;
            this.bulletList.splice(0, 1);
            this.spaceTouch = false;
          }
        }
        if (this.gameOver) {
          break;
        }
      }
    }

    if (this.score === this.scoreLimitCount) {
      this.gameWin = true;
    }
  },

  ShowScore: function () {
    const ctx = state.ctx;
    ctx.save();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#fff";
    ctx.font = "35px sans-serif";
    ctx.fillText("分数: " + this.score, 20, 50);
    ctx.strokeText("分数: " + this.score, 20, 50);
    ctx.restore();
  },

  // Collision detection: the bird against the ceiling, the floor, every enemy
  // and every obstacle.
  CanMove: function () {
    if (this.bird.y < 0 || this.bird.y > this.mapHeight - this.bird.height) {
      this.gameOver = true;
      return;
    }

    const boundary = [
      { x: this.bird.x, y: this.bird.y },
      { x: this.bird.x + this.bird.width, y: this.bird.y },
      { x: this.bird.x, y: this.bird.y + this.bird.height },
      {
        x: this.bird.x + this.bird.width,
        y: this.bird.y + this.bird.height,
      },
    ];

    for (let w = 0; w < this.enemyList.length; w++) {
      for (let q = 0; q < 4; q++) {
        if (
          boundary[q].x >= this.enemyList[w].x &&
          boundary[q].x <= this.enemyList[w].x + this.enemyList[w].width &&
          boundary[q].y >= this.enemyList[w].y &&
          boundary[q].y <= this.enemyList[w].y + this.enemyList[w].height
        ) {
          this.gameOver = true;
          break;
        }
      }
      if (this.gameOver) {
        break;
      }
    }

    for (let i = 0; i < this.obsList.length; i++) {
      for (let j = 0; j < 4; j++) {
        if (
          boundary[j].x >= this.obsList[i].x &&
          boundary[j].x <= this.obsList[i].x + this.obsList[i].width &&
          boundary[j].y >= this.obsList[i].y &&
          boundary[j].y <= this.obsList[i].y + this.obsList[i].height
        ) {
          this.gameOver = true;
          break;
        }
      }
      if (this.gameOver) {
        break;
      }
    }
  },

  // Apply the pointer state to the bird and draw it.
  CheckTouch: function () {
    if (this.touch) {
      this.bird.y -= this.upSpeed;
      this.bird.draw(state.ctx, this.spaceTouch ? "attack" : "up");
    } else {
      this.bird.y += this.downSpeed;
      this.bird.draw(state.ctx, this.spaceTouch ? "attack" : "down");
    }
    if (this.spaceTouch) {
      this.DrawBullet();
    }
  },

  // Redrawing the background is what clears the previous frame.
  ClearScreen: function () {
    state.ctx.drawImage(this.bg, 0, 0);
  },

  ShowOver: function () {
    const ctx = state.ctx;
    overSound.currentTime = 0;
    overSound.play();
    const x = this.mapWidth / 2 - 160;
    const y = this.mapHeight / 2 - 20;

    ctx.save();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 0.25;
    ctx.fillStyle = "#fff";
    ctx.font = "900 oblique 90px sans-serif";
    ctx.fillText("GameOver", x, y);
    ctx.strokeText("GameOver", x, y);
    ctx.restore();

    this.ShowHomeText(x + 5, y, "按下Enter键，返回首页");
  },

  ShowWin: function () {
    const ctx = state.ctx;
    winSound.currentTime = 0;
    winSound.play();
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
    this.ShowHomeText(x - 20, y, "按下Enter键，返回首页");
  },

  ShowHomeText: function (x, y, str) {
    const ctx = state.ctx;
    ctx.save();
    ctx.fillStyle = "rgba(128,0,0,0.3)";
    ctx.fillRect(x, y + 15, 370, 40);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 0.25;
    ctx.fillStyle = "#fff";
    ctx.font = "35px sans-serif";
    ctx.fillText(str, x, y + 45);
    ctx.strokeText(str, x, y + 45);
    ctx.restore();
  },
};
