// The player's bird. Its spritesheet holds three frames side by side.
export function Bird(x, y, image) {
  this.x = x;
  this.y = y;
  this.width = image.width / 3;
  this.height = image.height;
  this.image = image;
}

// `state` is the bird's flight state, one frame each: rising, falling, firing.
Bird.prototype.draw = function (ctx, state) {
  if (state === "up") {
    ctx.drawImage(this.image, this.width * 0, 0, this.width, this.height,
      this.x, this.y, this.width, this.height);
  } else if (state === "down") {
    ctx.drawImage(this.image, this.width * 1, 0, this.width, this.height,
      this.x, this.y, this.width, this.height);
  } else if (state === "attack") {
    ctx.drawImage(this.image, this.width * 2, 0, this.width, this.height,
      this.x, this.y, this.width, this.height);
  }
};
