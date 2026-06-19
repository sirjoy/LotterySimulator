// ═══════════════════════════════════════════════
//  ui.js
//  Builds one DOM control panel per Container and wires it up.
//  All element lookups are scoped to the panel subtree (class
//  selectors via panel.querySelector), so any number of panels
//  can coexist without id collisions.
//
//  Depends on: container.js (only at call time — pass an instance).
// ═══════════════════════════════════════════════

const PANEL_HTML = `
  <div class="canvas-wrap">
    <div class="captured-stage"></div>
  </div>
  <div class="panel">
    <div class="card">
      <div class="card-label">Result</div>
      <div class="result-number empty">–</div>
    </div>
    <div class="card">
      <div class="card-label">Draw History</div>
      <div class="history-list"></div>
    </div>
    <div class="card">
      <div class="card-label">Air Intensity</div>
      <div class="slider-wrap">
        <div class="slider-row">
          <span style="font-size:12px;color:var(--dim)">Blower power</span>
          <span class="slider-val air-val">75%</span>
        </div>
        <input type="range" class="air-slider" min="30" max="130" value="75">
      </div>
    </div>
    <div class="card">
      <div class="card-label">Status</div>
      <div class="status-bar">
        <div class="dot"></div>
        <span class="status-text">Ready</span>
      </div>
    </div>
    <button class="btn-primary btn-blow">▶ BLOW AIR</button>
    <button class="btn-primary btn-gate" disabled>⊙ OPEN GATE</button>
    <button class="btn-reset">Reset history</button>
  </div>
`;

// Build the panel for `container`, wire events, attach the UI setters via
// container.mountUI(), and return the root element to append to the stage.
export function buildPanel(container) {
  const root = document.createElement('div');
  root.className = 'sim-unit';
  root.innerHTML = PANEL_HTML;

  // Insert the container's own canvas into its wrap.
  const wrap = root.querySelector('.canvas-wrap');
  const capturedStage = root.querySelector('.captured-stage');
  wrap.appendChild(container.canvas);

  // Scoped element refs.
  const resultNumber = root.querySelector('.result-number');
  const historyList  = root.querySelector('.history-list');
  const statusText   = root.querySelector('.status-text');
  const dot          = root.querySelector('.dot');
  const btnBlow      = root.querySelector('.btn-blow');
  const btnGate      = root.querySelector('.btn-gate');
  const btnReset     = root.querySelector('.btn-reset');
  const airSlider    = root.querySelector('.air-slider');
  const airVal       = root.querySelector('.air-val');

  // Reflect the container's initial air setting.
  const initPct = Math.round(container.airSetting * 100);
  airSlider.value = String(initPct);
  airVal.textContent = initPct + '%';

  // Bound UI setters (was the global UI-helper functions).
  const ui = {
    setStatus(t) { statusText.textContent = t; },
    setDot(cls)  { dot.className = 'dot ' + cls; },
    setBtnBlow(enabled) { btnBlow.disabled = !enabled; },
    setBtnGate(enabled, pulse) {
      btnGate.disabled = !enabled;
      btnGate.className = 'btn-primary btn-gate' + (pulse ? ' ready' : '');
    },
    updateResult(ball) {
      resultNumber.textContent = ball.label;
      resultNumber.className = 'result-number';
      resultNumber.style.color = ball.color;
      resultNumber.style.textShadow = `0 0 26px ${ball.color}99`;
    },
    clearResult() {
      resultNumber.textContent = '–';
      resultNumber.className = 'result-number empty';
      resultNumber.style.color = '';
      resultNumber.style.textShadow = '';
    },
    addHistoryRow(label, index, color) {
      const row = document.createElement('div');
      row.className = 'hist-row';

      const num = document.createElement('div');
      num.className = 'hist-idx';
      num.textContent = '#' + index;

      const chip = document.createElement('div');
      chip.className = 'hist-chip';
      chip.textContent = label;
      chip.style.borderColor = color;

      const bar = document.createElement('div');
      bar.className = 'hist-bar';
      bar.style.background = color;

      row.appendChild(num);
      row.appendChild(chip);
      row.appendChild(bar);
      historyList.appendChild(row);
      historyList.scrollTop = historyList.scrollHeight;
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

  // Event wiring → container methods.
  btnBlow.addEventListener('click', () => container.startBlow());
  btnGate.addEventListener('click', () => container.openGate());
  btnReset.addEventListener('click', () => container.resetHistory());
  airSlider.addEventListener('input', function () {
    container.airSetting = this.value / 100;
    airVal.textContent = this.value + '%';
  });

  container.mountUI(ui);
  return root;
}
