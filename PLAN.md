# Port DesertBird into the crit-5 Astro repo

## Context

Crit-5's brief is "A game": losable, ends somewhere (win/loss/finish), teaches
itself with zero instructions anywhere on or off screen, a stranger reaches an
ending within five minutes, and one rule carries a focused automated test. The
student has an existing DesertBird game
(`/Users/aurora/Desktop/26S2/COMP8020/code/DesertBird`) — a Flappy-Bird-style
vanilla-JS/Canvas game — and wants to port and optimize it into this week's
Astro repo (`comp4020-crit5-AuroraSunDev`) rather than build from scratch.

DesertBird already has losable win/loss end states, which is most of the hard
part. But as-is it directly violates the spec: its home screen draws an
explicit Chinese-language "游戏说明" (game instructions) block, and its end
screens say "press Enter to return home" — both are on-screen instructions,
the exact thing spec line 3 forbids. It also has no viewport meta, no touch
input, and a fixed unscaled 800×600 canvas, so it's unplayable at the 390×844
graded mobile viewport. It has no automated tests, and its six files are
classic global `<script>` tags that Astro's bundler can't consume directly.

Separately, the repo has an untracked `src/assets/` folder containing 11
small PNGs (a play-button icon, ten digit sprites, "Ready"/"Game Over"
banners). The student confirmed these are original **flappybird.io** UI
assets, not stray debris, and wants them incorporated where useful — in
particular `button_play.png` is a strong, ready-made answer to the
"wordless opening-screen affordance" requirement.

**Scope**: ship the mandatory spec-compliance baseline first (tutorial
removal, touch/responsive support, one tested rule, ES-module port), then
attempt the three optional polish categories the student picked (better game
feel, code cleanup, asset+restart polish) in priority order, each only after
the previous stage is green. Migration depth is a **minimal port**: keep the
six files as plain JS, converted to ES modules Astro can bundle — not a full
TypeScript rewrite.

## Step 0: persist this plan

Before any implementation, write this approved plan to `PLAN.md` at the repo
root (`/Users/aurora/Desktop/26S2/COMP8020/code/comp4020-crit5-AuroraSunDev/PLAN.md`).
This is the only action taken immediately after leaving plan mode — no
source code, assets, tests, or config are touched yet. The student will
review `PLAN.md` and start implementation (commit 1 onward, below) in a
fresh session.

## File layout

**Static assets → `public/game/`** (not `src/assets/` — anything the game
loads by a runtime string path, not a bundler `import`, must live under
`public/` or it 404s once built):

```
public/game/
  img/            DesertBird's own sprites/backgrounds (from DesertBird/img/,
                  excluding the 3 unused 口袋赤之救助队*.png files — nothing
                  references them, so simply not copying them is the cleanup)
  img/ui/         the flappybird.io kit: button_play.png, text_ready.png,
                  text_game_over.png, number_score_00.png..09.png
                  (moved from src/assets/, kept and tracked in git)
  audio/          DesertBird's own audio (from DesertBird/audio/)
```

**Game code → `src/scripts/game/`**, one module per current file plus one new
pure-rules module:

```
src/scripts/
  main.ts               thin entry: find #game-canvas, call initGame()
  game/
    state.js             was: scattered globals in Init.js (canvas/ctx refs
                          + isHome/isSelect/isPlay/isJump flow flags)
    levels.js             was: Script.js — same data table, named export
    rules.js               NEW — pure functions (see below)
    sprites/
      bird.js  obstacle.js  enemy.js  bullet.js   (draw(ctx) takes ctx as
                          an explicit param instead of reading a global)
    flappyBird.js          was: FlappyBird.js — imports sprites/ + rules.js
    init.js                was: Init.js — bootstrap, screens, input, loop
```

Every previously-implicit global read becomes an explicit `import`; no file
depends on another having "already run." `init.js` is the only module that
touches the DOM and the only one `main.ts` needs to import.

`tsconfig.json` needs `"allowJs": true` added — `main.ts` imports `init.js`
and `spec/game.test.ts` imports `rules.js`; without it `astro check` refuses
to resolve a `.js` import from `.ts`. Small, backward-compatible, one line.

## The no-tutorial opening screen (and end screens)

