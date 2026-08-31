# Process overview

## What I built

DesertBird: hold to fly up, release to fall, thread a bird through cactus gaps
to a target score; clearing level 3 opens an endless run that ends only by
crashing. It's a port of a 2023 project of mine, redesigned so nothing on or
off screen ever needs to explain itself in words.

## The moments that mattered

**1. A playtester died with daylight still showing.** My own tests and
screenshots all passed, but watching a friend play showed the cactus's hitbox
was far bigger than the plant drawn on screen — over half of it was empty air
inside the sprite's bounding box, so the bird died beside the cactus, not in
it. Instead of nudging the box by feel, I measured each sprite's alpha channel
once at load and collided row-by-row against its real outline, which caught a
matching bug in the enemy sprite too.
[`289529e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-AuroraSunDev/commit/289529e)

**2. The same friend didn't know the game had started.** Dropped into level 1,
they didn't realise a click did anything until the bird was already falling.
The brief forbids on-screen text, so I couldn't just say "click here": I
reused the wordless-icon convention already built for the play button — an
animated click-and-mouse icon that holds the level until the first click
dismisses it — and verified the gate at both graded viewports with CDP device
emulation before shipping.
[`8ed958e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-AuroraSunDev/commit/8ed958e)

**3. The bug a screenshot can't see.** The canvas scales for display, but
every hit-test is written against its fixed 800x600 buffer — past a certain
size a tap looks right on screen and lands nowhere, and no screenshot shows
it. I verified with a real dispatched touch under CDP device emulation at
390x844, rather than trusting the render.
[`1935e09`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-AuroraSunDev/commit/1935e09)
