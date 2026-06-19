// ═══════════════════════════════════════════════
//  container.js
//  The central abstraction. One Container instance owns one
//  <canvas>, one state machine, one ball set, one air system,
//  one gate, and (after mountUI) one DOM control panel.
//
//  Everything that used to be a module-global lives on `this`,
//  so N independent containers can run side by side.
//
//  Depends on: geometry.js, physics.js, render.js.
// ═══════════════════════════════════════════════
import { makeGeometry, PHYSICS } from './geometry.js';
import {
  jetForce, resolveSegments, resolveGate, resolveBallCollisions, clampToContainer,
  AllPairsBroadphase, UniformGridBroadphase,
} from './physics.js';
import { drawScene, BallTextRenderer, BallSpriteRenderer } from './render.js';

// UI is attached by ui.buildPanel(); until then calls are safe no-ops so the
// container can initialise balls/air without a panel present.
const NOOP_UI = {
  setStatus(){}, setDot(){}, setBtnBlow(){}, setBtnGate(){},
  updateResult(){}, addHistoryRow(){}, showCapturedStage(){},
  clearCaptured(){}, clearResult(){}, clearHistory(){},
};

export class Container {
  constructor(config) {
    this.config = config;
    this.id     = config.id;
    this.P      = config.physics || PHYSICS;
    this.geo    = makeGeometry(config.dims);

    // Own canvas + context (one per container; CSS lays them out).
    this.canvas = document.createElement('canvas');
    this.canvas.width  = this.geo.w;
    this.canvas.height = this.geo.h;
    this.canvas.className = 'sim-canvas sim-' + this.id.replace(/\s+/g, '-');
    this.ctx = this.canvas.getContext('2d');

    // Pluggable strategies — naive path is the default (vase parity).
    this.broadphase = config.broadphase === 'grid'
      ? new UniformGridBroadphase(config.cellSize || this.geo.ballR * 2)
      : new AllPairsBroadphase();
    this.renderStrategy = config.renderDetail === 'color'
      ? new BallSpriteRenderer()
      : new BallTextRenderer();
    this.initStrategy = config.initMode === 'packed-grid'
      ? new PackedGridInit()
      : new PresettleInit();

    // Fixed-timestep accumulator — inert for the vase (maxSubsteps=1).
    this.fixedDt     = config.fixedDt || (1/60);
    this.maxSubsteps = config.maxSubsteps || 1;
    this.acc         = 0;

    // Hard containment clamp — opt-in; keeps dense/small balls from tunnelling
    // through walls. Off for the big-ball vases (exact original behaviour).
    this.containment = config.containment || false;

    // Calm settling — opt-in; once the air is off, use a dead restitution and
    // run extra position-relaxation passes so a dense pile converges to rest
    // instead of jittering. Off for the small vases (sparse piles settle fine).
    this.calmSettle = config.calmSettle || false;

    // Fair draws — opt-in; assign labels from a random shuffle each draw so the
    // captured number is uniform over 0..count-1 despite positional capture bias.
    this.shuffleLabels = config.shuffleLabels || false;

    // Per-instance state (was global).
    this.simState   = 'idle';
    this.stateTimer = 0;
    this.gateDelay  = 0;
    this.airPower   = 0;
    this.airBase    = 0;
    this.airSetting = config.airSetting ?? 0.75;
    this.globalTime = 0;
    this.chosenBall = null;
    this.history    = [];
    this.balls      = [];
    this.airParts   = [];
    this.gate       = { t: 0, opening: false };

    this.ui = NOOP_UI;
    this.init();
  }

  // Called by ui.buildPanel once the DOM panel + setters exist.
  mountUI(ui) {
    this.ui = ui;
    this.ui.setStatus('Ready');
    this.ui.setBtnGate(false, false);
  }

  // ── Setup / reset ──
  init() {
    this.balls = this.initStrategy.place({
      geo: this.geo, P: this.P,
      count: this.config.ballCount,
      labels: this.config.labels,
      palette: this.config.palette,
      broadphase: this.broadphase,
      containment: this.containment,
      shuffleLabels: this.shuffleLabels,
    });
    this.initAirParts();
  }

  initAirParts() {
    this.airParts = [];
    for (let i = 0; i < 44; i++) this.airParts.push(this.newPart(true));
  }

  newPart(randomY) {
    const geo = this.geo, s = 14;
    return {
      x: geo.centerX + (Math.random()-.5)*s,
      y: randomY ? geo.bodyTopY + Math.random()*(geo.funnelBotY-geo.bodyTopY) : geo.funnelBotY-2,
      vx: (Math.random()-.5)*16,
      vy: -(80 + Math.random()*170),
      r:  1.0 + Math.random()*2.0,
      life: 0, maxLife: 0.45 + Math.random()*0.7,
    };
  }

