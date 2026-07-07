# Pneumatic Lottery Draw

A browser-based simulation of a pneumatic lottery draw machine. Ten numbered balls
are blown around a vase-shaped glass chamber by an air jet; when you open the gate,
one ball is launched up the exit tube and recorded as the winning draw.

![Pneumatic Lottery Draw](https://img.shields.io/badge/canvas-2D%20physics-3a8fff)

**[Live demo →](https://sirjoy.github.io/LotterySimulator/)**

## Features

- Real-time 2D physics: gravity, drag, a Gaussian air jet, turbulence, and
  ball-to-ball and ball-to-wall collisions.
- Adjustable blower power via an air-intensity slider.
- A draw state machine (ramp → tumble → open gate → capture → settle) with live
  status indicator.
- Draw history with colored chips, plus a reset control.
- No dependencies or build step — plain ES modules and the Canvas 2D API.

## Running

The app is split into ES modules, so it must be served over http (not opened
via `file://`). Serve the directory and open `index.html`:

```sh
python3 -m http.server
# then visit http://localhost:8000/
```

> The original single-file version is preserved as `lottery-cylinder_12.html`
> for reference and still opens directly in a browser.

## How to use

1. Click **▶ BLOW AIR** to start the blower — the balls ramp up and tumble.
2. Once the balls are tumbling, click **⊙ OPEN GATE** to release one ball through
   the exit tube.
3. The captured number appears under **Result** and is added to **Draw History**.
4. Adjust **Air Intensity** to change how violently the balls tumble.
5. **Reset history** clears the recorded draws.

## How it works

The simulation is built around a `Container` class — one instance owns its own
`<canvas>`, state machine, ball set, air system, gate, and control panel. A single
`requestAnimationFrame` loop in `main.js` drives every container: each frame it
integrates physics for every ball (gravity, the nozzle jet, turbulence), resolves
collisions against the chamber walls (line segments with inward-pointing normals)
and the other balls, then renders. When the gate opens, a scoring function selects
the best-positioned ball and launches it up the tube as the winning draw.

This instance-based structure exists so the simulation can scale to multiple
independent containers; today it runs a single vase.

### Module layout

| File | Responsibility |
|---|---|
| `index.html` | Page shell + all CSS; hosts `#stage` and loads `main.js`. |
| `geometry.js` | Tuning constants, palette, and `makeGeometry(dims)` (derives wall segments per instance). |
| `physics.js` | Stateless physics helpers + pluggable collision broadphase. |
| `render.js` | Canvas drawing + pluggable ball-render strategies. |
| `container.js` | The `Container` class (state machine, capture) + init strategies. |
| `ui.js` | `buildPanel(container)` — dynamic per-instance control panel. |
| `main.js` | Constructs containers and runs the shared RAF loop. |

See [CLAUDE.md](CLAUDE.md) for a deeper architecture overview.

## License

No license specified.
