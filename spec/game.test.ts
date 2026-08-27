import { describe, expect, it } from "vitest";
import {
  climb,
  enemyInFiringLine,
  enemyInterval,
  GAP_FLOOR,
  narrowChance,
  nextPairTrick,
  pairGap,
  pairIntervalMs,
  pairSpacing,
  pickPairIndices,
  randomGap,
  rectHitsMask,
  rectsOverlap,
  rollCloseBy,
  shortenGap,
  snapChance,
  snapProgress,
  tighten,
  trickSpan,
} from "../src/scripts/game/rules.js";
import { endless, levels } from "../src/scripts/game/levels.js";

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

  // An enemy that only lines up vertically once it has already drifted very
  // close to the muzzle used to still get a shot: it would spawn, cross the
  // whole (tiny) distance and connect within the same frame or two, so the
  // player never saw a bullet in flight — the enemy just vanished. `minRange`
  // withholds the round instead of firing something unwatchable.
  const MIN_RANGE = 80;

  it("holds fire at point-blank range, below minRange", () => {
    expect(enemyInFiringLine(shot, [enemy(444, 280)], RANGE, MIN_RANGE)).toBe(
      false,
    ); // 20px ahead
  });

  it("fires once the enemy clears minRange", () => {
    expect(enemyInFiringLine(shot, [enemy(520, 280)], RANGE, MIN_RANGE)).toBe(
      true,
    ); // 96px ahead
  });

  it("still fires at the old default when minRange is omitted", () => {
    // No caller passes a bare 20px-ahead enemy today, but the default has to
    // stay the pre-minRange behaviour for anything that doesn't opt in.
    expect(enemyInFiringLine(shot, [enemy(444, 280)], RANGE)).toBe(true);
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

  it("never narrows a gap below the floor, and the floor clears the tallest bird", () => {
    for (const key of [1, 2, 3, 4] as const) {
      const p = levels[key].pacing;
      expect(shortenGap(p.gap, p.narrowBy)).toBeGreaterThanOrEqual(GAP_FLOOR);
      // closeByMax is the deepest a springing pair can roll; even that stays
      // clamped at the floor rather than passing through it.
      expect(shortenGap(p.gap, p.closeByMax)).toBeGreaterThanOrEqual(GAP_FLOOR);
    }
    // The bird is at most 64 tall, in level 1.
    expect(GAP_FLOOR).toBeGreaterThan(64);
  });
});

