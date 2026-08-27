# DesertBird — crit 5

Port an existing 2023 vanilla-JS Flappy-Bird-style game into this week's Astro
repo and make it answer the crit-5 brief. This file records what was decided
and what is still open, not how the decisions were reached.

## Constraints

These are fixed. Anything that violates one is wrong, however well it plays.

- **No instructions anywhere, on or off screen.** The game teaches itself. This
  is the constraint that drove most of the design: every control is either
  discoverable by looking at it or performed by the game itself.
- **A stranger reaches an ending within five minutes.** Losable, and it ends
  (Game Over or You Win).
- **One rule carries a focused automated test.** Answered by `spec/game.test.ts`.
- **Both graded viewports count**: 1920x1080 and 390x844.
- **`spec/invariants.test.ts` stays green**: a nav landmark, exactly one `<h1>`,
  document language, title, meta description, `og:image`, mobile viewport, alt
  text on images.
- **`pnpm check` green before every commit**; `pnpm check:evidence` before
  shipping.
- **The deployed site is what gets marked**, not the repo.
- **`PROCESS.md` is 150–300 words** for a crit week; reflections likewise.

## Architecture

**Assets → `public/game/`.** The game loads these by runtime string path rather
than a bundler import, so they must sit under `public/` or they 404 once built.

```
public/game/
  img/        DesertBird's own sprites and backgrounds
              (GameStartBG1 is a 280KB JPEG; the three unused Pokémon PNGs
              were never copied across)
  img/ui/     the flappybird.io kit: button_play, text_ready, text_game_over,
              number_score_00..09
  audio/      attack, bgsound, bullet, over, win
```

**Code → `src/scripts/`.** Plain JS ES modules; no TypeScript rewrite. `main.ts`
is the only TypeScript file.

```
src/scripts/
  main.ts          finds #game-canvas, waits for the pixel font, calls initGame
  game/
    state.js       all mutable state that crosses a module boundary
    paths.js       asset() — resolves runtime URLs against BASE_URL
    levels.js      the level table with each level's `pacing` block, and the
                   `endless` block that level 3's win screen can continue into
    rules.js       pure game rules; the only module the spec suite imports
    mask.js        hitboxes measured from sprite alpha channels
    ui.js          shared screen furniture, pixel font, digit rendering
    flappyBird.js  the game class
    init.js        bootstrap, screens, input, the frame loop
    sprites/       bird.js  obstacle.js  enemy.js  bullet.js
```

Load-bearing decisions:

- **One shared `state` object.** The original's two largest files read each
  other's globals in both directions — a real cycle. ES modules cannot
  reassign an imported binding, so everything mutable that crosses a module
  boundary lives on one exported object.
- **`rules.js` holds the pure rules** — collision, firing, pair selection —
  precisely so the spec suite can test them without a canvas, a browser or a
  running loop.
- **`asset()` resolves against `import.meta.env.BASE_URL`.** A bare
  `"img/bird.png"` resolves against the current document URL and breaks when
  the page is served without a trailing slash.
- **`tsconfig.json` needs no change.** `allowJs` is already true in
  `astro/tsconfigs/base.json`.

## Gameplay decisions

**Opening screen.** Desert background, the game's name, `text_ready.png` as a
status banner, and `button_play.png` at 2.5x breathing on a sine wave so it
reads as tappable within a second. No instruction text of any kind.

**End screens.** `text_game_over.png`, or "You Win" as drawn text (no asset was
supplied, and it is a status word). Both show the same play icon again as an
on-screen restart — the player already learned it. Enter still reloads as a
second path.

Level 3's win screen and the end of an endless run ask a question instead, so
they carry two buttons: a house and the play arrow. The kit supplied no second
button, so the house is drawn — chrome and geometry both *measured* off
`button_play.png` rather than guessed. The asset is 116x70 but its chrome is
only 104x58 of that, inset 6px each side, 3 above and 9 below; a full-bleed
rounded rect beside it came out visibly larger, which a screenshot caught and
nothing else would have. Colours are sampled too: `#fafafa` over `#ededed`,
border `#543847`, a `#d6be9b` bevel line, glyph `#00a848`. The house itself is
a 13x11 bitmap drawn cell by cell, because everything else on the canvas is
pixel art and a smooth path would be the only curve on the screen.

**Level select.** Three tiles, English labels, no caption. The old bottom bar
("click the character you like to enter the level") was an instruction.

**Firing is automatic.** It was the A key, explained in the forbidden
instruction block. Removing that text left a control nobody could discover and
that a touch device cannot press at all, which also made level 4 unreachable
since the easter egg needs three kills. The bird now fires by itself when an
enemy is ahead, in range and level with the shot. Ammo stays finite and stays
on the HUD. The A key handler is gone: an undiscoverable control is what caused
this.

**Collision is against outlines, not boxes.** The cactus is a tall irregular
plant in a 90px sprite column; at its thin points only 34px is opaque, so more
than half the box was empty air and the bird died with daylight showing.
Sprites are measured once at load from their alpha channel; the cactus collides
row by row against its own outline, and the bird and enemy get tight boxes from
the same measurement. No need to split any PNG — the alpha channel already says
where the art is. A fixed inset would not work: the spikes do reach the sprite
edge on some rows.

