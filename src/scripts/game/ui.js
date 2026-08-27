import { asset } from "./paths.js";

// The sprites are pixel art, so the text is too. A pixel face is far wider per
// character than a system sans, so these sizes are much smaller than the ones
// they replace and still read larger on screen.
export const PIXEL_FONT = '"Press Start 2P", ui-monospace, monospace';

export function font(size) {
  return `${size}px ${PIXEL_FONT}`;
}

// Ensures the face is actually available before anything is drawn: a canvas
// substitutes a fallback silently, so a missed load looks like a design choice
// rather than a bug.
export async function loadFont() {
  if (!document.fonts) {
    return;
  }
  try {
    await Promise.all([
      document.fonts.load(font(11)),
      document.fonts.load(font(46)),
    ]);
  } catch {
    // A missing face is a cosmetic loss, not a reason to withhold the game.
  }
}

// Draws text centred on centerX. Measured rather than offset by hand, so the
// labels stay centred whatever the string or the face turns out to be.
export function centerText(ctx, text, centerX, y) {
  const x = Math.round(centerX - ctx.measureText(text).width / 2);
  ctx.fillText(text, x, y);
  if (ctx.lineWidth > 0) {
    ctx.strokeText(text, x, y);
  }
}

// Shared screen furniture. The home screen and the end screens both draw the
// play icon, so it lives here rather than in either of them.
export const playButtonImg = new Image();
playButtonImg.src = asset("img/ui/button_play.png");

export const readyImg = new Image();
readyImg.src = asset("img/ui/text_ready.png");

export const gameOverImg = new Image();
gameOverImg.src = asset("img/ui/text_game_over.png");

// Laid out against the fixed 800x600 drawing buffer. Sizes are whole-number
// multiples of each asset's natural size, so nothing is resampled unevenly:
// button_play is 116x70, text_ready 196x62, text_game_over 204x54.
export const READY_RECT = { x: 204, y: 240, width: 392, height: 124 };
export const HOME_PLAY_RECT = { x: 255, y: 390, width: 290, height: 175 };
export const GAME_OVER_RECT = { x: 196, y: 200, width: 408, height: 108 };
export const RESTART_RECT = { x: 284, y: 370, width: 232, height: 140 };

// The same icon starts the game and restarts it, so a player who tapped it
// once on the home screen already knows what it does on the end screen.
// `pulse` scales it about its own centre for the idle breathing animation.
export function drawPlayButton(ctx, rect, pulse = 1) {
  const w = rect.width * pulse;
  const h = rect.height * pulse;
  ctx.drawImage(
    playButtonImg,
    rect.x + rect.width / 2 - w / 2,
    rect.y + rect.height / 2 - h / 2,
    w,
    h,
  );
}

// Hit-tests against the unpulsed rect, so a tap lands the same whatever point
// the breathing animation happens to be at.
export function hits(rect, pos) {
  return (
    pos.x >= rect.x &&
    pos.x <= rect.x + rect.width &&
    pos.y >= rect.y &&
    pos.y <= rect.y + rect.height
  );
}

// One cycle every ~1.7s, 4% either side. Enough to read as "tap me" without
// being distracting.
export function breathe(timestamp) {
  return 1 + 0.04 * Math.sin(timestamp / 270);
}

// The score digits, 0-9. A number climbing at the top of the screen needs no
// caption in any language, which suits a game that is not allowed to explain
// itself.
const DIGIT_W = 16;
const DIGIT_H = 20;
const digitImgs = Array.from({ length: 10 }, (_, i) => {
  const img = new Image();
  img.src = asset(`img/ui/number_score_0${i}.png`);
  return img;
});

// Draws a non-negative integer from a left edge, at a whole-number scale so
// the pixel art stays crisp. Left-aligned rather than centred: the bird flies
// up and down a fixed column through the middle of the screen, so a centred
// score sits directly in its path.
export function drawDigits(ctx, value, x, y, scale = 2) {
  const digits = String(Math.max(0, Math.floor(value)));
  const w = DIGIT_W * scale;
  const h = DIGIT_H * scale;
  const gap = 2 * scale;
  let cursor = Math.round(x);
  for (const digit of digits) {
    ctx.drawImage(digitImgs[Number(digit)], cursor, y, w, h);
    cursor += w + gap;
  }
}
