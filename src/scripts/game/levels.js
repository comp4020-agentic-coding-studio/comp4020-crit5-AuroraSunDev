import { asset } from "./paths.js";

// The level table, unchanged from the original Script.js apart from routing
// the image paths through asset(). Levels 1-3 are the ones the select screen
// offers; level 4 is only reachable as the easter egg that level 3 jumps to,
// and it jumps back to 3.
export const levels = {
  1: {
    imgSrc: [
      {
        gameSrc: asset("img/GamebackgroundDesert.png"),
        birdSrc: asset("img/bird3.png"),
        obsSrc: asset("img/cactus.png"),
      },
    ],
    num: [{ bulletC: 0, enemyC: 0, enemyIC: 0, scoreC: 5 }],
    jump: [{ to: "" }],
    IntervalSpeed: [{ ITVSpeed: 30 }],
    IsCleared: [{ flag: false }],
  },
  2: {
    imgSrc: [
      {
        gameSrc: asset("img/GamebackgroundDesert.png"),
        birdSrc: asset("img/bird2.png"),
        obsSrc: asset("img/cactus.png"),
      },
    ],
    num: [{ bulletC: 5, enemyC: 2, enemyIC: 4, scoreC: 10 }],
    jump: [{ to: "" }],
    IntervalSpeed: [{ ITVSpeed: 40 }],
    IsCleared: [{ flag: false }],
  },
  3: {
    imgSrc: [
      {
        gameSrc: asset("img/GamebackgroundDesert.png"),
        birdSrc: asset("img/bird.png"),
        obsSrc: asset("img/cactus.png"),
      },
    ],
    num: [{ bulletC: 4, enemyC: 3, enemyIC: 2, scoreC: 15 }],
    jump: [{ to: 4 }],
    IntervalSpeed: [{ ITVSpeed: 30 }],
    IsCleared: [{ flag: false }],
  },
  4: {
    imgSrc: [
      {
        gameSrc: asset("img/Gamebackground.png"),
        birdSrc: asset("img/bird.png"),
        obsSrc: asset("img/pipe.png"),
      },
    ],
    num: [{ bulletC: 3, enemyC: 3, enemyIC: 1, scoreC: 15 }],
    jump: [{ to: 3 }],
    IntervalSpeed: [{ ITVSpeed: 30 }],
    IsCleared: [{ flag: false }],
  },
};