- **Opening screen**: keep the desert background and canvas-drawn "DesertBird"
  title (a name, not an instruction). Delete the entire maroon
  "游戏说明"/玩法/规则 block. Draw `button_play.png` scaled up (~300×180px),
  centered, with a small idle breathing animation (scale oscillating via a
  sine wave) so it visibly invites a tap within the first second. Place
  `text_ready.png` ("Get Ready!") just above it as a status accent — this was
  confirmed with the student as worth including since it's a status label,
  not an instruction, and the play button alone already carries the actual
  affordance requirement.
- **Hit-test**: retarget `HomeClick()`'s bounding box at the actual drawn
  rect of `button_play.png`, replacing the old hardcoded text-button rect.
- **Level-select screen**: translate the difficulty/target-score labels
  ("简单/较难/困难", "目标分数 N") to English while `init.js` is already open
  for edits — confirmed with the student as worth doing, low-risk, keeps the
  screen legible to an English-speaking stranger and consistent with the
  page's `lang="en-AU"`.
- **End screens**: replace the canvas-drawn "GameOver" text with
  `text_game_over.png`; keep "You Win" as-is (no asset supplied, and it's a
  status word, not an instruction). **Remove** "按下Enter键，返回首页" — this
  is the same category of spec violation as the home-page block. Replace it
  with the same `button_play.png` control reused as an on-screen,
  mouse-and-touch-reachable restart button — promoted to mandatory rather
  than optional-stretch, since a mouse/touch-only player who reaches "Game
  Over" with only an invisible Enter-key affordance can't reach a second
  playthrough, which is itself an undocumented instruction, and reusing an
  icon the player already learned means "play teaches the rest" for free.
  Existing Enter-key `location.reload()` stays as a second, compatible path.
- **Deferred to optional stretch, not mandatory**: sprite-digit score display
  (`number_score_*.png`) — compositing digits needs kerning/layout math the
  current `fillText` call doesn't, and it answers no spec line. Revisit under
  "asset + restart polish" if time remains.

## Touch input and responsive canvas

**Approach: CSS-scale a fixed 800×600 drawing buffer (letterboxed), don't
make the canvas resolution dynamic.** All of DesertBird's gameplay math
(obstacle gaps, bird start position, collision bounds, level-select tile
coordinates) is authored against the fixed 800×600 space; re-deriving it
against a dynamic resolution would touch nearly every method — the opposite
of a minimal port. CSS-scaling only the *display* size leaves all gameplay
math untouched.

- CSS: `max-width: 100vw; max-height: 100vh; aspect-ratio: 4/3;` with
  `object-fit: contain`-style centering, so the raster scales to fit any
  viewport without cropping or stretching. `touch-action: none;` on the
  canvas so mobile browsers don't fight taps with scroll/zoom.
- **Required fix**: `GetMousePos` currently returns CSS-pixel coordinates.
  Once the canvas is CSS-scaled, that's no longer the same space as the
  800×600 drawing buffer the hit-tests are written against. Scale by
  `canvas.width / rect.width` and `canvas.height / rect.height`:
  ```js
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) * (canvas.width / rect.width);
  const y = (clientY - rect.top) * (canvas.height / rect.height);
  ```
  Without this, the play button and level tiles silently stop responding to
  taps the moment the canvas is scaled — an interaction bug a screenshot
  alone won't catch, so it must be verified by actually tapping/clicking
  through the game at both graded viewports (see Verification).
- **Touch events**, mirroring the existing mouse handlers: `touchstart` sets
  the same "pressed" state `onmousedown` does; `touchend` calls
  `event.preventDefault()` (to suppress the synthetic click and stop
  scroll/zoom) and directly invokes the same primary-tap logic
  (`HomeClick()`/`Select()`/restart hit-test) that `cavans.onclick` runs
  today — factor that shared logic into one `handlePrimaryTap()` function
  called from both `onclick` and the new `touchend` handler.

## The extracted rule and its test

**Extract the collision test as a proper AABB rectangle-overlap check** —
the cleanest pure candidate (plain `{x,y,width,height}` geometry, no
DOM/array-mutation entanglement unlike scoring), and it fixes a real bug: the
existing four-corner-point-in-rect test can miss genuine overlaps (a shape
can tunnel through another without any single sampled corner landing inside
it). It also does double duty as half of the "better game feel" stretch goal
(AABB collision), so landing it now isn't wasted if the loop-timing stretch
never happens.

