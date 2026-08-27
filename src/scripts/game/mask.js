// Hitboxes read from the sprites themselves.
//
// Every sprite here is drawn from a PNG with a transparent background, and the
// rectangle the sprite occupies is not the shape the player sees. The cactus is
// the worst case: its spritesheet column is 90px wide, but at the thin parts of
// the plant only 34-41px of that is actually opaque. Colliding against the
// rectangle killed the bird with visible daylight still between it and the
// cactus, which reads as the game cheating.
//
// So the shapes are measured once, from the pixels, at first use.

const ALPHA_FLOOR = 8; // anti-aliased edges below this count as empty
const spanCache = new Map();
const boxCache = new Map();

function readPixels(image, sx, sy, sw, sh) {
  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  return ctx.getImageData(0, 0, sw, sh).data;
}

// For each row of a sprite region, the first and last opaque pixel — or null
// where the row is empty. Indexed by row within the region, x relative to it.
// This is what makes a tall irregular column collide like its own outline
// instead of like the box around it.
export function rowSpans(image, sx, sw) {
  if (!image || !image.complete || image.naturalWidth === 0) {
    return null;
  }
  const key = `${image.src}|${sx}|${sw}`;
  const hit = spanCache.get(key);
  if (hit) {
    return hit;
  }

  const sh = image.naturalHeight;
  const data = readPixels(image, sx, 0, sw, sh);
  const spans = new Array(sh);
  for (let y = 0; y < sh; y++) {
    let min = -1;
    let max = -1;
    for (let x = 0; x < sw; x++) {
      if (data[(y * sw + x) * 4 + 3] > ALPHA_FLOOR) {
        if (min < 0) {
          min = x;
        }
        max = x;
      }
    }
    spans[y] = min < 0 ? null : { min, max };
  }
  spanCache.set(key, spans);
  return spans;
}

// The tight box around everything opaque in a sprite region, relative to it.
// Enough for the small sprites, where the waste is a uniform margin rather
// than a varying outline: the enemy throws away 10px of its 32 on the left
// alone.
export function opaqueBox(image, sx, sy, sw, sh) {
  if (!image || !image.complete || image.naturalWidth === 0) {
    return null;
  }
  const key = `${image.src}|${sx}|${sy}|${sw}|${sh}`;
  const hit = boxCache.get(key);
  if (hit) {
    return hit;
  }

  const data = readPixels(image, sx, sy, sw, sh);
  let minX = sw;
  let minY = sh;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (data[(y * sw + x) * 4 + 3] > ALPHA_FLOOR) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  // A fully transparent region collides with nothing.
  const box =
    maxX < 0
      ? { x: 0, y: 0, width: 0, height: 0 }
      : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  boxCache.set(key, box);
  return box;
}
