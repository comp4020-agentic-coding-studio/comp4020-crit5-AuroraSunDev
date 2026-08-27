import { describe, expect, it } from "vitest";
import {
  enemyInFiringLine,
  nextPairTrick,
  pickPairIndices,
  rectHitsMask,
  rectsOverlap,
} from "../src/scripts/game/rules.js";
import { levels } from "../src/scripts/game/levels.js";

// A contract test for this week's brief: "one rule carries a focused
// automated test". It retires with the brief, per spec/README.md.
//
// The rule under test is the one the whole game turns on — whether the bird
// has hit something. It imports rules.js directly rather than reaching into a
// rendered frame, because a sensor has to be able to see what it measures: a
// collision is a claim about two rectangles, and that claim is checkable
// without a canvas, a browser or a running game loop.

type Rect = { x: number; y: number; width: number; height: number };

const rect = (x: number, y: number, width: number, height: number): Rect => ({
  x,
  y,
  width,
  height,
});

// The test this rule replaced: "is any corner of A inside B". Kept here so
// the case below can show what it got wrong, rather than just asserting the
// new answer and leaving the reader to take the improvement on trust.
function anyCornerInside(a: Rect, b: Rect): boolean {
  const corners = [
    { x: a.x, y: a.y },
    { x: a.x + a.width, y: a.y },
    { x: a.x, y: a.y + a.height },
    { x: a.x + a.width, y: a.y + a.height },
  ];
  return corners.some(
    (c) =>
      c.x >= b.x && c.x <= b.x + b.width && c.y >= b.y && c.y <= b.y + b.height,
  );
}

describe("rectsOverlap", () => {
  it("reports overlap when two rectangles genuinely intersect", () => {
    expect(rectsOverlap(rect(0, 0, 50, 50), rect(25, 25, 50, 50))).toBe(true);
  });

  it("reports no overlap when they are apart", () => {
    expect(rectsOverlap(rect(0, 0, 50, 50), rect(100, 100, 50, 50))).toBe(false);
  });

  it("reports no overlap when they only share an edge", () => {
    // The bird's right edge is exactly the obstacle's left edge. Touching is
    // not hitting: a game that kills you here feels broken to play.
    expect(rectsOverlap(rect(0, 0, 50, 50), rect(50, 0, 50, 50))).toBe(false);
  });

  it("reports no overlap when they only share a corner", () => {
    expect(rectsOverlap(rect(0, 0, 50, 50), rect(50, 50, 50, 50))).toBe(false);
  });

  it("reports overlap when one rectangle fully contains the other", () => {
    const big = rect(0, 0, 200, 200);
    const small = rect(50, 50, 20, 20);
    expect(rectsOverlap(big, small)).toBe(true);
    expect(rectsOverlap(small, big)).toBe(true);
  });

  it("is symmetric", () => {
    const a = rect(0, 0, 50, 50);
    const b = rect(25, 25, 50, 50);
    expect(rectsOverlap(a, b)).toBe(rectsOverlap(b, a));
  });

  it("catches the bird crossing a narrow obstacle, which the old four-corner test missed", () => {
    // A tall thin cactus and a short wide bird crossing its middle. The two
    // overlap in a cross shape, but no corner of either lies inside the
    // other — so the old test called it a clean pass and the bird flew
    // straight through the cactus.
    const cactus = rect(100, 0, 20, 600);
    const bird = rect(90, 200, 40, 30);

    expect(rectsOverlap(bird, cactus)).toBe(true);

    // The reason this rule was worth extracting, asserted rather than claimed.
    expect(anyCornerInside(bird, cactus)).toBe(false);
    expect(anyCornerInside(cactus, bird)).toBe(false);
  });

  it("still agrees with the old test on ordinary overlaps", () => {
    const bird = rect(90, 200, 40, 30);
    const cactus = rect(100, 190, 200, 300);
    expect(rectsOverlap(bird, cactus)).toBe(true);
    expect(anyCornerInside(bird, cactus)).toBe(true);
  });
});

