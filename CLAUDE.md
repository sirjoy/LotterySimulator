# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A browser-based pneumatic lottery draw simulator: numbered balls are blown around a
vase-shaped glass chamber by an air jet, and one is captured through an exit tube when
the user opens a gate. There is no build system, package manager, dependencies, or
tests — just ES modules and the Canvas 2D API. The only external resource is a Google
Fonts `@import`.

The code is structured around an instance-based **`Container`** abstraction so it can
scale to several independent containers (the end goal is 4 small vases plus one large
~350-ball base). **Today it runs a single vase.** The original monolithic version is
preserved as `lottery-cylinder_12.html` for reference; the live app is the module set
loaded by `index.html`.

## Running

ES modules require http — `file://` will not work. Serve the directory and open the
root:

```sh
python3 -m http.server
# then visit http://localhost:8000/
```

There is nothing to build, lint, or test. `lottery-cylinder_12.html` is the old
single-file build and still opens directly (`open lottery-cylinder_12.html`).

## Architecture

A single `requestAnimationFrame` loop in `main.js` drives a list of `Container`
instances; each owns its own canvas, state, and DOM panel. Modules form a strict
downward dependency chain: `main → ui → container → {physics, render, geometry}`,
with `geometry` as a leaf.

| File | Responsibility |
|---|---|
| `geometry.js` | `PHYSICS` tuning constants, `BALL_COLORS`, `shadeColor`, and `makeGeometry(dims)` — derives all geometry (incl. `wallSegs`) **per instance** from dimensions. `VASE_DIMS` reproduces the original literal pixels exactly. |
| `physics.js` | Stateless physics helpers (`jetForce`, `resolveSegments`, `resolveGate`, `resolveBallCollisions`) that take `geo`/`P`/state as params. Pluggable broadphase: `AllPairsBroadphase` (wired) / `UniformGridBroadphase` (stub). |
| `render.js` | `drawScene(ctx, geo, view, renderStrategy)` + sub-draws. Pluggable ball render: `BallTextRenderer` (wired) / `BallSpriteRenderer` (stub, color-only sprite cache). |
| `container.js` | The `Container` class + init strategies (`PresettleInit` wired / `PackedGridInit` stub). |
| `ui.js` | `buildPanel(container)` — builds one DOM panel, wires events, returns bound setters via `container.mountUI()`. |
| `main.js` | Constructs containers, appends panels to `#stage`, runs the shared RAF loop. |

Three interlocking systems to understand:

### 1. State machine (`Container.simState`)
`idle → ramping → tumbling → gate_wait → gate_open → capturing → settling → idle`.
`Container.advance(dt)`'s `switch` sets air pressure per state; transitions fire on
timers (`stateTimer`, `PHYSICS.RAMP_TIME`/`GATE_DELAY`/`SETTLE_TIME`), the gate
animation completing, or a ball entering the tube. `gate_wait` is a randomised hold
(3 ± 1 s) after the OPEN GATE press during which balls keep tumbling, so the moment
the gate opens is unpredictable. `startBlow()` (idle→ramping) and `openGate()`
(tumbling→gate_wait) are the user-driven transitions. Button enable/disable is kept in
sync manually via the `ui` setters — there is no framework, so any new state must
update both the machine and the panel.

`Container.step(dt)` wraps `advance()` in a fixed-timestep accumulator that is **inert
for the vase** (`maxSubsteps: 1` → exactly one `advance(dt)` per frame, identical to
the original loop). A larger container sets `fixedDt`/`maxSubsteps` for stability.
`main.js` skips `step()` for idle, still balls (`isActive()`), but always `draw()`s.

### 2. Physics (`physics.js`, driven by `Container.updateBalls`)
Custom 2D physics in each container's **local** canvas pixel space. Tuning lives in the
`PHYSICS` object in `geometry.js`. `updateBalls()` integrates gravity + jet lift
(`jetForce`, a Gaussian centered on the nozzle) + band-limited turbulence, then resolves
collisions. Walls are line segments with **inward-pointing normals** built by
`makeGeometry` → `wallSegs` (was the global `WALL_SEGS`/`makeWallSegments`). The shape is
a vase: chamfered top, vertical body, inward funnel to a narrow nozzle.

**Geometry consistency invariant:** `makeGeometry` feeds both `wallSegs` (collision) and
`containerPath()` (the drawn outline in `render.js`). They must agree, or collisions and
visuals diverge — so any geometry change goes through `makeGeometry`/`dims`, never by
editing one side. For the vase, `VASE_DIMS` is chosen to reproduce the exact original
pixels (centerX=155, nozzle 137–173, etc.).

### 3. Capture logic (`Container.triggerCapture` / `finishCapture`)
`triggerCapture()` (fired the instant the gate fully opens) **scores and selects the
winning ball** by height, centrality, and upward momentum — this is where the draw
outcome is effectively decided — then launches it up the tube. A ball reaching the tube
zone in `updateBalls()` calls `finishCapture()`, which records history, pushes the result
via the `ui` setters, kills the air, and schedules the return to `idle` with `setTimeout`.

### Rendering & DOM
`Container.draw()` calls `drawScene()` into its own ctx each frame: container glass,
nozzle, air particles, balls (via the render strategy), gate, exit tube. The control
panel is generated per instance by `ui.buildPanel()`, which scopes all element lookups
to the panel subtree (class selectors, no global ids) so multiple panels never collide.

## Performance seams (scaffold; only the naive path is wired)

For scaling to ~350 balls, three pluggable strategies exist but currently default to the
original behavior for the vase: **broadphase** (`physics.js` — grid instead of O(n²)),
**ball rendering** (`render.js` — cached sprites instead of per-ball gradient+text), and
**init** (`container.js` — packed-grid placement instead of the synchronous 120-step
presettle that would freeze on 350 balls). The expansion turns these on via container
config; do not add their cost to the small vases.

## Conventions

- Physics feel is tuned entirely through `PHYSICS` in `geometry.js` — prefer adjusting
  those constants over editing integration math.
- All per-container state lives on the `Container` instance; nothing simulation-related
  is a module global except `lastTS` (shared frame timing) in `main.js`.
- Geometry is always derived from `dims` via `makeGeometry`; never hard-code pixel
  positions in physics or render code.
