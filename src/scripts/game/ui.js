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

// A screen that asks a question rather than offering one way on: level 3's win
// screen, and the end of an endless run. Both sit symmetrically about the
// centre line, at a size a thumb can hit on a 390px-wide phone.
export const CHOICE_HOME_RECT = { x: 186, y: 380, width: 174, height: 105 };
export const CHOICE_PLAY_RECT = { x: 440, y: 380, width: 174, height: 105 };

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

// The kit supplied no second button, and the win screen now asks a question
// with two answers, so this one is drawn. Both its colours and its geometry
// are measured off button_play.png rather than guessed, because the first
// attempt guessed and the two buttons came out visibly different sizes: the
// asset is 116x70 but its chrome is only 104x58 of that, sitting 6px in from
// each side, 3px down from the top and 9px up from the bottom. A full-bleed
// rounded rect beside it reads as a different button from a different game.
const BTN_TOP = "#fafafa";
const BTN_BOTTOM = "#ededed";
const BTN_BEVEL = "#d6be9b"; // the warm line just inside the bottom edge
const BTN_BORDER = "#543847";
const BTN_GLYPH = "#00a848";

// Everything as a fraction of the rect the button is drawn into, so the two
// line up at any size.
const BTN = {
  left: 6 / 116,
  right: 110 / 116,
  top: 3 / 70,
  bottom: 61 / 70,
  border: 2 / 70,
  bevel: 2 / 70,
  radius: 6 / 70,
  split: 26 / 54, // where #fafafa gives way to #ededed
  glyph: 0.55, // glyph height as a fraction of the chrome's
};

// A house, as a bitmap, because everything else on this canvas is pixel art
// and a smooth path would be the only curve on the screen. 13 wide by 11 tall:
// roof, walls, door.
const HOUSE = [
  "......#......",
  ".....###.....",
  "....#####....",
  "...#######...",
  "..#########..",
  ".###########.",
  ".#.........#.",
  ".#...###...#.",
  ".#...#.#...#.",
  ".#...#.#...#.",
  ".###########.",
];

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Home, as a sibling of the play icon: same shell, different glyph. Sized
// against the same rect shape the play button uses, so the two line up.
export function drawHomeButton(ctx, rect) {
  const x = rect.x + rect.width * BTN.left;
  const w = rect.width * (BTN.right - BTN.left);
  const y = rect.y + rect.height * BTN.top;
  const h = rect.height * (BTN.bottom - BTN.top);
  const border = rect.height * BTN.border;
  const bevel = rect.height * BTN.bevel;
  const radius = rect.height * BTN.radius;

  ctx.save();
  roundedRect(ctx, x, y, w, h, radius);
  ctx.clip();
  ctx.fillStyle = BTN_TOP;
  ctx.fillRect(x, y, w, h * BTN.split);
  ctx.fillStyle = BTN_BOTTOM;
  ctx.fillRect(x, y + h * BTN.split, w, h * (1 - BTN.split));
  ctx.fillStyle = BTN_BEVEL;
  ctx.fillRect(x, y + h - border - bevel, w, bevel);
  ctx.restore();

  ctx.save();
  roundedRect(ctx, x + border / 2, y + border / 2, w - border, h - border,
    radius);
  ctx.lineWidth = border;
  ctx.strokeStyle = BTN_BORDER;
  ctx.stroke();

  // Whole-number cell size, so the bitmap stays a grid rather than blurring
  // across half pixels the way the score digits would if they were scaled
  // fractionally.
  const cell = Math.max(1, Math.floor((h * BTN.glyph) / HOUSE.length));
  const glyphW = HOUSE[0].length * cell;
  const glyphH = HOUSE.length * cell;
  const left = Math.round(x + (w - glyphW) / 2);
  const top = Math.round(y + (h - glyphH) / 2);
  ctx.fillStyle = BTN_GLYPH;
  for (let row = 0; row < HOUSE.length; row++) {
    for (let col = 0; col < HOUSE[row].length; col++) {
      if (HOUSE[row][col] === "#") {
        ctx.fillRect(left + col * cell, top + row * cell, cell, cell);
      }
    }
  }
  ctx.restore();
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

// The width the call above will occupy, so a caller that wants the number
// centred can be told where to start rather than guessing per digit count.
export function digitsWidth(value, scale) {
  const n = String(Math.max(0, Math.floor(value))).length;
  return n * DIGIT_W * scale + (n - 1) * 2 * scale;
}

// The endless run has no banner to put above its result, so the number is the
// result: centred, and large enough to be the thing on the screen.
export function drawDigitsCentered(ctx, value, centerX, y, scale) {
  drawDigits(ctx, value, centerX - digitsWidth(value, scale) / 2, y, scale);
}
