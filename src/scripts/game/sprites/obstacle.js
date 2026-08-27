import { rowSpans } from "../mask.js";

// A single obstacle. They are created in pairs — one hanging from the top and
// one standing on the floor — with a gap between them for the bird to fly
// through. The spritesheet holds the two orientations side by side.
//
// `orientation` is "up" for a floor obstacle and "down" for a hanging one. It
// used to be decided at draw time from the sprite's index in the list, which
// left nothing to ask about its shape; collision needs to know which half of
// the sheet this one shows, so it is settled at construction now.
export class Obstacle {
  constructor(x, y, h, image, orientation) {
    this.x = x;
    this.y = y;
    this.width = image.width / 2;
    this.height = h;
    this.flypast = false; // set once the bird has passed it and scored
    this.image = image;
    this.orientation = orientation;
  }

  // A hanging obstacle is sampled from the bottom of the source image, so the
  // mouth of the plant stays at the cut edge; a floor one from the top.
  sourceX() {
    return this.orientation === "up" ? 0 : this.width;
  }

  sourceY() {
    return this.orientation === "up" ? 0 : this.image.height - this.height;
  }

  // Movement is handled by updating the draw coordinates, not by transforming
  // the canvas.
  draw(ctx) {
    ctx.drawImage(this.image, this.sourceX(), this.sourceY(), this.width,
      this.height, this.x, this.y, this.width, this.height);
  }

  // The outline this obstacle actually presents, for collision. Null until the
  // spritesheet has loaded, in which case the caller falls back to the box.
  mask() {
    const spans = rowSpans(this.image, this.sourceX(), this.width);
    if (spans == null) {
      return null;
    }
    return {
      x: this.x,
      y: this.y,
      height: this.height,
      spans,
      baseRow: this.sourceY(),
    };
  }
}
