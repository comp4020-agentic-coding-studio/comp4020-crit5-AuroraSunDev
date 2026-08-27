// A flying enemy. Two frames side by side in the spritesheet.
export class Enemy {
  constructor(x, y, image) {
    this.x = x;
    this.y = y;
    this.width = image.width / 2;
    this.height = image.height;
    this.image = image;
    this.frame = 0;
    this.defeat = false;
    // Frames held since the sprite last advanced. The original never
    // initialised this, so `this.ticks++` was NaN, the comparison below was
    // never true, and the enemy sat on frame 0 for the whole game.
    this.ticks = 0;
  }

  // Unlike the obstacles, this one moves by translating the canvas.
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.drawImage(this.image, this.width * this.frame, 0, this.width,
      this.height, 0, 0, this.width, this.height);
    ctx.restore();

    this.ticks++;
    if (this.ticks > 10) {
      this.ticks = 0;
      this.frame = (this.frame + 1) % 2;
    }
  }
}
