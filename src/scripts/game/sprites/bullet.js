import { opaqueBox } from "../mask.js";

// Drawn at two thirds of its natural size — bullet.png itself has no
// transparent margin (its opaque box is the full 58x24 sheet), so alpha
// trimming alone changes nothing here; the box was too large because nothing
// accounted for this scale-down at all.
export const DISPLAY_SCALE = 2 / 3;

// A bullet the bird fires. Only one is ever in flight at a time.
export class Bullet {
  constructor(x, y, image) {
    this.x = x;
    this.y = y;
    this.width = image.width;
    this.height = image.height;
    this.image = image;
  }

  draw(ctx) {
    ctx.drawImage(this.image, 0, 0, this.width, this.height,
      this.x, this.y, this.width * DISPLAY_SCALE, this.height * DISPLAY_SCALE);
  }

  // The box a hit is tested against: alpha-trimmed like every other sprite
  // here, then scaled to match what draw() actually puts on screen. Without
  // the second step this was the full 58x24 sheet at natural size while the
  // sprite itself rendered at 38.7x16 from the same top-left corner — a hit
  // registered up to a third of the bullet's own length past where the
  // drawn pixels stopped, on both edges.
  hitbox() {
    const box = opaqueBox(this.image, 0, 0, this.width, this.height);
    if (box == null) {
      return {
        x: this.x,
        y: this.y,
        width: this.width * DISPLAY_SCALE,
        height: this.height * DISPLAY_SCALE,
      };
    }
    return {
      x: this.x + box.x * DISPLAY_SCALE,
      y: this.y + box.y * DISPLAY_SCALE,
      width: box.width * DISPLAY_SCALE,
      height: box.height * DISPLAY_SCALE,
    };
  }
}
