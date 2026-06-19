// ═══════════════════════════════════════════════
//  geometry.js
//  Tuning constants, colour palette, and per-instance
//  container geometry (derived from dimensions).
//
//  Leaf module — depends on nothing.
// ═══════════════════════════════════════════════

// ── Physics tuning constants (shared by all containers) ──
// These are feel-tuned for the vase scale. A larger container (the future
// base) may override jet/turbulence values via its own config; defaults stay
// shared here.
export const PHYSICS = {
  GRAVITY:        1280,
  DRAG_ON:        0.004,  // near-zero drag when air is on — balls keep kinetic energy
  DRAG_OFF:       0.020,  // settling drag
  REST_BALL:      0.82,   // bouncy ball-ball collisions
  REST_WALL:      0.72,   // walls throw balls back hard
  REST_FLOOR:     0.55,   // floor has more bounce
  FLOOR_FRICTION: 0.88,

  // Jet — Gaussian lift profile from the nozzle
  NOZZLE_SIGMA:   35,     // wider Gaussian — more balls directly hit by jet
  JET_PEAK:       4400,   // px/s² — at 75% power = 3300, well above 2×gravity
  JET_TOP_FRAC:   0.48,   // jet still meaningful at top

  // Turbulence — violent, fast-switching gusts
  TURB_LAT:       540,    // strong lateral gusts
  TURB_VERT:      300,    // significant vertical variation
  TURB_FRAMES:    5,      // switch every ~80ms — genuinely chaotic

  // Pulse
  PULSE_FREQ:     2.1,
  PULSE_AMP:      0.11,

  // Timing
  RAMP_TIME:      1.4,    // s
  CAPTURE_BOOST:  950,    // px/s — strong enough to clear tube fast
  CHANNEL_STR:    18,
  SETTLE_TIME:    2.8,

  // Gate
  GATE_OPEN_SPEED: 5.5,   // snaps open in ~0.18s
  GATE_DELAY:      3.0,   // s — base delay between OPEN GATE press and gate opening
  GATE_DELAY_JIT:  1.0,   // s — ± random jitter; actual delay ∈ [2,4]s

  // Misc
  SPEED_CAP:      1200,   // px/s
};

// Default 10-ball palette (small vases). The base will pass its own palette.
export const BALL_COLORS = [
  '#ff4d6d','#ff8c42','#ffd166','#06d6a0','#118ab2',
  '#9b5de5','#f15bb5','#00bbf9','#e9ff70','#70e000'
];

// Lighten/darken a #rrggbb colour by an additive amount.
export function shadeColor(hex, amt) {
  let r = parseInt(hex.slice(1,3),16),
      g = parseInt(hex.slice(3,5),16),
      b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.max(0,Math.min(255,r+amt))},${Math.max(0,Math.min(255,g+amt))},${Math.max(0,Math.min(255,b+amt))})`;
}

// ── Container geometry ──
// `dims` carries the resolved absolute pixel anchors for one container. The
// vase passes the original literal values (exact parity). A larger container
// computes these from its own width/height in its config factory before
// calling makeGeometry — the math here is dimension-driven, not hard-coded.
//
//   dims = {
//     w, h,                            // canvas size
//     bodyTopY, bodyBotY, funnelBotY,  // vertical levels
//     bodyLeft, bodyRight,             // upper-body walls
//     nozzleHalf, topInset, topH,      // funnel/chamfer sizes
//     tubeW, tubeH,                    // exit tube
//     ballR,                           // ball radius
//   }
//
// Returns a frozen geometry object whose `wallSegs` (collision segments with
// inward-pointing unit normals) is DERIVED here per instance — never global.
export function makeGeometry(dims) {
  const {
    w, h,
    bodyTopY, bodyBotY, funnelBotY,
    bodyLeft, bodyRight,
    nozzleHalf, topInset, topH,
    tubeW, tubeH,
    ballR,
  } = dims;

  const centerX = (bodyLeft + bodyRight) / 2;
  const nozzleL = centerX - nozzleHalf;
  const nozzleR = centerX + nozzleHalf;
  const tubeL   = centerX - tubeW / 2;
  const tubeR   = centerX + tubeW / 2;
  const tubeTopY = bodyTopY - tubeH;
  const tubeBotY = bodyTopY;

  const wallSegs = makeWallSegments({
    bodyTopY, bodyBotY, funnelBotY, bodyLeft, bodyRight,
    centerX, nozzleL, nozzleR, topInset, topH, tubeW,
  });

  return Object.freeze({
    w, h,
    bodyTopY, bodyBotY, funnelBotY,
    bodyLeft, bodyRight,
    nozzleHalf, centerX, nozzleL, nozzleR,
    topInset, topH,
    tubeW, tubeH, tubeL, tubeR, tubeTopY, tubeBotY,
    ballR,
    wallSegs,
  });
}

// Build the wall collision segments. Each segment has an inward-pointing unit
// normal (nx,ny). Geometry: chamfered top, vertical upper body, inward funnel
// to a narrow nozzle, plus the ceiling split around the exit tube.
function makeWallSegments(g) {
  const { bodyTopY, bodyBotY, funnelBotY, bodyLeft, bodyRight,
          centerX, nozzleL, nozzleR, topInset, topH, tubeW } = g;
  const segs = [];
  function seg(x1,y1,x2,y2,nx,ny) {
    const len = Math.hypot(nx,ny);
    segs.push({ x1,y1,x2,y2, nx:nx/len, ny:ny/len });
  }

  // LEFT lower wall — vertical from funnel junction to top-taper start
  seg(bodyLeft, bodyTopY + topH, bodyLeft, bodyBotY,  1, 0);

  // LEFT top taper — angled inward
  {
    const dx = topInset, dy = -topH;
    seg(bodyLeft, bodyTopY+topH, bodyLeft+topInset, bodyTopY, -dy, dx);
  }

  // LEFT funnel wall
  {
    const dx = nozzleL - bodyLeft, dy = funnelBotY - bodyBotY;
    seg(bodyLeft, bodyBotY, nozzleL, funnelBotY,  dy, -dx);
  }

  // RIGHT lower wall — vertical
  seg(bodyRight, bodyBotY, bodyRight, bodyTopY + topH,  -1, 0);

  // RIGHT top taper
  {
    const dx = topInset, dy = topH;
    seg(bodyRight-topInset, bodyTopY, bodyRight, bodyTopY+topH, -dy, dx);
  }

  // RIGHT funnel wall
  {
    const dx = bodyRight - nozzleR, dy = bodyBotY - funnelBotY;
    seg(nozzleR, funnelBotY, bodyRight, bodyBotY,  dy, -dx);
  }

  // FLOOR (nozzle span)
  seg(nozzleL, funnelBotY, nozzleR, funnelBotY,  0, -1);

  // CEILING — left of tube
  seg(bodyLeft+topInset, bodyTopY, centerX - tubeW/2, bodyTopY,  0, 1);
  // CEILING — right of tube
  seg(centerX + tubeW/2, bodyTopY, bodyRight-topInset, bodyTopY,  0, 1);

  return segs;
}

// The vase's exact original geometry (literal pixels → byte-for-byte parity).
export const VASE_DIMS = {
  w: 310, h: 520,
  bodyTopY: 40, bodyBotY: 230, funnelBotY: 480,
  bodyLeft: 52, bodyRight: 258,
  nozzleHalf: 18, topInset: 14, topH: 55,
  tubeW: 32, tubeH: 62,
  ballR: 13,
};
