// A flying enemy. Two frames side by side in the spritesheet.
export function Enemy(x, y, image) {
  this.x = x;
  this.y = y;
  this.width = image.width / 2;
  this.height = image.height;
  this.image = image;
  this.frame = 0;
}

// Unlike the obstacles, this one moves by translating the canvas.
Enemy.prototype.draw = function (ctx) {
  ctx.save();
  ctx.translate(this.x, this.y);
  ctx.drawImage(this.image, this.width * this.frame, 0, this.width,
    this.height, 0, 0, this.width, this.height);
  ctx.restore();

  // Frame animation. Carried over as-is from the original: `dis` is never
  // initialised, so `this.dis++` is NaN and the comparison below is never
  // true — the enemy holds frame 0 forever. Left alone here to keep this a
  // behaviour-preserving port; it belongs to the later cleanup pass.
  this.dis++;
  if (this.dis > 10) {
    this.dis = 0;
    this.frame++;
    if (this.frame >= 2) {
      this.frame = 0;
    }
  }
};
