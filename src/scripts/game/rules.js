// Game rules, kept free of the canvas and the DOM so they can be tested
// directly rather than inferred from a rendered frame.

// Do two axis-aligned rectangles overlap? Both must carry x, y, width and
// height, which every sprite in this game already does.
//
// This replaces a four-corner test that asked "is any corner of A inside B".
// That question is not the same question: two rectangles can overlap with no
// corner of either inside the other — a short wide rectangle crossing a tall
// narrow one overlaps in a cross shape, and every corner sits outside. The
// bird could fly through the middle of a cactus untouched.
//
// Touching edges are not an overlap: the comparisons are strict, so a bird
// whose right edge is exactly the obstacle's left edge is still alive.
export function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
