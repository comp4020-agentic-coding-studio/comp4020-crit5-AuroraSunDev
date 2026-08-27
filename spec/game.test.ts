import { describe, expect, it } from "vitest";
import { rectsOverlap } from "../src/scripts/game/rules.js";

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
