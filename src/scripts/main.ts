// The entry point. Everything the game does hangs off initGame(); this file
// only has to find the canvas, make sure the pixel face is ready, and hand
// the canvas over.
import { initGame } from "./game/init.js";
import { loadFont } from "./game/ui.js";

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");

if (canvas) {
  // Drawing before the face resolves would silently fall back to a system
  // sans for the first frames, which is the mismatch this is meant to fix.
  void loadFont().then(() => initGame(canvas));
} else {
  console.error("#game-canvas is missing, so the game cannot start");
}
