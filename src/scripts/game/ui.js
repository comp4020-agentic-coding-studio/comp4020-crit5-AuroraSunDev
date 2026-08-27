import { asset } from "./paths.js";

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
