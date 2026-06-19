# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A single, self-contained HTML file (`lottery-cylinder_12.html`) that simulates a
pneumatic lottery draw machine: 10 numbered balls are blown around a vase-shaped
glass chamber by an air jet, and one is captured through an exit tube when the user
opens a gate. All HTML, CSS, and JavaScript live in this one file — there is no
build system, package manager, dependencies, or tests. The only external resource
is a Google Fonts `@import`.

## Running

Open the file directly in a browser (`open lottery-cylinder_12.html`), or serve the
directory (`python3 -m http.server`) and load it. There is nothing to build, lint,
or test.

## Architecture

The simulation is a fixed-timestep-ish `requestAnimationFrame` loop (`loop()`) driven
by an explicit state machine. Understanding the code means understanding these three
interlocking systems:

### 1. State machine (`simState`)
`idle → ramping → tumbling → gate_open → capturing → settling → idle`. The `switch`
in `loop()` sets air pressure per state; transitions are triggered by timers
(`stateTimer`, `RAMP_TIME`, `SETTLE_TIME`), the gate animation completing, or a ball
entering the tube. UI buttons gate these transitions: `startBlow()` (idle→ramping)
and `openGate()` (tumbling→gate_open). Button enable/disable state is kept in sync
manually via `setBtnBlow`/`setBtnGate` — there is no framework, so any new state must
update both the machine and the DOM.

### 2. Physics
Custom 2D physics, all in canvas pixel coordinates. Tuning lives in the `PHYSICS
CONSTANTS` block at the top — gravity, drag, restitution, jet strength, turbulence.
- `updateBalls()` integrates gravity + jet lift (`jetForce`, a Gaussian centered on
  the nozzle) + band-limited turbulence, then resolves collisions.
- Container collision (`resolveSegments`) works against `WALL_SEGS`, a list of line
  segments with **inward-pointing normals** built by `makeWallSegments()`. The shape
  is a vase: chamfered top, vertical body, inward funnel to a narrow nozzle. Changing
  geometry constants (`BODY_TOP_Y`, `FUNNEL_BOT_Y`, `NOZZLE_HALF`, etc.) requires
  keeping `makeWallSegments()` and `containerPath()` (the drawn outline) consistent,
  or collisions and visuals will diverge.
- `resolveGate()` is a movable barrier across the tube mouth that blocks balls until
  `gateT` animates from 0 (closed) to 1 (open).
- `resolveBallCollisions()` handles ball-ball impulses.

### 3. Capture logic
`triggerCapture()` (fired the instant the gate fully opens) **scores and selects the
winning ball** by height, centrality, and upward momentum — this is where the draw
outcome is effectively decided — then launches it up the tube. A ball reaching the
tube zone in `updateBalls()` calls `finishCapture()`, which records history, updates
the result/history DOM, kills the air, and schedules the return to `idle`.

### Rendering
`drawScene()` redraws everything each frame onto a single 310×520 canvas: container
glass, nozzle, air particles, balls, gate, exit tube. The side panel (result,
history, air slider, status) is plain DOM updated by the `UI HELPERS` functions.

## Conventions

- All coordinates are absolute canvas pixels; geometry derives from the constants
  block near the top of the script.
- Physics feel is tuned entirely through the named constants — prefer adjusting those
  over editing integration math.
- The file name carries a version suffix (`_12`); new iterations have historically
  been new numbered files.
