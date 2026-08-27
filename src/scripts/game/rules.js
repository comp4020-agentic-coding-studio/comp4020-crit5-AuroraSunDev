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

// Does a rectangle touch the opaque part of a sprite, row by row?
//
// The rectangle test above asks whether two boxes overlap. For a tall
// irregular sprite like the cactus that is far too generous: the box is 90px
// wide where the plant is 34, so the bird died with daylight still showing.
// This walks only the rows the two actually share and asks, for each, whether
// the rectangle reaches the opaque pixels in that row.
//
// `mask` is { x, y, height, spans, baseRow }, where spans[baseRow + dy] is
// {min, max} in sprite-local x for the row dy down from the sprite's top, or
// null for a row with nothing in it.
export function rectHitsMask(rect, mask) {
  const first = Math.max(0, Math.floor(rect.y - mask.y));
  const last = Math.min(mask.height, Math.ceil(rect.y + rect.height - mask.y));
  const left = rect.x;
  const right = rect.x + rect.width;

  for (let dy = first; dy < last; dy++) {
    const span = mask.spans[mask.baseRow + dy];
    if (span == null) {
      continue;
    }
    // +1 because `max` is the last opaque pixel, not the edge past it.
    if (left < mask.x + span.max + 1 && right > mask.x + span.min) {
      return true;
    }
  }
  return false;
}

// No trick, and no amount of progress, takes a pair's gap below this. The
// bird is 48px tall in levels 2-4 and 64 in level 1, so a gap this size is
// threadable but leaves nothing to drift with.
//
// Set below `ordinaryGapMin` (the lowest an untricked pair can roll to) on
// purpose: a trick has to make a real cut off whatever the pair rolled, and
// if the floor sat above that roll the cut would be clamped back up instead
// — a "narrowed" pair ending up wider than the plain one next to it.
export const GAP_FLOOR = 100;

// A quantity that tightens as a run goes on and then holds. The gap inside an
// obstacle pair and the distance between consecutive pairs both move this way,
// so they share one rule: linear in the score, clamped at a floor.
//
// Progress is counted in points rather than seconds. A point is the unit the
// player can see — the number at the top of the screen — and a pure function
// of the score is testable without a clock, which a function of elapsed time
// is not.
export function tighten(base, perPoint, progress, floor) {
  return Math.max(floor, base - Math.max(0, progress) * perPoint);
}

// The same shape upward, for the things that get more common rather than
// tighter: how often the endless run springs a gap shut, how often it narrows
// one from the start.
export function climb(base, perPoint, progress, ceiling) {
  return Math.min(ceiling, base + Math.max(0, progress) * perPoint);
}

export function pairGap(pacing, progress) {
  return tighten(pacing.gap, pacing.gapPerPoint, progress, pacing.minGap);
}

export function pairSpacing(pacing, progress) {
  return tighten(
    pacing.spacing,
    pacing.spacingPerPoint,
    progress,
    pacing.minSpacing,
  );
}

// A trick shortens a gap by `by`, but never past the floor.
export function shortenGap(gap, by) {
  return Math.max(GAP_FLOOR, gap - by);
}

// The opening an ordinary (non-tricked) pair spawns with, in levels 2 and 3.
// Every pair but the first rolls its own width uniformly between
// `ordinaryGapMin` and the level's base gap, rather than spawning at that
// base gap every time — a metronome even before any trick is layered on.
// `random` is injectable so the roll can be tested.
export function randomGap(pacing, random = Math.random) {
  const span = pacing.gap - pacing.ordinaryGapMin;
  return pacing.ordinaryGapMin + random() * span;
}

// How much a springing pair's gap shrinks, in px — rolled between
// `closeByMin` and `closeByMax` rather than a single fixed depth.
//
// A fixed depth subtracted from an already-random spawn gap sounds varied but
// mostly isn't: `shortenGap` clamps at the floor, and for most of the spawn
// range `spawn - fixedDepth` landed below it, so nearly every closing pair
// ended at exactly `GAP_FLOOR` regardless of what it rolled — "sometimes a
// little, sometimes a lot" collapsing to "always the same amount". Rolling
// the depth too spreads the *final* width out again: a shallow roll on a wide
// spawn stays open, a deep roll on a narrow one still bottoms out (correctly
// — "compress a lot" should sometimes mean the floor), but the two no longer
// coincide on every pair.
export function rollCloseBy(pacing, random = Math.random) {
  const span = pacing.closeByMax - pacing.closeByMin;
  return pacing.closeByMin + random() * span;
}

// How long to wait before spawning the next pair, for a spacing given in
// pixels. Spacing is authored in pixels because pixels are what the player
// reads: held at a fixed 6000ms, a faster level quietly spread its obstacles
// *further* apart — level 3 ran 580px between pairs where level 1 ran 400.
export function pairIntervalMs(spacingPx, obsSpeed, tickMs) {
  return (spacingPx * tickMs) / obsSpeed;
}