// A fixed 200px on every pair but the tricked ones read as a metronome:
// level 2 and level 3 now roll a fresh opening per pair instead, between
// `ordinaryGapMin` and the level's base gap. Levels 1 and 4 keep the old
// constant — they set no `ordinaryGapMin` at all.
describe("randomGap", () => {
  const seeded = (values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  it("stays inside its own range, at both ends and in between", () => {
    const pacing = { gap: 200, ordinaryGapMin: 125 };
    expect(randomGap(pacing, seeded([0]))).toBe(125);
    expect(randomGap(pacing, seeded([0.9999]))).toBeLessThan(200);
    expect(randomGap(pacing, seeded([0.5]))).toBeCloseTo(162.5);
  });

  it("only levels 2 and 3 roll it — 1 and 4 keep a constant opening", () => {
    expect("ordinaryGapMin" in levels[1].pacing).toBe(false);
    expect("ordinaryGapMin" in levels[2].pacing).toBe(true);
    expect("ordinaryGapMin" in levels[3].pacing).toBe(true);
    expect("ordinaryGapMin" in levels[4].pacing).toBe(false);
  });

  it("never rolls below the trick floor, so a trick always cuts further", () => {
    // If the roll's own floor sat at or below GAP_FLOOR, a trick applied to
    // the lowest rolls would clamp back up to the floor instead of cutting
    // — a "narrowed" pair ending up wider than the plain one beside it.
    for (const key of [2, 3] as const) {
      expect(levels[key].pacing.ordinaryGapMin).toBeGreaterThan(GAP_FLOOR);
    }
  });

  it("a trick still cuts a real amount off even the lowest roll", () => {
    for (const key of [2, 3] as const) {
      const p = levels[key].pacing;
      expect(shortenGap(p.ordinaryGapMin, p.narrowBy)).toBeLessThan(
        p.ordinaryGapMin,
      );
      // closeByMin is the *shallowest* the closing trick ever rolls — even
      // that still has to cut something off the lowest possible spawn.
      expect(shortenGap(p.ordinaryGapMin, p.closeByMin)).toBeLessThan(
        p.ordinaryGapMin,
      );
    }
  });
});

// A trick nobody notices is not a difficulty step, it is a rendering
// coincidence. Both halves of that were true: the depth was ~10% of the gap,
// and the pair it was planned for often never spawned.
describe("a gap trick is deep enough to see", () => {
  it("takes at least a fifth of the gap away, in every level", () => {
    for (const key of [1, 2, 3, 4] as const) {
      const p = levels[key].pacing;
      expect(p.narrowBy / p.gap).toBeGreaterThanOrEqual(0.2);
    }
  });

  it("makes a pair that springs shut bite harder than one born short", () => {
    // A short gap can be read from across the screen and lined up against; one
    // that closes on the approach cannot, so it has to cost more to be worth
    // the surprise. Compared at its deepest roll, since the depth now varies.
    for (const key of [2, 3, 4] as const) {
      const p = levels[key].pacing;
      expect(p.closeByMax).toBeGreaterThan(p.narrowBy);
    }
  });

  it("never takes a gap below the floor, however deep the trick", () => {
    expect(shortenGap(200, 40)).toBe(160);
    expect(shortenGap(160, 70)).toBe(GAP_FLOOR);
    expect(shortenGap(GAP_FLOOR, 999)).toBe(GAP_FLOOR);
  });
});

// A single fixed depth subtracted from an already-random spawn mostly hit the
// floor regardless of what it rolled: for most of a level's spawn range,
// spawn - depth landed below GAP_FLOOR, so nearly every closing pair ended at
// exactly the same final width, no matter how far apart their spawns were.
// Rolling the depth itself is the fix.
describe("rollCloseBy", () => {
  const seeded = (values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  it("stays inside its own range, at both ends", () => {
    const pacing = { closeByMin: 25, closeByMax: 65 };
    expect(rollCloseBy(pacing, seeded([0]))).toBe(25);
    expect(rollCloseBy(pacing, seeded([1]))).toBe(65);
  });

  it("two draws on the same spawn can end at two different final widths", () => {
    // This is the bug, made concrete: before, closeBy was one fixed number,
    // so a given spawn always closed to the same final width. Two different
    // rolls of the depth must be able to produce two different results.
    const pacing = { closeByMin: 25, closeByMax: 65 };
    const spawn = 190;
    const shallow = shortenGap(spawn, rollCloseBy(pacing, seeded([0])));
    const deep = shortenGap(spawn, rollCloseBy(pacing, seeded([1])));
    expect(shallow).not.toBe(deep);
    expect(deep).toBeLessThan(shallow);
  });

  it("a deep-enough roll still legitimately bottoms out at the floor", () => {
    // "Compress a lot" should sometimes mean the floor — the bug was that it
    // ALWAYS did, not that it never should.
    const pacing = { closeByMin: 25, closeByMax: 65 };
    expect(shortenGap(80, rollCloseBy(pacing, seeded([1])))).toBe(GAP_FLOOR);
  });
});

// The pair that comes in at a plain height and then springs shut once the bird
// is committed. Level 1 never does it; level 2 does it three times a run and
// level 3 five, before the win screen — after which the endless run rolls it
// by chance rather than by a count, because there is no run length left to
// count against.
describe("the pair that springs shut", () => {
  it("is not in level 1 at all", () => {
    expect(levels[1].pacing.closingGaps).toBe(0);
  });

  it("happens three times in level 2 and five in level 3", () => {
    expect(levels[2].pacing.closingGaps).toBe(3);
    expect(levels[3].pacing.closingGaps).toBe(5);
  });

  it("never plans more tricks than a level's own window can hold", () => {
    // The window a level's tricks are drawn from is bounded by how many
    // pairs the run can actually reach (trickSpan) — raising closingGaps
    // without checking this is exactly how a trick used to go unplayed.
    for (const key of [1, 2, 3, 4] as const) {
      const level = levels[key];
      const span = trickSpan(
        level.num[0].scoreC,
        level.num[0].enemyC,
        level.pacing.firstRandom,
      );
      const total = level.pacing.narrowGaps + level.pacing.closingGaps;
      expect(total).toBeLessThanOrEqual(span);
    }
  });

  // The numbers the game actually runs with. The bird never moves
  // horizontally, so its nose is a constant: 360 plus the sprite's 48.
  const NOSE = 408;
  const TRIGGER = 180;
  const TRAVEL = 45;
  const SPAWN = 800;
  const at = (x: number) => snapProgress(x, NOSE, TRIGGER, TRAVEL);

  it("comes in at the height it spawned with", () => {
    // The point of it: from across the screen it has to look like an ordinary
    // gap, or there is no surprise to spring.
    expect(at(SPAWN)).toBe(0);
    expect(at(700)).toBe(0);
    expect(at(NOSE + TRIGGER)).toBe(0);
  });

  it("shuts over a distance short enough to be an event", () => {
    // Half a second at level 3's 2.9px per 30ms tick, against 340px — about
    // three and a half seconds — for the version nobody noticed.
    expect(at(NOSE + TRIGGER - TRAVEL / 2)).toBeCloseTo(0.5);
    expect(at(NOSE + TRIGGER - TRAVEL)).toBe(1);
    const seconds = TRAVEL / ((2.9 / 30) * 1000);
    expect(seconds).toBeLessThan(0.6);
  });

  it("finishes shutting with runway left to answer it", () => {
    // Where the pair is when the gap stops moving, measured from the bird.
    const runway = TRIGGER - TRAVEL;
    expect(at(NOSE + runway)).toBe(1);
    // Over a second at the fastest level speed in the game.
    expect(runway / ((2.9 / 30) * 1000)).toBeGreaterThan(1);
  });

  it("stays shut once it has shut", () => {
    expect(at(NOSE)).toBe(1);
    expect(at(0)).toBe(1);
    expect(at(-500)).toBe(1);
  });
});

// Why a planned trick could go a whole run without happening: a point comes
// from shooting an enemy as well as from flying past a pair, so a level with
// enemies reaches its target in fewer pairs than the target names. Planning
// against `targetScore + 3` put level 1's single narrow gap somewhere in
// indices 2..9 while only five pairs ever spawned.
describe("trickSpan", () => {
  it("keeps every level's plan inside the pairs it actually spawns", () => {
    for (const key of [1, 2, 3, 4] as const) {
      const level = levels[key];
      const span = trickSpan(
        level.num[0].scoreC,
        level.num[0].enemyC,
        level.pacing.firstRandom,
      );
      const lastPlannable = level.pacing.firstRandom + span - 1;
      // Every point that is not a kill is a pair flown past, so this is the
      // last pair index the run can reach.
      const lastPair = level.num[0].scoreC - level.num[0].enemyC;
      expect(lastPlannable).toBeLessThanOrEqual(lastPair);
    }
  });

  it("shrinks the window as a level hands out more of its points for kills", () => {
    expect(trickSpan(15, 0, 1)).toBeGreaterThan(trickSpan(15, 3, 1));
  });

  it("never collapses to nothing", () => {
    expect(trickSpan(2, 5, 2)).toBe(2);
  });
});

// Obstacle density. It used to be a fixed 6000ms between pairs, which is not a
// fixed distance: the faster a level ran, the further apart its obstacles
// landed, so level 3 flew through 580px of clear air where level 1 flew
// through 400. Spacing is authored in pixels now, and it closes up as the
// score climbs rather than being a property of the level.
describe("obstacle density rises with the score", () => {
  it("holds the base at the first point and eases down from there", () => {
    expect(tighten(400, 10, 0, 240)).toBe(400);
    expect(tighten(400, 10, 5, 240)).toBe(350);
  });

  it("holds at the floor rather than passing through it", () => {
    expect(tighten(400, 10, 50, 240)).toBe(240);
    expect(tighten(400, 10, 5000, 240)).toBe(240);
  });

  it("treats a score behind the baseline as no progress", () => {
    expect(tighten(400, 10, -8, 240)).toBe(400);
    expect(climb(0.2, 0.02, -8, 0.6)).toBe(0.2);
  });

  it("climbs to a ceiling and stops there", () => {
    expect(climb(0.2, 0.02, 0, 0.6)).toBeCloseTo(0.2);
    expect(climb(0.2, 0.02, 10, 0.6)).toBeCloseTo(0.4);
    expect(climb(0.2, 0.02, 500, 0.6)).toBe(0.6);
  });

  it("closes the field up over the course of every level", () => {
    for (const key of [1, 2, 3, 4] as const) {
      const level = levels[key];
      const opening = pairSpacing(level.pacing, 0);
      const closing = pairSpacing(level.pacing, level.num[0].scoreC);
      expect(closing).toBeLessThan(opening);
      expect(closing).toBeGreaterThanOrEqual(level.pacing.minSpacing);
    }
  });

  it("ends level 3 denser than level 1 ever begins", () => {
    // The thing the fixed millisecond interval had backwards.
    expect(pairSpacing(levels[3].pacing, 15)).toBeLessThan(
      pairSpacing(levels[1].pacing, 0),
    );
  });

  it("waits less for the same spacing when the world moves faster", () => {
    const slow = pairIntervalMs(400, 2, 30);
    const fast = pairIntervalMs(400, 2.9, 30);
    expect(fast).toBeLessThan(slow);
    // 400px at 2px per 30ms tick is 200 ticks, which is 6000ms — the number
    // the old fixed interval happened to be right about, for level 1 only.
    expect(slow).toBe(6000);
  });
});

// The run level 3 offers instead of stopping. It has no target and no ending,
// so its difficulty cannot be a table of levels: every dial is a function of
// how far past the win the player has got.
describe("the endless run", () => {
  const AT_WIN = 0; // progress is counted from the score that won level 3
  const DEEP = 40;

  it("starts no harder than the level it continues from", () => {
    expect(pairSpacing(endless, AT_WIN)).toBeGreaterThanOrEqual(
      pairSpacing(levels[3].pacing, 15),
    );
    expect(pairGap(endless, AT_WIN)).toBeGreaterThanOrEqual(
      pairGap(levels[3].pacing, 15),
    );
  });

  it("ends up tighter than level 3 ever was", () => {
    expect(pairSpacing(endless, DEEP)).toBeLessThan(
      pairSpacing(levels[3].pacing, 15),
    );
    expect(pairGap(endless, DEEP)).toBeLessThan(
      pairGap(levels[3].pacing, 15),
    );
  });

  it("closes the gap itself, which a numbered level never does", () => {
    for (const key of [1, 2, 3, 4] as const) {
      expect(levels[key].pacing.gapPerPoint).toBe(0);
    }
    expect(endless.gapPerPoint).toBeGreaterThan(0);
    expect(pairGap(endless, 10)).toBeLessThan(pairGap(endless, 0));
  });

  it("keeps every gap flyable however long the run goes on", () => {
    expect(pairGap(endless, 10_000)).toBe(endless.minGap);
    expect(shortenGap(pairGap(endless, 10_000), endless.closeByMax)).toBe(
      GAP_FLOOR,
    );
    // The bird is 48 tall in level 3's skin, and this is the tightest the run
    // can ever get.
    expect(GAP_FLOOR).toBeGreaterThan(48 * 2);
  });

  it("springs gaps shut more and more often, up to a ceiling", () => {
    expect(snapChance(endless, 20)).toBeGreaterThan(snapChance(endless, 0));
    expect(snapChance(endless, 10_000)).toBe(endless.maxSnapChance);
    expect(narrowChance(endless, 20)).toBeGreaterThan(narrowChance(endless, 0));
    expect(narrowChance(endless, 10_000)).toBe(endless.maxNarrowChance);
  });

  it("never makes a trick a certainty", () => {
    // Something has to stay ordinary, or there is nothing for a trick to be a
    // departure from.
    expect(endless.maxSnapChance).toBeLessThan(1);
    expect(endless.maxNarrowChance).toBeLessThan(1);
  });

  it("sends enemies closer together, in whole pairs, down to a floor", () => {
    const early = enemyInterval(endless, 0);
    const late = enemyInterval(endless, DEEP);
    expect(late).toBeLessThan(early);
    expect(Number.isInteger(early)).toBe(true);
    expect(Number.isInteger(late)).toBe(true);
    expect(enemyInterval(endless, 10_000)).toBe(endless.minEnemyInterval);
    // Never every pair: an enemy sits in the gap, and a gap with an enemy in
    // it every time is a wall.
    expect(endless.minEnemyInterval).toBeGreaterThan(1);
  });

  it("issues ammo faster than it issues enemies", () => {
    // Enemies keep coming and rounds are finite, so a run that hands out
    // fewer rounds than enemies ends in gaps that can be neither flown
    // through nor shot open.
    const pairsPerEnemy = endless.minEnemyInterval;
    const pointsPerRound = endless.ammoEvery;
    expect(pointsPerRound).toBeGreaterThanOrEqual(pairsPerEnemy);
    expect(endless.maxAmmo).toBeGreaterThan(0);
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
