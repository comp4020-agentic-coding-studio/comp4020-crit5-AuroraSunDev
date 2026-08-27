# Process overview

## What I built

DesertBird: hold to fly up, release to fall, thread a bird through cactus gaps
to a target score. Losable, and it ends; clearing level 3 opens an endless run
that finishes only by crashing. It was a 2023 project of mine — seven global
`<script>` tags with a Chinese instruction panel. This brief forbids
instructions, so the work was a port plus a redesign replacing every word with
one control you learn by pressing it.

## The moments that mattered

**1. Making the test fail first.** I extracted the collision check into a pure
`rectsOverlap`. Rather than trust eight green ticks, I pasted the old
four-corner rule back to watch it fail. Four cases broke, one exposing a bug I
hadn't known about: it sampled only one rectangle's corners, so a bird
*containing* an obstacle registered no hit. The same run failed my zero-area
case — that assertion was mine and it was wrong, so I deleted it rather than
bend the rule to fit it.
[`4a5706e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-AuroraSunDev/commit/4a5706e)

**2. The bug a screenshot can't see.** A responsive canvas is four lines of CSS
and the screenshots look perfect. They lie: every hit-test is written against a
fixed 800×600 buffer, so at any other display size taps land in the wrong space
and buttons silently die. I shipped the scaling and the conversion together,
then verified by interaction — CDP device emulation for a true 390×844
viewport, not `--window-size`, which headless clamps near 490px. Canvas at
366×275; dispatched touches still hit the icon.
[`1935e09`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-AuroraSunDev/commit/1935e09)

**3. The bug only playing could find.** Playing it, every gap that sprang shut
shut to the *same* width. The design read as correct — random spawn gap, depth
subtracted from it — and the suite stayed green, because every test asserted a
range and none asserted the spread of outcomes. One fixed depth, clamped at a
floor, put four spawns in five on exactly the floor. It is rolled per pair now.
I reproduced it as a regression test afterwards; no test I would have written
first would have caught it.
[`b122322`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-AuroraSunDev/commit/b122322)
