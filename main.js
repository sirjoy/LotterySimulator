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
import { t, getLang, setLang, onLangChange } from './i18n.js';

// Page-level text (title/subtitle/About panel) lives directly in index.html via
// data-i18n / data-i18n-html attributes; per-container/control text is handled
// by ui.js. This just applies the current language to the static markup and
// wires the toggle button — re-run on every language change, no page reload.
function applyStaticI18n() {
  document.documentElement.lang = getLang();
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  const toggle = document.getElementById('lang-toggle');
  if (toggle) toggle.textContent = getLang() === 'es' ? 'EN' : 'ES';
}
applyStaticI18n();
onLangChange(applyStaticI18n);
document.getElementById('lang-toggle')?.addEventListener('click', () => {
  setLang(getLang() === 'es' ? 'en' : 'es');
});

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

// A "serie" vase with 420 colour-only (unlabelled) balls — the target scale for
// the large base, exercised here in the existing vase. The captured number
// (0–419) is still revealed in the results panel.
const SERIE_CONFIG = {
  id: 'serie',
  dims: SERIE_DIMS,
  ballCount: 420,
  labels: (i) => String(i),
  palette: makeHuePalette(420),
  renderDetail: 'color',    // BallSpriteRenderer — no on-ball text
  broadphase: 'grid',       // all-pairs (~88k pairs/frame) is too costly at 420
  initMode: 'presettle',    // deliberate: runs through the grid + respects the
                            // funnel. packed-grid would skip the one-time
                            // synchronous settle but ignores the funnel taper and
                            // doesn't shuffle labels (unfair) — left to the base.
  containment: true,        // hard clamp — dense small balls can't tunnel out
  calmSettle: true,         // dense pile rests instead of jittering when air off
  shuffleLabels: true,      // uniform draw across 0–419 despite positional bias
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