// How far through its closure a snapping pair is, 0 to 1.
//
// It holds the height it spawned with until its leading edge is
// `triggerAhead` px in front of the bird's nose, and then shuts over `travel`
// px. The version this replaces eased the gap closed across the whole
// approach — 340px of travel for 20px of change — which is a real difference
// nobody can perceive happening. A change has to be sudden to be an event,
// and it has to finish with open runway left or it is not a hazard the player
// can answer, just one they are told about too late.
export function snapProgress(pairX, noseX, triggerAhead, travel) {
  const travelled = noseX + triggerAhead - pairX;
  if (travelled <= 0) {
    return 0;
  }
  return Math.min(1, travelled / travel);
}

// The endless run has no end, so its tricks cannot be planned as a list of
// pair indices the way a level's are. They are rolled per pair against a
// chance that climbs with the score.
export function snapChance(pacing, progress) {
  return climb(
    pacing.snapChance,
    pacing.snapChancePerPoint,
    progress,
    pacing.maxSnapChance,
  );
}

export function narrowChance(pacing, progress) {
  return climb(
    pacing.narrowChance,
    pacing.narrowChancePerPoint,
    progress,
    pacing.maxNarrowChance,
  );
}

// Obstacles between one enemy and the next, closing up as the run goes on.
export function enemyInterval(pacing, progress) {
  return Math.round(
    tighten(
      pacing.enemyInterval,
      pacing.enemyIntervalPerPoint,
      progress,
      pacing.minEnemyInterval,
    ),
  );
}

// How wide a window of pair indices a level's tricks may be planned into.
//
// A point comes from flying past a pair *or* from shooting an enemy, so a
// level with enemies reaches its target in fewer pairs than the target
// suggests. Planning against `targetScore + 3` was why a run could finish
// having played no trick at all: level 1 picked its single narrow gap from
// indices 2..9 while only five pairs ever spawned.
export function trickSpan(targetScore, enemyCount, firstRandom) {
  return Math.max(2, targetScore - enemyCount - firstRandom);
}

// Which obstacle pairs get a difficulty trick played on them.
//
// Picks `count` distinct pair indices from the `span` pairs starting at
// `firstIndex`. The opening pair is never in range: a player who meets a
// narrowed gap before they have flown through a plain one has no idea the
// gap was narrowed, so the trick reads as the game being broken.
//
// `random` is injectable so the choice can be tested; it defaults to
// Math.random in play.
export function pickPairIndices(count, firstIndex, span, random = Math.random) {
  if (count <= 0 || span <= 0) {
    return [];
  }
  const pool = [];
  for (let i = 0; i < span; i++) {
    pool.push(firstIndex + i);
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const swap = pool[i];
    pool[i] = pool[j];
    pool[j] = swap;
  }
  return pool.slice(0, Math.min(count, pool.length));
}

// What trick, if any, this obstacle pair gets: "narrow" for a gap that is
// already short, "closing" for one that starts normal and squeezes shut as the
// bird nears, "none" otherwise.
//
// `narrowAt` and `closingAt` are the planned indices in ascending order. The
// comparison is `>=` rather than `===` on purpose: a planned index that landed
// on a pair carrying an enemy is skipped rather than lost, so it fires on the
// next eligible pair instead of silently never happening. The caller drops the
// head of whichever queue matched.
export function nextPairTrick(
  pairIndex,
  firstRandom,
  carriesEnemy,
  narrowAt,
  closingAt,
) {
  // Two hazards on one pair is a wall, not a difficulty step; and nobody
  // should meet a trick before flying through a plain gap.
  if (carriesEnemy || pairIndex < firstRandom) {
    return "none";
  }
  if (narrowAt.length > 0 && pairIndex >= narrowAt[0]) {
    return "narrow";
  }
  if (closingAt.length > 0 && pairIndex >= closingAt[0]) {
    return "closing";
  }
  return "none";
}

// Is any enemy worth spending a round on? The bird fires by itself, so this
// is the whole of the decision: there is no player to blame for a wasted shot,
// and ammo is finite, so firing at something unhittable is a bug rather than
// a miss.
//
// A shot only ever travels right, at a fixed height, so an enemy qualifies
// only if it is ahead of the muzzle, at least `minRange` and less than `range`
// away, and already vertically level with the shot. `shot` and each enemy are
// {x, y, width, height}.
//
// `minRange` exists because "ahead" alone let this fire at point-blank range:
// an enemy that only lines up vertically once it has already drifted very
// close to the muzzle got a shot that spawned, travelled its whole distance
// and connected within the same frame or two — the bullet was never visibly
// in flight, so a player saw the enemy vanish with no shot fired at all.
// Below `minRange` the bird holds its round rather than fire something
// unwatchable; the enemy has to be dealt with by dodging instead.
export function enemyInFiringLine(shot, enemies, range, minRange = 0) {
  return enemies.some((enemy) => {
    const ahead = enemy.x - shot.x;
    return (
      !enemy.defeat &&
      ahead > 0 &&
      ahead >= minRange &&
      ahead < range &&
      shot.y < enemy.y + enemy.height &&
      shot.y + shot.height > enemy.y
    );
  });
}
