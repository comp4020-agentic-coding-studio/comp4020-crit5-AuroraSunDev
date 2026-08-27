// A single obstacle. They are created in pairs — one hanging from the top and
// one standing on the floor — with a gap between them for the bird to fly
// through. The spritesheet holds the two orientations side by side.
export class Obstacle {
  constructor(x, y, h, image) {
    this.x = x;
    this.y = y;
    this.width = image.width / 2;
    this.height = h;
    this.flypast = false; // set once the bird has passed it and scored
    this.image = image;
  }

  // Movement is handled by updating the draw coordinates, not by transforming
  // the canvas. `state` is "up" for a floor obstacle, anything else for a
  // hanging one, which is sampled from the bottom of the source image so the
  // mouth of the pipe stays at the cut edge.
  draw(ctx, state) {
    if (state === "up") {
      ctx.drawImage(this.image, 0, 0, this.width, this.height,
        this.x, this.y, this.width, this.height);
    } else {
      ctx.drawImage(this.image, this.width, this.image.height - this.height,
        this.width, this.height, this.x, this.y, this.width, this.height);
    }
  }
}
