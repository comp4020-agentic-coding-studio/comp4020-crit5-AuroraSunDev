# Process overview

## What I built

DesertBird: hold to fly up, release to fall, thread a bird through cactus gaps
to a target score. Losable, and it ends. It existed as a 2023 project of mine —
seven global `<script>` tags with a Chinese instruction panel. This brief
forbids instructions, so the work was a port plus a redesign replacing every
word with one control you learn by pressing it.

## The moments that mattered

**1. Making the test fail first.** I extracted the collision check into a pure
`rectsOverlap`. Rather than trust eight green ticks, I pasted the old
four-corner rule back over it to watch it fail. Four cases broke, and one
exposed a bug I hadn't known about: the old rule sampled only one rectangle's
corners, so a bird *containing* an obstacle registered no hit. The same run
failed my zero-area case — that assertion was mine and it was wrong, so I
deleted it rather than bend the rule to fit it.
[`4a5706e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-AuroraSunDev/commit/4a5706e)

**2. The bug a screenshot can't see.** A responsive canvas is four lines of CSS
and the screenshots look perfect. They lie: every hit-test is written against a
fixed 800×600 buffer, so any other display size sends taps to the wrong
coordinate space and buttons silently die. I shipped the scaling and the
coordinate conversion together, then verified by interaction — CDP device
emulation for a true 390×844 viewport, not `--window-size`, which headless
clamps near 490px. Canvas displayed at 366×275; dispatched touches still hit
the play icon.
[`1935e09`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-AuroraSunDev/commit/1935e09)

**3. Porting without improving.** The port commit changes no behaviour: it
keeps the forbidden instruction panel, the Enter-only restart, and a `NaN` bug
freezing enemy animation. I reverted my own ternary tidy-up in `Bird.draw`,
which altered an unknown-input branch. With the refactor provably neutral, any
visual change in the next commit can only be the redesign — so I know where to
look when something breaks.
[`06883af`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-AuroraSunDev/commit/06883af)
