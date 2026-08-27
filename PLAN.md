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
    levels.js      the level table, including each level's `pacing` block
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
whole curve can be read in one place.

| | world speed | press throw (up/down) | narrow gaps | closing gaps | earliest pair |
|---|---|---|---|---|---|
| 1 | 2.0 | 8 / 3 | 1 (−20px) | 0 | 3rd |
| 2 | 2.4 | 8 / 3 | 2 (−20px) | 1 | 2nd |
| 3 | 2.9 | 11 / 4.5 | 3 (−24px) | 2 | 2nd |
| 4 | 2.9 | 11 / 4.5 | 2 (−24px) | 1 | 2nd |

A *narrow* pair has a shorter gap from the moment it spawns; a *closing* pair
starts normal and squeezes shut as the bird nears it. Two exclusions, both
deliberate: **no level tricks its opening pair** (a trick before a plain gap
just reads as a broken gap), and **no pair carrying an enemy is tricked** (two
hazards at once is a wall, not a step up). A pick that lands on an enemy pair
is not lost — it falls through to the next eligible pair.

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

Current state: `astro check` 0 errors / 0 warnings / 0 hints, 58 tests green.

## Shipped

`f70746a` assets · `06883af` ES-module port · `5cffa2f` instructions removed ·
`1935e09` touch and responsive · `4a5706e` AABB collision rule and its test ·
`0826502` rAF and delta time · `eb93477` cleanup · `7f83422` asset and score
polish · `5eb2023` PROCESS.md · `be145ca` page and typography rework ·
`09d8097` auto-fire · `289529e` outline collision and level pacing

## Open

1. **The repo is private, so nothing is deployed.** Both CI jobs are gated on
   `!github.event.repository.private`, so every run so far has skipped and no
   Pages site exists. `/ship` flips the repo public and dispatches a run. This
   is the single blocking item: the deployed site is what gets marked.
2. **`reflections/crit-5.md` is empty.** 150–300 words, the two standing
   prompts. The student's to write.
3. **Level 3's tuning is unvalidated by a human.** The press throw of 11 / 4.5
   was chosen to make holding a line take timing rather than reaction, but only
   the numbers have been checked, not the feel.
4. **Level 4 has never been reached end to end.** Auto-fire makes the
   three-kill easter egg possible again, but nobody has played through to it.
5. **The person-judged spec lines are unverified**: no instructions anywhere,
   and a stranger reaching an ending within five minutes. These are not
   fakeable by a test — confirm with an actual first-time player before the
   crit.