  // ── Controls ──
  startBlow() {
    if (this.simState !== 'idle') return;
    this.chosenBall = null; this.airBase = 0; this.airPower = 0;
    this.stateTimer = 0; this.gate.t = 0; this.gate.opening = false;
    this.init();
    this.ui.clearCaptured();
    this.ui.clearResult();
    this.simState = 'ramping';
    this.ui.setBtnBlow(false); this.ui.setBtnGate(false, false);
    this.ui.setDot('active'); this.ui.setStatus('Air ramping…');
  }

  openGate() {
    if (this.simState !== 'tumbling') return;
    // Hold the gate shut for a randomised 3 ± 1 s while balls keep tumbling,
    // so the moment of release is unpredictable.
    this.simState = 'gate_wait';
    this.stateTimer = 0;
    this.gateDelay = this.P.GATE_DELAY + (Math.random()*2 - 1) * this.P.GATE_DELAY_JIT;
    this.gate.opening = false;
    this.ui.setBtnGate(false, false);
    this.ui.setDot('gate'); this.ui.setStatus('Gate triggered…');
  }

  resetHistory() {
    this.history = [];
    this.ui.clearHistory();
  }

  // ── Main step (called by the manager loop) ──
  step(dt) {
    // Vase path: maxSubsteps=1 → one advance per frame with the real dt,
    // identical to the original single loop.
    if (this.maxSubsteps <= 1) { this.advance(dt); return; }
    // Many-ball path: fixed-timestep with a substep cap for stability.
    this.acc += dt;
    let n = this.maxSubsteps;
    while (this.acc >= this.fixedDt && n-- > 0) {
      this.advance(this.fixedDt);
      this.acc -= this.fixedDt;
    }
    if (this.acc > this.fixedDt * this.maxSubsteps) this.acc = 0; // bleed off backlog
  }

  advance(dt) {
    const P = this.P;
    this.globalTime += dt;

    const pulse = P.PULSE_AMP*Math.sin(this.globalTime*P.PULSE_FREQ*Math.PI*2)
                + P.PULSE_AMP*.5*Math.sin(this.globalTime*P.PULSE_FREQ*1.73*Math.PI*2)
                + P.PULSE_AMP*.25*Math.sin(this.globalTime*P.PULSE_FREQ*3.1*Math.PI*2);

    switch (this.simState) {
      case 'ramping':
        this.stateTimer += dt;
        this.airBase = Math.min(this.stateTimer/P.RAMP_TIME, 1.0)*this.airSetting;
        this.airPower = Math.max(0, this.airBase+pulse*this.airBase);
        this.ui.setStatus(`Air ramping… ${Math.round(this.airBase*100)}%`);
        if (this.stateTimer >= P.RAMP_TIME) {
          this.simState = 'tumbling'; this.stateTimer = 0;
          this.ui.setDot('active'); this.ui.setStatus('Balls tumbling — open gate when ready');
          this.ui.setBtnGate(true, true);
        }
        break;

      case 'tumbling':
        this.airBase = this.airSetting;
        this.airPower = Math.max(0, this.airBase+pulse*this.airBase);
        break;

      case 'gate_wait':
        this.airBase = this.airSetting;
        this.airPower = Math.max(0, this.airBase+pulse*this.airBase);
        this.stateTimer += dt;
        this.ui.setStatus(`Gate triggered — opening in ${Math.max(0, this.gateDelay-this.stateTimer).toFixed(1)}s`);
        if (this.stateTimer >= this.gateDelay) {
          this.simState = 'gate_open';
          this.gate.opening = true;
          this.ui.setStatus('Gate opening…');
        }
        break;

      case 'gate_open':
        this.airBase = this.airSetting;
        this.airPower = Math.max(0, this.airBase+pulse*this.airBase);
        if (this.gate.opening && this.gate.t < 1.0) {
          this.gate.t = Math.min(1.0, this.gate.t + P.GATE_OPEN_SPEED*dt);
          if (this.gate.t >= 1.0) this.triggerCapture();
        }
        break;

      case 'capturing':
        this.airBase = this.airSetting;
        this.airPower = Math.max(0, this.airBase + pulse*this.airBase);
        break;

      case 'settling':
        this.airBase *= 0.86; this.airPower = Math.max(0, this.airBase);
        if (this.airPower < 0.01) this.airPower = 0;
        break;

      case 'idle':
        this.airPower = 0; this.airBase = 0;
        break;
    }

    this.updateBalls(dt);
    this.updateAirParts(dt);
  }

