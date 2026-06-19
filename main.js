// ═══════════════════════════════════════════════
//  main.js
//  Bootstrap: construct Container(s), build the shared UI (one global control
//  bar + a results panel row per container), and run the single shared RAF
//  loop. Global BLOW/GATE/air fan out to every container; per-container info
//  (status, result, history) lives in the shared results panel.
// ═══════════════════════════════════════════════
import { Container } from './container.js';
import { buildControls, buildContainerUI } from './ui.js';
import { BALL_COLORS, VASE_DIMS, SERIE_DIMS, makeHuePalette } from './geometry.js';

// A standard 10-ball numbered vase (the original), as a config factory so we
// can line up several identical ones in the stage row.
function numberedVase(id) {
  return {
    id,
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
}

// Expansion step 1: a "serie" vase with 50 colour-only (unlabelled) balls.
// The captured number (0–49) is still revealed in the results panel.
const SERIE_CONFIG = {
  id: 'serie',
  dims: SERIE_DIMS,
  ballCount: 50,
  labels: (i) => String(i),
  palette: makeHuePalette(50),
  renderDetail: 'color',    // BallSpriteRenderer — no on-ball text
  broadphase: 'all-pairs',  // ~1,225 pairs/frame — trivial at 50
  initMode: 'presettle',
  airSetting: 0.75,
  maxSubsteps: 1,
};

const stage   = document.getElementById('stage');
const results = document.getElementById('results');
const containers = [];

function addContainer(config) {
  const c = new Container(config);
  const { canvasWrap, resultRow } = buildContainerUI(c);
  stage.appendChild(canvasWrap);
  results.appendChild(resultRow);
  containers.push(c);
  return c;
}

// Four identical 10-ball numbered vases, then the 50-ball colour serie — all
// horizontally aligned in the stage row.
['vase 1', 'vase 2', 'vase 3', 'vase 4'].forEach(id => addContainer(numberedVase(id)));
addContainer(SERIE_CONFIG);

// Global control bar (needs the container list to fan out actions).
const controls = buildControls(containers);
document.getElementById('controls-host').appendChild(controls.el);

// Derive global button state from aggregate container state. Blow starts every
// container together, so they ramp→tumble in sync; gate is offered only once
// all are tumbling, and blow only once all are back to idle.
function syncControls() {
  const allIdle     = containers.every(c => c.simState === 'idle');
  const allTumbling = containers.every(c => c.simState === 'tumbling');
  controls.setBtnBlow(allIdle);
  controls.setBtnGate(allTumbling, allTumbling);
}

// Single RAF loop driving every container.
let lastTS = null;
function frame(ts) {
  if (!lastTS) lastTS = ts;
  const dt = Math.min((ts - lastTS) / 1000, 1/30);
  lastTS = ts;
  for (const c of containers) {
    c.step(dt);
    c.draw();
  }
  syncControls();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
