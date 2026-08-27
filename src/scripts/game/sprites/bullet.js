// A bullet the bird fires. Only one is ever in flight at a time.
export function Bullet(x, y, image) {
  this.x = x;
  this.y = y;
  this.width = image.width;
  this.height = image.height;
  this.image = image;
  this.defeat = false;
}

// Drawn at two thirds of its natural size.
Bullet.prototype.draw = function (ctx) {
  ctx.drawImage(this.image, 0, 0, this.width, this.height,
    this.x, this.y, this.width / 1.5, this.height / 1.5);
};