  updateBalls(dt) {
    const P = this.P, geo = this.geo;
    const s = this.simState;
    const airOn = (s==='ramping'||s==='tumbling'||s==='gate_wait'||s==='gate_open'||s==='capturing');
    const drag = airOn ? P.DRAG_ON : P.DRAG_OFF;
    const calm = !airOn && this.calmSettle;   // settle a dense pile to rest
    const wallRest = calm ? P.REST_WALL_SETTLE : P.REST_WALL;

    for (const b of this.balls) {
      if (b.captured) continue;

      let ax = 0, ay = P.GRAVITY;

      if (airOn && this.airPower > 0.01) {
        ay -= jetForce(geo, P, this.airPower, b.x, b.y);

        if (b !== this.chosenBall || this.simState !== 'capturing') {
          b.turbTimer--;
          if (b.turbTimer <= 0) {
            b.turbX = (Math.random()-.5) * 2 * P.TURB_LAT  * this.airPower;
            b.turbY = (Math.random()-.5) * 2 * P.TURB_VERT * this.airPower;
            b.turbTimer = P.TURB_FRAMES + Math.floor(Math.random()*5);
          }
          ax += b.turbX;
          ay += b.turbY;
          ay += (Math.random()-.5) * P.GRAVITY * 0.55 * this.airPower;
          ax += (Math.random()-.5) * P.TURB_LAT * 0.35 * this.airPower;
        }
      }

      b.vx *= (1-drag); b.vy *= (1-drag);

      if (b === this.chosenBall && this.simState === 'capturing') {
        ax += (geo.centerX - b.x) * P.CHANNEL_STR;
      }

      b.vx += ax*dt; b.vy += ay*dt;

      const spd = Math.hypot(b.vx, b.vy);
      if (spd > P.SPEED_CAP) { b.vx *= P.SPEED_CAP/spd; b.vy *= P.SPEED_CAP/spd; }

      b.x += b.vx*dt; b.y += b.vy*dt;

      resolveSegments(geo, P, b, wallRest);
      resolveGate(geo, P, this.gate, b);
      if (this.containment) clampToContainer(geo, b);

      // Tube exit — first ball into the open tube wins.
      const inTubeX = b.x > geo.tubeL + b.r * 0.5 && b.x < geo.tubeR - b.r * 0.5;
      if (inTubeX && b.y - b.r < geo.bodyTopY && this.gate.t >= 1.0) {
        if ((this.simState === 'capturing' || this.simState === 'gate_open') && !b.captured) {
          b.captured = true;
          this.chosenBall = b;
          this.finishCapture(b);
        }
      }
    }

    resolveBallCollisions(this.balls, calm ? P.REST_BALL_SETTLE : P.REST_BALL, this.broadphase);

    // When the air is off, run extra position-only relaxation passes so a dense
    // pile converges to a non-overlapping rest state instead of jittering.
    // rest=0 → pure separation: no bounce energy, and velocities are left alone,
    // so balls still fall naturally while settling (no floaty slow-fall).
    if (calm) {
      for (let k = 0; k < P.SETTLE_ITERS; k++) {
        resolveBallCollisions(this.balls, 0, this.broadphase);
        for (const b of this.balls) {
          if (b.captured) continue;
          resolveSegments(geo, P, b, 0);
          if (this.containment) clampToContainer(geo, b);
        }
      }
    }
  }

  updateAirParts(dt) {
    if (this.airPower < 0.02) return;
    const geo = this.geo;
    for (const p of this.airParts) {
      p.life += dt;
      const t = p.life / p.maxLife;
      p.vx += (Math.random()-.5)*14; p.vx *= 0.94;
      p.x += p.vx*dt; p.y += p.vy*dt*this.airPower;
      p.alpha = Math.sin(t*Math.PI)*0.16*this.airPower;
      if (p.life >= p.maxLife || p.y < geo.bodyTopY - 20) Object.assign(p, this.newPart(false));
    }
  }

  // ── Capture ──
  triggerCapture() {
    const geo = this.geo, P = this.P;
    let best = null, bestScore = Infinity;
    for (const b of this.balls) {
      if (b.captured) continue;
      const heightScore   = (b.y - geo.bodyTopY) * 0.8;
      const centerScore   = Math.abs(b.x - geo.centerX) * 1.2;
      const momentumBonus = Math.max(0, b.vy) * 0.15;
      const score = heightScore + centerScore - momentumBonus;
      if (score < bestScore) { bestScore = score; best = b; }
    }
    if (!best) return;
    this.chosenBall = best;
    this.simState = 'capturing';
    best.x  = geo.centerX + (best.x - geo.centerX) * 0.3; // snap 70% toward center
    best.vx = 0;
    best.vy = -P.CAPTURE_BOOST;
    this.ui.setDot('capture'); this.ui.setStatus('Capturing…');
    this.ui.setBtnGate(false, false);
  }