`src/scripts/game/rules.js`:
```js
export function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
         a.y < b.y + b.height && a.y + a.height > b.y;
}
```
`flappyBird.js`'s `CanMove` calls `rectsOverlap(bird, obstacleOrEnemy)`
instead of the inline four-corner loop — a drop-in replacement since those
objects already carry `x`/`y`/`width`/`height`.

`spec/game.test.ts` imports `rules.js` directly (no DOM, no dist-globbing —
this is the "sensor can see what it measures" lesson from CLAUDE.md):
asserts overlap, no-overlap, edge-touching-only (false), full containment,
and one case specifically shaped to catch what the old four-corner test would
have missed (a bird-shaped rect passing through the middle of a wider
obstacle such that no single corner lands inside it, yet the rects overlap).
This is a **contract test** per `spec/README.md` — expected to retire when
the week does, unlike CLAUDE.md's carried-forward sensors.

## Commit sequence

Each commit keeps `pnpm check` green and is independently explainable:

1. **assets**: copy DesertBird's img/audio into `public/game/` (skip the 3
   unused Pokémon PNGs), move the 11 `src/assets/*.png` files into
   `public/game/img/ui/`, delete the now-empty `src/assets/`. No code change.
2. **port**: convert the six files into the `src/scripts/game/` module
   layout with no behavior change yet (same tutorial text, same Enter-only
   restart) — a faithful mechanical refactor. Wire `main.ts`, rewrite
   `index.astro`'s shell (canvas element, corrected `<title>`/description/
   `<h1>` now that it's a real page, English canvas-fallback text). Add
   `allowJs: true`. Verify by playing it and confirming identical behavior
   to the original `FlappyBird.html`.
3. **redesign**: strip the tutorial block and "press Enter" text, add the
   play-button affordance + Ready banner + Game Over banner, translate
   level-select labels, wire the on-screen restart button.
4. **touch + responsive**: add touch handlers, fix coordinate scaling, add
   CSS letterboxing.
5. **rule + test**: add `rules.js` + `spec/game.test.ts` together (never red
   across a commit boundary), wire `CanMove` to use it.

Optional, only after 1–5 are green, in the student's stated priority order:

6. game feel: swap `setInterval` for `requestAnimationFrame` + delta-time
   (AABB half already landed in commit 5).
7. code cleanup: dead code, magic-number constants, `cavans`→`canvas` typo
   (unused Pokémon PNGs already excluded by commit 1).
8. asset/restart polish: compress `GameStartBG1.png` (check a corner pixel
   for alpha before choosing JPEG vs PNG, per CLAUDE.md's `sips` lessons),
   sprite-digit score display, preserve localStorage across restart.

## Verification

- `pnpm check` after every commit (typecheck catches a missed `allowJs`
  immediately; build catches a broken module graph; vitest runs
  `spec/invariants.test.ts` + the new `spec/game.test.ts`).
- Render and look at it, per CLAUDE.md: `pnpm build && pnpm preview --port
  4990`, then headless Chrome screenshots at both graded sizes —
  `--window-size=1920,1080` directly; for 390×844 use the documented
  iframe-in-a-wider-window workaround (headless clamps its own layout
  viewport near 490px, so a raw 390-wide window silently lies).
- What a screenshot cannot verify, and must be checked live instead: any
  `setInterval`/rAF-driven motion (virtual time doesn't chain rAF), and real
  tap/click interaction at both sizes to confirm the coordinate-scaling fix
  actually lines up taps with the play button, level tiles, and restart
  button — confirm the game is fully playable and winnable/losable by touch
  alone at 390×844, not just visually intact.
- The person-judged spec lines (no instructions anywhere; a stranger reaches
  an ending in five minutes; can account for how the work was directed) are
  addressed by design here, not fakeable by a test — confirm with an actual
  first-time player before the crit.
- `pnpm check:evidence` before shipping (PROCESS.md citations resolve,
  `reflections/crit-5.md` exists).

## Critical files

- `src/pages/index.astro` — page shell rewrite
- `src/scripts/main.ts` — new entry point
- `DesertBird/Init.js`, `DesertBird/FlappyBird.js` — source for the port
- `tsconfig.json` — `allowJs: true`
- `spec/invariants.test.ts` — must stay green throughout
- `spec/game.test.ts` — new, the one required focused test
