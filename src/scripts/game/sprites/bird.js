import { opaqueBox } from "../mask.js";

// The player's bird. Its spritesheet holds three frames side by side.
export class Bird {
  constructor(x, y, image) {
    this.x = x;
    this.y = y;
    this.width = image.width / 3;
    this.height = image.height;
    this.image = image;
  }

  // The bird's own frame carries a few pixels of transparent margin, so the
  // box overstates it too. Measured from the first frame: the three differ by
  // a pixel or two, and erring small is erring in the player's favour.
  hitbox() {
    const box = opaqueBox(this.image, 0, 0, this.width, this.height);
    if (box == null) {
      return { x: this.x, y: this.y, width: this.width, height: this.height };
    }
    return {
      x: this.x + box.x,
      y: this.y + box.y,
      width: box.width,
      height: box.height,
    };
  }

  // `state` is the bird's flight state, one frame each: rising, falling,
  // firing. Anything else draws nothing, as before.
  draw(ctx, state) {
    const frames = { up: 0, down: 1, attack: 2 };
    const frame = frames[state];
    if (frame === undefined) {
      return;
    }
    ctx.drawImage(this.image, this.width * frame, 0, this.width, this.height,
      this.x, this.y, this.width, this.height);
  }
}