**The frame loop is rAF with delta time.** Every movement is scaled by `step`,
the fraction of one original 30ms tick the frame covered, so frame rate never
becomes game speed. Deltas are clamped at 100ms. The loop waits for the bird
and the first obstacle pair before running, because `CountScore` reads
`obsList[0]` unguarded.

**Difficulty lives in one `pacing` block per level** in `levels.js`, so the
whole curve can be read in one place. Base gap 200px; floor 130px everywhere.

| | world speed | press throw | narrow gaps | springing gaps | pair spacing |
|---|---|---|---|---|---|
| 1 | 2.0 | 8 / 3 | 1 (−40px) | 0 | 400 → 330 |
| 2 | 2.4 | 8 / 3 | 2 (−48px) | 1 (−64px) | 420 → 320 |
| 3 | 2.9 | 11 / 4.5 | 3 (−56px) | 2 (−70px) | 460 → 290 |
| 4 | 2.9 | 11 / 4.5 | 2 (−56px) | 1 (−70px) | 460 → 290 |
| endless | 2.9 | 11 / 4.5 | 15%→45% of pairs | 18%→60% of pairs | 400 → 240 |

A *narrow* pair has a shorter gap from the moment it spawns; a *springing* pair
comes in at full height and slams shut on the approach. Two exclusions, both
deliberate: **no level tricks its opening pair** (a trick before a plain gap
just reads as a broken gap), and **no pair carrying an enemy is tricked** (two
hazards at once is a wall, not a step up). A pick that lands on an enemy pair
is not lost — it falls through to the next eligible pair.

**A trick nobody notices is not a difficulty step.** Both halves of that were
true of the first version, and each had its own cause.

- **The depth was ~10% of the gap.** 20px out of 200 is a real difference and
  an imperceptible one. Now a fifth to a third, which the spec suite asserts as
  a ratio rather than a magic number.
- **The pair it was planned for often never spawned.** The pool was
  `targetScore + 3` wide, but a point comes from *shooting an enemy* as well as
  from flying past a pair, so a level with enemies reaches its target in fewer
  pairs than its target names. Level 1 picked its single narrow gap from
  indices 2..9 while five pairs ever spawned — better than even odds of a run
  with no trick in it at all. `trickSpan` subtracts the enemies.

**A springing pair snaps rather than eases.** It used to close 20px smoothly
across 340px of approach: real, gradual, and invisible. It now holds its spawn
height until its leading edge is 180px in front of the bird's nose, then shuts
over 45px — about half a second at level 3's speed. Measured on the real code:
gap 200 at x=620, 156 at x=560, 130 at x=500 and held. It finishes closing with
135px of runway left, roughly 1.4s to answer it. Both numbers matter: sudden
enough to be an event, finished early enough to be a hazard rather than an
ambush.

**Obstacle density is a distance, and it tightens with the score.** The
interval was a fixed 6000ms, which is not a fixed distance — the faster a level
ran, the further apart its obstacles landed, so level 3 flew through 580px of
clear air where level 1 flew through 400 and the hardest level had the airiest
field. Spacing is authored in pixels now and converted per frame
(`pairIntervalMs`), and it closes linearly with the score down to a floor. No
level has a fixed obstacle count; the field just keeps closing up for as long
as the player keeps scoring.

**Clearing level 3 is not the end of it.** The win screen offers the way home
*or* an endless run, and the endless run has no target and no win. It is not a
level: no `scoreC`, no `IsCleared`, no `jump`. Every dial from the table keeps
turning — the gap itself closes (1.5px a point to a 160 floor, which no
numbered level does), spacing closes to 240, enemies arrive every 2 pairs
instead of 5, and the springing gap goes from occasional to the normal state of
affairs. Its tricks are rolled per pair rather than planned as a list of
indices: a list has a length and this has none.

Four decisions inside it:

- **The score carries and becomes the baseline.** Fifteen points were earned;
  progress is counted from there, so the curve starts at its own beginning
  rather than fifteen points into itself.
- **Ammo keeps coming**, one round per 4 points to a cap of 6. Enemies sit in
  the gap, so an endless supply of enemies against a finite 4 rounds is a run
  that ends in gaps that can be neither flown through nor shot open.
- **The easter egg is switched off.** Being yanked into level 4 is an ending of
  sorts, and not ending is the whole of what this mode is.
- **The field restarts rather than resumes.** The win screen froze wherever the
  fifteenth point landed, which can be a wingtip from a cactus; dropping the
  player back into that is a death they had no part in.

**It has no losing.** Hitting something stops the run, and there was nothing to
win, so there is no `GAME OVER`. The screen is the final score in the digit
sprites at 5x, centred, and the same two buttons.

## Presentation

- **Page frame**: warm dark radial gradient taken from the game's own dusk sky,
  so the canvas reads as a lit screen rather than a box in white space.
