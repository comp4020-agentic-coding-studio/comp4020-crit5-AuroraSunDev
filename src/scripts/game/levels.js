import { asset } from "./paths.js";

// The level table. Levels 1-3 are the ones the select screen offers; level 4
// is only reachable as the easter egg that level 3 jumps to, and it jumps
// back to 3.
//
// `pacing` is what makes each level harder than the last, and it is all here
// rather than scattered through the game class so the whole difficulty curve
// can be read in one place:
//
//   obsSpeed   how fast the world comes at you
//   upSpeed /  how far one press moves the bird — larger values make the
//   downSpeed  bird harder to hold steady, not just faster
//   narrowGaps how many pairs have their gap shortened by narrowBy
//   closingGaps how many pairs start normal and shrink as the bird nears them
//   firstRandom the earliest pair index that may be picked; the opening pair
//               is never one, so nobody meets a trick before they have flown
//               through a plain gap
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
    pacing: {
      obsSpeed: 2,
      upSpeed: 8,
      downSpeed: 3,
      narrowGaps: 1,
      narrowBy: 20,
      closingGaps: 0,
      firstRandom: 2, // from the third pair
    },
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
    IntervalSpeed: [{ ITVSpeed: 30 }],
    IsCleared: [{ flag: false }],
    pacing: {
      obsSpeed: 2.4,
      upSpeed: 8,
      downSpeed: 3,
      narrowGaps: 2,
      narrowBy: 20,
      closingGaps: 1,
      firstRandom: 1,
    },
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
    pacing: {
      obsSpeed: 2.9,
      // A longer throw per press: the bird overshoots more easily, so holding
      // a line takes finer timing rather than just faster reactions.
      upSpeed: 11,
      downSpeed: 4.5,
      narrowGaps: 3,
      narrowBy: 24,
      closingGaps: 2,
      firstRandom: 1,
    },
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
    pacing: {
      obsSpeed: 2.9,
      upSpeed: 11,
      downSpeed: 4.5,
      narrowGaps: 2,
      narrowBy: 24,
      closingGaps: 1,
      firstRandom: 1,
    },
  },
};
