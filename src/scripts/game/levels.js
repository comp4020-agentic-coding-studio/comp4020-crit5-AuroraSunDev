import { asset } from "./paths.js";

// The level table. Levels 1-3 are the ones the select screen offers; level 4
// is only reachable as the easter egg that level 3 jumps to, and it jumps
// back to 3.
//
// `pacing` is what makes each level harder than the last, and it is all here
// rather than scattered through the game class so the whole difficulty curve
// can be read in one place:
//
//   obsSpeed    how fast the world comes at you
//   upSpeed /   how far one press moves the bird — larger values make the
//   downSpeed   bird harder to hold steady, not just faster
//   gap         the opening in an ordinary pair, in px
//   gapPerPoint how much that opening loses per point, floored at minGap;
//               zero for a numbered level, where only the spacing tightens
//   narrowGaps  how many pairs spawn already short, by narrowBy
//   closingGaps how many pairs spawn at full height and then snap shut, by
//               closeBy, once the bird is close enough to have to react
//   spacing     px between one pair and the next at score 0, losing
//   spacingPerPoint per point down to minSpacing — this is the obstacle
//               density, and it rises for the whole level rather than being
//               a fixed count of obstacles
//   firstRandom the earliest pair index that may be picked; the opening pair
//               is never one, so nobody meets a trick before they have flown
//               through a plain gap
//
// Spacing is in pixels, not milliseconds. The old fixed 6000ms interval meant
// a faster level spread its obstacles further apart — level 3 ran 580px
// between pairs where level 1 ran 400 — so the level that was meant to be
// hardest had the airiest field.
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
      gap: 200,
      gapPerPoint: 0,
      minGap: 200,
      narrowGaps: 1,
      narrowBy: 40,
      closingGaps: 0,
      closeBy: 0,
      spacing: 400,
      spacingPerPoint: 12,
      minSpacing: 330,
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
      gap: 200,
      gapPerPoint: 0,
      minGap: 200,
      narrowGaps: 2,
      narrowBy: 48,
      closingGaps: 1,
      closeBy: 64,
      spacing: 420,
      spacingPerPoint: 10,
      minSpacing: 320,
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
    // Clearing this one is not the end of it: the win screen offers the
    // endless run below as well as the way home.
    endless: true,
    pacing: {
      obsSpeed: 2.9,
      // A longer throw per press: the bird overshoots more easily, so holding
      // a line takes finer timing rather than just faster reactions.
      upSpeed: 11,
      downSpeed: 4.5,
      gap: 200,
      gapPerPoint: 0,
      minGap: 200,
      narrowGaps: 3,
      narrowBy: 56,
      closingGaps: 2,
      closeBy: 70,
      spacing: 460,
      spacingPerPoint: 12,
      minSpacing: 290,
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
      gap: 200,
      gapPerPoint: 0,
      minGap: 200,
      narrowGaps: 2,
      narrowBy: 56,
      closingGaps: 1,
      closeBy: 70,
      spacing: 460,
      spacingPerPoint: 12,
      minSpacing: 290,
      firstRandom: 1,
    },
  },
};

// What level 3's win screen offers instead of stopping: the same desert, no
// target and no ending, and every dial from the level table still turning.
//
// It is not a level. A level is a thing you can finish, and the whole point of
// this one is that you cannot — so it has no `scoreC`, no `IsCleared`, and no
// `jump`, and the easter egg is switched off while it runs (being yanked into
// level 4 mid-run would be an ending of sorts, which is the one thing this
// mode does not have).
//
// Progress is counted from the score that won level 3, not from zero, so the
// numbers below describe the run from its own first point onward.
//
// The tricks are rolled per pair rather than planned as a list of indices:
// a list has a length, and this has no length. `snapChance` and
// `narrowChance` climb with progress, so the gap springing shut in your face
// goes from occasional to the normal state of affairs.
export const endless = {
  obsSpeed: 2.9,
  upSpeed: 11,
  downSpeed: 4.5,

  // Unlike a numbered level, the ordinary gap itself closes as you go.
  gap: 200,
  gapPerPoint: 1.5,
  minGap: 160,

  narrowBy: 56,
  closeBy: 70,

  spacing: 400,
  spacingPerPoint: 10,
  minSpacing: 240,

  snapChance: 0.18,
  snapChancePerPoint: 0.02,
  maxSnapChance: 0.6,
  narrowChance: 0.15,
  narrowChancePerPoint: 0.015,
  maxNarrowChance: 0.45,

  // Enemies keep coming, closer and closer together.
  enemyInterval: 5,
  enemyIntervalPerPoint: 0.1,
  minEnemyInterval: 2,

  // Ammo has to keep coming too, or the enemies arriving every second pair
  // become gaps that cannot be flown through and cannot be shot open.
  ammoEvery: 4,
  maxAmmo: 6,

  firstRandom: 0,
};
