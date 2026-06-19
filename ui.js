// ═══════════════════════════════════════════════
//  ui.js
//  Two pieces of UI:
//   1. buildControls(containers) — one global control bar
//      (BLOW / OPEN GATE / reset / air) that drives ALL containers.
//   2. buildContainerUI(container) — per-container bare canvas (for the
//      stage row) + a compact row in the shared results panel. Returns the
//      DOM nodes and attaches the per-container UI setters via mountUI().
//
//  All element lookups are scoped to their own subtree (class selectors),
//  so any number of containers can coexist without id collisions.
// ═══════════════════════════════════════════════

const CONTROLS_HTML = `
  <button class="btn-primary btn-blow">▶ BLOW AIR</button>
  <button class="btn-primary btn-gate" disabled>⊙ OPEN GATE</button>
  <button class="btn-reset">Reset history</button>
  <div class="air-control">
    <span class="air-label">Air</span>
    <input type="range" class="air-slider" min="30" max="130" value="75">
    <span class="slider-val air-val">75%</span>
  </div>
`;

// Global control bar. Blow/gate/reset fan out to every container; the air
// slider sets every container's blower power. Returns the element plus button
// setters (the manager loop drives enable/pulse from aggregate state).
export function buildControls(containers) {
  const el = document.createElement('div');
  el.id = 'controls';
  el.innerHTML = CONTROLS_HTML;

  const btnBlow   = el.querySelector('.btn-blow');
  const btnGate   = el.querySelector('.btn-gate');
  const btnReset  = el.querySelector('.btn-reset');
  const airSlider = el.querySelector('.air-slider');
  const airVal    = el.querySelector('.air-val');

  btnBlow.addEventListener('click',  () => containers.forEach(c => c.startBlow()));
  btnGate.addEventListener('click',  () => containers.forEach(c => c.openGate()));
  btnReset.addEventListener('click', () => containers.forEach(c => c.resetHistory()));
  airSlider.addEventListener('input', function () {
    const v = this.value / 100;
    containers.forEach(c => { c.airSetting = v; });
    airVal.textContent = this.value + '%';
  });

  // Sync initial air setting onto every container.
  const initV = airSlider.value / 100;
  containers.forEach(c => { c.airSetting = initV; });

  return {
    el,
    setBtnBlow(enabled) { btnBlow.disabled = !enabled; },
    setBtnGate(enabled, pulse) {
      btnGate.disabled = !enabled;
      btnGate.className = 'btn-primary btn-gate' + (pulse ? ' ready' : '');
    },
  };
}

const RESULT_ROW_HTML = `
  <div class="res-head">
    <span class="dot"></span>
    <span class="res-name"></span>
    <span class="res-number empty">–</span>
  </div>
  <div class="res-status">Ready</div>
  <div class="history-list"></div>
`;

// Per-container UI: a bare canvas-wrap for the stage row, and a compact row in
// the shared results panel (name + status dot + status text + drawn number +
// horizontal history). Wires the setters and returns both nodes.
export function buildContainerUI(container) {
  // ── Stage: bare canvas + captured-stage badge ──
  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'canvas-wrap';
  const capturedStage = document.createElement('div');
  capturedStage.className = 'captured-stage';
  canvasWrap.appendChild(capturedStage);
  canvasWrap.appendChild(container.canvas);

  // ── Shared results panel: one row per container ──
  const row = document.createElement('div');
  row.className = 'res-row';
  row.innerHTML = RESULT_ROW_HTML;
  row.querySelector('.res-name').textContent = container.id.toUpperCase();

  const dot         = row.querySelector('.dot');
  const resNumber   = row.querySelector('.res-number');
  const resStatus   = row.querySelector('.res-status');
  const historyList = row.querySelector('.history-list');

  const ui = {
    // Button setters are global (handled by buildControls) → no-ops here, so
    // the container's state-machine calls remain valid.
    setBtnBlow() {}, setBtnGate() {},

    setStatus(t) { resStatus.textContent = t; },
    setDot(cls)  { dot.className = 'dot ' + cls; },

    updateResult(ball) {
      resNumber.textContent = ball.label;
      resNumber.className = 'res-number';
      resNumber.style.color = ball.color;
      resNumber.style.textShadow = `0 0 18px ${ball.color}99`;
    },
    clearResult() {
      resNumber.textContent = '–';
      resNumber.className = 'res-number empty';
      resNumber.style.color = '';
      resNumber.style.textShadow = '';
    },

    addHistoryRow(label, index, color) {
      const chip = document.createElement('div');
      chip.className = 'hist-chip';
      chip.textContent = label;
      chip.style.borderColor = color;
      chip.title = '#' + index;
      historyList.appendChild(chip);
      historyList.scrollLeft = historyList.scrollWidth;
    },
    clearHistory() { historyList.innerHTML = ''; },

    showCapturedStage(ball) {
      const uid = ball.id + '_' + Date.now();
      capturedStage.innerHTML = `<svg width="52" height="52" viewBox="0 0 52 52">
        <defs><radialGradient id="cg${uid}" cx="38%" cy="34%" r="60%">
          <stop offset="0%" stop-color="white" stop-opacity=".55"/>
          <stop offset="100%" stop-color="${ball.color}"/>
        </radialGradient></defs>
        <circle cx="26" cy="26" r="24" fill="url(#cg${uid})" stroke="white" stroke-width="1.5" stroke-opacity=".25"/>
        <text x="26" y="32" text-anchor="middle" font-family="Bebas Neue,sans-serif" font-size="22" fill="white">${ball.label}</text>
      </svg>`;
      capturedStage.style.animation = 'none'; void capturedStage.offsetWidth;
      capturedStage.style.animation = 'popIn .5s cubic-bezier(.34,1.56,.64,1)';
    },
    clearCaptured() { capturedStage.innerHTML = ''; },
  };

  container.mountUI(ui);
  return { canvasWrap, resultRow: row };
}