  finishCapture(ball) {
    const P = this.P;
    this.simState = 'settling';
    this.stateTimer = 0;
    this.airBase = 0; this.airPower = 0;
    this.gate.t = 1.0;
    this.history.push(ball.label);
    this.ui.updateResult(ball);
    this.ui.addHistoryRow(ball.label, this.history.length, ball.color);
    this.ui.showCapturedStage(ball);
    this.ui.setDot(''); this.ui.setStatus('Settling…');
    this.ui.setBtnGate(false, false);
    setTimeout(() => {
      this.simState = 'idle';
      this.gate.t = 0; this.gate.opening = false;
      this.ui.setDot(''); this.ui.setStatus('Ready');
      this.ui.setBtnBlow(true);
    }, P.SETTLE_TIME * 1000);
  }

  // ── Render ──
  draw() {
    drawScene(this.ctx, this.geo, this.viewState(), this.renderStrategy);
  }

  viewState() {
    return { airPower: this.airPower, gate: this.gate, balls: this.balls, airParts: this.airParts };
  }
}

// ═══════════════════════════════════════════════
//  INIT STRATEGIES
// ═══════════════════════════════════════════════

// Random scatter + 120-step synchronous presettle. Used by the vase —
// identical to the original initBalls.
export class PresettleInit {
  place({ geo, P, count, labels, palette, broadphase, containment, shuffleLabels }) {
    // The draw is decided by physical position, which is not perfectly uniform
    // across ball indices in a dense pile. To make the captured NUMBER uniform
    // regardless, assign each ball a label (and matching colour) from a fresh
    // shuffle of 0..count-1 each draw. Whichever physical ball the physics
    // favours, the number it carries is then uniformly random.
    const lab = Array.from({ length: count }, (_, i) => i);
    if (shuffleLabels) {
      for (let i = count - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = lab[i]; lab[i] = lab[j]; lab[j] = t;
      }
    }
    const balls = [];
    for (let i = 0; i < count; i++) {
      const li = lab[i];   // label/colour index (shuffled when enabled)
      const randY = geo.funnelBotY - geo.ballR - Math.random() * (geo.funnelBotY - geo.bodyBotY + 100);
      const frac  = Math.max(0, (randY - geo.bodyBotY) / (geo.funnelBotY - geo.bodyBotY));
      const wallL = geo.bodyLeft  + frac * (geo.nozzleL - geo.bodyLeft)  + geo.ballR * 1.4;
      const wallR = geo.bodyRight + frac * (geo.nozzleR - geo.bodyRight) - geo.ballR * 1.4;
      const randX = wallL + Math.random() * Math.max(1, wallR - wallL);
      balls.push({
        id: i, label: labels(li),
        x: randX, y: randY,
        vx: (Math.random()-.5)*50, vy: Math.random()*30,
        r: geo.ballR,
        color: palette[li % palette.length],
        turbX: 0, turbY: 0,
        turbTimer: Math.floor(Math.random() * P.TURB_FRAMES),
        captured: false,
      });
    }
    for (let s = 0; s < 120; s++) {
      const dt = 1/60;
      for (const b of balls) {
        b.vy += P.GRAVITY * dt;
        b.vx *= 0.84; b.vy *= 0.84;
        b.x += b.vx * dt; b.y += b.vy * dt;
        resolveSegments(geo, P, b, 0.25);
        if (containment) clampToContainer(geo, b);
      }
      resolveBallCollisions(balls, 0.25, broadphase);
    }
    for (const b of balls) { b.vx = 0; b.vy = 0; }
    return balls;
  }
}

// Deterministic packed lattice, no synchronous presettle — avoids the
// main-thread freeze at high ball counts. NOT wired for the vase; intended
// for the large base (~350 balls).
export class PackedGridInit {
  place({ geo, P, count, labels, palette }) {
    const balls = [];
    const r = geo.ballR;
    const spacing = r*2 + 1;
    const left  = geo.bodyLeft  + r + 2;
    const right = geo.bodyRight - r - 2;
    const cols  = Math.max(1, Math.floor((right - left) / spacing));
    let i = 0, row = 0;
    while (i < count) {
      const y = geo.funnelBotY - r - 2 - row*spacing;
      for (let c = 0; c < cols && i < count; c++, i++) {
        const x = left + c*spacing + (row % 2 ? spacing/2 : 0);
        balls.push({
          id: i, label: labels(i),
          x: Math.min(right, x), y,
          vx: 0, vy: 0,
          r,
          color: palette[i % palette.length],
          turbX: 0, turbY: 0,
          turbTimer: Math.floor(Math.random() * P.TURB_FRAMES),
          captured: false,
        });
      }
      row++;
    }
    return balls;
  }
}
