// The entry point. Everything the game does hangs off initGame(); this file
// only has to find the canvas and hand it over.
import { initGame } from "./game/init.js";

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");

if (canvas) {
  initGame(canvas);
} else {
  console.error("#game-canvas is missing, so the game cannot start");
}