// The bird shoots by itself, so this rule is the entire firing decision.
// Testing it here rather than by driving a browser is deliberate: the first
// shot of a level happens within a frame or two of the level starting, which
// is faster than a screenshot loop can reliably observe — an earlier attempt
// to catch it that way reported "no auto-fire" while the screenshot in the
// same run plainly showed the ammo count had dropped.
describe("enemyInFiringLine", () => {
  const shot = rect(424, 292, 20, 12);
  const RANGE = 420;
  const enemy = (x: number, y: number): Rect => rect(x, y, 40, 40);

  it("fires at an enemy ahead, in range and level", () => {
    expect(enemyInFiringLine(shot, [enemy(600, 280)], RANGE)).toBe(true);
  });

  it("holds fire when the enemy is behind the bird", () => {
    expect(enemyInFiringLine(shot, [enemy(200, 280)], RANGE)).toBe(false);
  });

  it("holds fire when the enemy is beyond range", () => {
    expect(enemyInFiringLine(shot, [enemy(900, 280)], RANGE)).toBe(false);
  });

  it("holds fire when the enemy is above or below the shot's line", () => {
    expect(enemyInFiringLine(shot, [enemy(600, 100)], RANGE)).toBe(false);
    expect(enemyInFiringLine(shot, [enemy(600, 500)], RANGE)).toBe(false);
  });

  it("holds fire at an enemy already defeated", () => {
    const dead = { ...enemy(600, 280), defeat: true };
    expect(enemyInFiringLine(shot, [dead], RANGE)).toBe(false);
  });

  it("holds fire when there is nothing to shoot at", () => {
    expect(enemyInFiringLine(shot, [], RANGE)).toBe(false);
  });

  it("fires if any one of several enemies qualifies", () => {
    const enemies = [enemy(200, 280), enemy(900, 280), enemy(600, 285)];
    expect(enemyInFiringLine(shot, enemies, RANGE)).toBe(true);
  });

  it("does not waste a round on an enemy grazing the line by nothing", () => {
    // Enemy's bottom edge exactly meets the shot's top edge: no overlap, so
    // the shot would pass under it and the round would be gone for nothing.
    expect(enemyInFiringLine(shot, [enemy(600, 252)], RANGE)).toBe(false);
  });
});

// The cactus is a tall irregular plant inside a 90px-wide sprite column, and
// at its thin points only 34px of that is opaque. Colliding against the box
// killed the bird with visible daylight between it and the plant. These cases
// use a hand-built mask so the rule can be checked without a canvas: a narrow
// stem for most rows, one wide row of spikes, and one empty row.
describe("rectHitsMask", () => {
  // Rows 0-2: stem occupying x 30..59 of a 90-wide column.
  // Row 3: a spike reaching out to x 5..84.
  // Row 4: nothing at all.
  const spans = [
    { min: 30, max: 59 },
    { min: 30, max: 59 },
    { min: 30, max: 59 },
    { min: 5, max: 84 },
    null,
  ];
  const mask = { x: 100, y: 200, height: 5, spans, baseRow: 0 };

  it("misses a bird level with the stem but beside it", () => {
    // Bird's right edge at x=125, stem starts at 100+30=130. Five pixels of
    // daylight — the box test would have called this a hit.
    expect(rectHitsMask(rect(105, 200, 20, 2), mask)).toBe(false);
  });

  it("hits a bird that reaches the stem", () => {
    expect(rectHitsMask(rect(120, 200, 20, 2), mask)).toBe(true);
  });

  it("hits on the spike row even though the stem rows would miss", () => {
    // Same x as the miss above, but overlapping row 3 where the spike juts out.
    expect(rectHitsMask(rect(105, 203, 20, 1), mask)).toBe(true);
  });

  it("misses on a fully transparent row", () => {
    expect(rectHitsMask(rect(120, 204, 20, 1), mask)).toBe(false);
  });

  it("misses when the bird is above or below the sprite", () => {
    expect(rectHitsMask(rect(120, 150, 20, 40), mask)).toBe(false);
    expect(rectHitsMask(rect(120, 205, 20, 40), mask)).toBe(false);
  });

  it("respects baseRow, so a hanging obstacle reads the rows it shows", () => {
    // Shows only the last two rows of the sheet: the spike, then the gap.
    const hanging = { x: 100, y: 0, height: 2, spans, baseRow: 3 };
    expect(rectHitsMask(rect(105, 0, 20, 1), hanging)).toBe(true);
    expect(rectHitsMask(rect(105, 1, 20, 1), hanging)).toBe(false);
  });

  it("is not fooled by a bird that spans the whole sprite vertically", () => {
    // Tall bird well to the left: every row misses, so the whole thing misses.
    expect(rectHitsMask(rect(0, 190, 100, 40), mask)).toBe(false);
  });
});

