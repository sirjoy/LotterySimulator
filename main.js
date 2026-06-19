// ═══════════════════════════════════════════════
//  main.js
//  Bootstrap: construct Container(s), build their panels,
//  and run the single shared requestAnimationFrame loop.
//
//  Depends on: container.js, ui.js, geometry.js.
// ═══════════════════════════════════════════════
import { Container } from './container.js';
import { buildPanel } from './ui.js';
import { BALL_COLORS, VASE_DIMS } from './geometry.js';

// The original single vase, expressed as a Container config.
// (Future expansion adds 3 more like this + one large base container.)
const VASE_CONFIG = {
  id: 'vase',
  dims: VASE_DIMS,
  ballCount: 10,
  labels: (i) => String(i),
  palette: BALL_COLORS,
  renderDetail: 'text',     // per-ball gradient + numeric label
  broadphase: 'all-pairs',  // O(n²) — fine for 10 balls
  initMode: 'presettle',    // scatter + 120-step settle
  airSetting: 0.75,
  maxSubsteps: 1,           // → one physics step per frame (vase parity)
};

const stage = document.getElementById('stage');
const containers = [];

function addContainer(config) {
  const c = new Container(config);
  stage.appendChild(buildPanel(c));
  containers.push(c);
  return c;
}

addContainer(VASE_CONFIG);

// Single RAF loop driving every container. lastTS is the only shared timing
// state; each container advances and renders independently.
let lastTS = null;
function frame(ts) {
  if (!lastTS) lastTS = ts;
  const dt = Math.min((ts - lastTS) / 1000, 1/30);
  lastTS = ts;
  for (const c of containers) {
    c.step(dt);   // advance() is near-free when idle; matches the original loop
    c.draw();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
