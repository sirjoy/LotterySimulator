# Pneumatic Lottery Draw

A browser-based simulation of a pneumatic lottery draw machine. Ten numbered balls
are blown around a vase-shaped glass chamber by an air jet; when you open the gate,
one ball is launched up the exit tube and recorded as the winning draw.

![Pneumatic Lottery Draw](https://img.shields.io/badge/canvas-2D%20physics-3a8fff)

## Features

- Real-time 2D physics: gravity, drag, a Gaussian air jet, turbulence, and
  ball-to-ball and ball-to-wall collisions.
- Adjustable blower power via an air-intensity slider.
- A draw state machine (ramp → tumble → open gate → capture → settle) with live
  status indicator.
- Draw history with colored chips, plus a reset control.
- Self-contained: a single HTML file with no dependencies or build step.

## Running

Open the file directly in any modern browser:

```sh
open lottery-cylinder_12.html
```

Or serve the directory and load it in a browser:

```sh
python3 -m http.server
# then visit http://localhost:8000/lottery-cylinder_12.html
```

## How to use

1. Click **▶ BLOW AIR** to start the blower — the balls ramp up and tumble.
2. Once the balls are tumbling, click **⊙ OPEN GATE** to release one ball through
   the exit tube.
3. The captured number appears under **Result** and is added to **Draw History**.
4. Adjust **Air Intensity** to change how violently the balls tumble.
5. **Reset history** clears the recorded draws.

## How it works

The whole simulation runs in a single `requestAnimationFrame` loop driven by an
explicit state machine. Each frame integrates physics for every ball — gravity,
the nozzle jet, turbulence — then resolves collisions against the chamber walls
(modeled as line segments with inward-pointing normals) and against the other balls.
When the gate opens, a scoring function selects the best-positioned ball and launches
it up the tube as the winning draw.

See [CLAUDE.md](CLAUDE.md) for a deeper architecture overview.

## License

No license specified.