// Which pairs get a narrowed or closing gap. The rule that matters is the
// negative one: a player must fly through at least one plain gap before the
// game starts playing tricks, or the trick just reads as a broken gap.
describe("pickPairIndices", () => {
  // A fixed sequence stands in for Math.random, so the choice is inspectable.
  const seeded = (values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  it("never picks the opening pair", () => {
    for (let seed = 0; seed < 200; seed++) {
      const picks = pickPairIndices(3, 1, 12, seeded([seed / 200]));
      expect(Math.min(...picks)).toBeGreaterThanOrEqual(1);
    }
  });

  it("respects a later first index, as level 1 needs", () => {
    for (let seed = 0; seed < 200; seed++) {
      const picks = pickPairIndices(1, 2, 8, seeded([seed / 200]));
      expect(Math.min(...picks)).toBeGreaterThanOrEqual(2);
    }
  });

  it("returns the number of pairs asked for", () => {
    expect(pickPairIndices(2, 1, 12, seeded([0.3, 0.7, 0.1])).length).toBe(2);
    expect(pickPairIndices(0, 1, 12).length).toBe(0);
  });

  it("never repeats a pair", () => {
    for (let seed = 0; seed < 100; seed++) {
      const picks = pickPairIndices(4, 1, 10, seeded([seed / 100, 0.42, 0.8]));
      expect(new Set(picks).size).toBe(picks.length);
    }
  });

  it("stays inside the window it was given", () => {
    const picks = pickPairIndices(5, 3, 6, seeded([0.1, 0.9, 0.5]));
    for (const p of picks) {
      expect(p).toBeGreaterThanOrEqual(3);
      expect(p).toBeLessThan(9);
    }
  });

  it("cannot ask for more pairs than the window holds", () => {
    expect(pickPairIndices(99, 1, 4, seeded([0.5])).length).toBe(4);
  });
});

// The difficulty curve is data, so it can be asserted as data rather than
// felt for by playing three levels in a row.
describe("level pacing rises across levels 1 to 3", () => {
  const one = levels[1].pacing;
  const two = levels[2].pacing;
  const three = levels[3].pacing;

  it("sends the world at the player faster each level", () => {
    expect(two.obsSpeed).toBeGreaterThan(one.obsSpeed);
    expect(three.obsSpeed).toBeGreaterThan(two.obsSpeed);
  });

  it("throws the bird further per press by level 3", () => {
    expect(three.upSpeed).toBeGreaterThan(two.upSpeed);
    expect(three.downSpeed).toBeGreaterThan(two.downSpeed);
  });

  it("plays more gap tricks each level", () => {
    const tricks = (p: typeof one) => p.narrowGaps + p.closingGaps;
    expect(tricks(two)).toBeGreaterThan(tricks(one));
    expect(tricks(three)).toBeGreaterThan(tricks(two));
  });

  it("only introduces closing gaps after level 1", () => {
    expect(one.closingGaps).toBe(0);
    expect(two.closingGaps).toBeGreaterThan(0);
  });

  it("holds every level's tricks back past the opening pair", () => {
    for (const key of [1, 2, 3, 4] as const) {
      expect(levels[key].pacing.firstRandom).toBeGreaterThanOrEqual(1);
    }
    // Level 1 waits longer still: nothing before the third pair.
    expect(one.firstRandom).toBe(2);
  });

  it("never narrows a gap to something impossible", () => {
    for (const key of [1, 2, 3, 4] as const) {
      const p = levels[key].pacing;
      // 200 is the base gap; the bird is at most 64 tall.
      expect(200 - p.narrowBy).toBeGreaterThan(100);
    }
  });
});

// Which trick lands on which pair. The negative cases carry the design: an
// opening pair is never tricked, and a pair already carrying an enemy is left
// alone because two hazards at once is a wall rather than a step up.
describe("nextPairTrick", () => {
  it("leaves pairs before firstRandom alone", () => {
    expect(nextPairTrick(0, 2, false, [1], [])).toBe("none");
    expect(nextPairTrick(1, 2, false, [1], [])).toBe("none");
    expect(nextPairTrick(2, 2, false, [2], [])).toBe("narrow");
  });

  it("leaves a pair carrying an enemy alone", () => {
    expect(nextPairTrick(4, 1, true, [4], [])).toBe("none");
  });

  it("keeps a skipped pick for the next eligible pair", () => {
    // Planned for pair 4, but pair 4 carried an enemy...
    expect(nextPairTrick(4, 1, true, [4], [])).toBe("none");
    // ...so pair 5 gets it instead of the trick being lost.
    expect(nextPairTrick(5, 1, false, [4], [])).toBe("narrow");
  });

  it("prefers a narrow gap when both are due on the same pair", () => {
    expect(nextPairTrick(3, 1, false, [3], [3])).toBe("narrow");
  });

  it("returns closing when only a closing gap is due", () => {
    expect(nextPairTrick(3, 1, false, [], [3])).toBe("closing");
  });

  it("returns none once both queues are spent", () => {
    expect(nextPairTrick(9, 1, false, [], [])).toBe("none");
  });
});