- **Canvas sizing**: keeps its fixed 800x600 drawing buffer — all gameplay
  maths is authored against it — and is scaled for display only, ratio locked
  so it letterboxes. Takes whichever runs out first, page width or the height a
  4:3 box can have, capped at 1280 so the buffer is never upscaled past ~1.6x.
- **`<h1>` is visually hidden.** The canvas draws the title far better; kept in
  the DOM for screen readers and the one-h1 rule. The nav link stays as a
  landmark, styled back out of the art.
- **Canvas text is Press Start 2P**, loaded from Google Fonts and awaited in
  `main.ts` before drawing — a canvas substitutes a fallback silently, so a
  missed load would look like a design choice. Sizes are much smaller than the
  system-sans values they replaced because a pixel face is far wider per
  character. Outlines became drop shadows: a stroke at pixel-font weights fills
  in the counters. Level labels centre by `measureText`.
- **Score** is drawn with the `number_score` sprites, left-aligned: the bird
  flies a fixed column through the middle, so a centred score sits in its path.

## Touch and coordinates

Touch mirrors the mouse; mouse click and `touchend` both route through one
`HandlePrimaryTap` so the two paths cannot drift. `touchend` preventDefaults to
suppress the synthetic click.

`GetPointerPos` multiplies by `canvas.width / rect.width`. **This is mandatory,
not a nicety**: every hit-test is written against the 800x600 buffer, so once
the canvas is displayed at any other size, taps land in the wrong space and
every button silently stops responding — a page that looks perfect and does
nothing. No screenshot can catch it.

## Verification practice

Carried forward as how this repo checks itself:

- **Pure rules over browser probes.** Anything testable as a rule goes in
  `rules.js` and is unit-tested. Two browser probes were written and abandoned
  because they could not see their subject: auto-fire lands within a frame or
  two of a level starting, faster than a screenshot loop can baseline.
- **Make a new check fail for the right reason once.** Swapping the old rule
  back in must fail exactly the cases that name it.
- **Small viewport via CDP `Emulation.setDeviceMetricsOverride`**, not
  `--window-size`: headless clamps its own layout viewport near 490px and
  reports overflow that does not exist.
- **Measure motion by timing gates**, not by tracking the rightmost opaque
  pixel — that pins to the canvas edge while a wide sprite slides in and biases
  every reading low.
- **rAF motion needs real time.** Virtual time does not chain it.

- **A harness beats a screenshot for anything the loop produces.** The
  difficulty rework was checked by a scratch Astro page that instantiates
  `FlappyBird` with real images and calls `CreateObs` and `UpdateSnapPairs`
  directly, printing gaps and spacings to the DOM — no rAF, so
  `--virtual-time-budget` works on it, and it exercises the real modules rather
  than a copy. It is what caught that level 3's two springing pairs both defer
  to indices 7 and 8, and it is deleted rather than committed: a probe that
  ships is a page nobody maintains.

Current state: `astro check` 0 errors / 0 warnings / 0 hints, 85 tests green.

## Shipped

`f70746a` assets · `06883af` ES-module port · `5cffa2f` instructions removed ·
`1935e09` touch and responsive · `4a5706e` AABB collision rule and its test ·
`0826502` rAF and delta time · `eb93477` cleanup · `7f83422` asset and score
polish · `5eb2023` PROCESS.md · `be145ca` page and typography rework ·
`09d8097` auto-fire · `289529e` outline collision and level pacing ·
`ce8c987` PLAN.md as decisions

## Open

1. **The repo is private, so nothing is deployed.** Both CI jobs are gated on
   `!github.event.repository.private`, so every run so far has skipped and no
   Pages site exists. `/ship` flips the repo public and dispatches a run. This
   is the single blocking item: the deployed site is what gets marked.
2. **`reflections/crit-5.md` is empty.** 150–300 words, the two standing
   prompts. The student's to write.
3. **The whole difficulty rework is unvalidated by a human.** The numbers are
   checked — by the spec suite, and by a scratch harness that ran the real
   spawning code — but numbers are not feel, and every one of these is a
   judgement about feel: the press throw of 11 / 4.5, the new trick depths,
   whether 45px of travel reads as a slam or a glitch, whether 135px of runway
   is enough to answer one, and whether level 3 at 290px spacing is hard or
   unfair. **Play all three levels before the crit.**
4. **Level 4 has never been reached end to end.** Auto-fire makes the
   three-kill easter egg possible again, but nobody has played through to it.
   Note that level 3's enemy every 2 pairs means its five tricks all defer past
   pairs 2, 4 and 6 and land in the back half of the run — intended by the
   fall-through rule, but worth watching for bunching.
5. **The endless run has never been played.** Its escalation is asserted at 60
   pairs by the harness and by the suite, and its two-button screens have been
   rendered and looked at, but nobody has resumed into it from a real win.
   Watch for the two things the numbers cannot answer: whether the house icon
   reads as "home" with no caption, and whether a run that ends with a bare
   number reads as an ending at all.
6. **The person-judged spec lines are unverified**: no instructions anywhere,
   and a stranger reaching an ending within five minutes. These are not
   fakeable by a test — confirm with an actual first-time player before the
   crit.
