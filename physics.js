// ═══════════════════════════════════════════════
//  physics.js
//  Stateless physics helpers. Every function takes the
//  container's geometry (`geo`), tuning (`P` = PHYSICS) and
//  state as parameters — nothing here reads a global.
//
//  Depends on: geometry.js types only.
// ═══════════════════════════════════════════════

// ── Jet lift: Gaussian profile centred on the nozzle, fading toward the top ──
export function jetForce(geo, P, airPower, bx, by) {
  if (airPower < 0.01) return 0;
  const dx = bx - geo.centerX;
  const horiz = Math.exp(-(dx*dx)/(2*P.NOZZLE_SIGMA*P.NOZZLE_SIGMA));
  const hRatio = Math.max(0, Math.min(1, (geo.funnelBotY - by)/(geo.funnelBotY - geo.bodyTopY)));
  const vert  = 1.0 - (1.0 - P.JET_TOP_FRAC)*hRatio;
  return airPower * P.JET_PEAK * horiz * vert;
}

// ── Wall-segment collision: resolve a ball against every wall segment ──
export function resolveSegments(geo, P, b, restitution) {
  for (const seg of geo.wallSegs) {
    const ex = seg.x2 - seg.x1, ey = seg.y2 - seg.y1;
    const len2 = ex*ex + ey*ey;
    if (len2 < 1e-8) continue;
    const t = Math.max(0, Math.min(1, ((b.x-seg.x1)*ex + (b.y-seg.y1)*ey)/len2));
    const cx = seg.x1 + t*ex, cy = seg.y1 + t*ey;
    const dx = b.x - cx, dy = b.y - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < b.r && dist > 1e-5) {
      const dot = dx*seg.nx + dy*seg.ny;
      if (dot < b.r) {
        const pen = b.r - dot;
        b.x += seg.nx * pen;
        b.y += seg.ny * pen;
        const vDot = b.vx*seg.nx + b.vy*seg.ny;
        if (vDot < 0) {
          b.vx -= (1 + restitution) * vDot * seg.nx;
          b.vy -= (1 + restitution) * vDot * seg.ny;
          // Tangential friction on near-horizontal (floor) surfaces
          if (Math.abs(seg.ny) > 0.7) {
            b.vx *= P.FLOOR_FRICTION;
          }
        }
      }
    }
  }
}

// ── Gate collision: closed gate blocks the tube entrance ──
// `gate` = { t, opening }. t=0 closed, t>=1 open (no collision).
export function resolveGate(geo, P, gate, b) {
  if (gate.t >= 1.0) return;
  const gateY = geo.bodyTopY;
  if (b.y - b.r > gateY + 4) return;
  // Gate slides left→right as it opens.
  const gateLeft  = geo.tubeL + gate.t * (geo.tubeW + b.r*2 + 4);
  const gateRight = geo.tubeR;
  if (b.x + b.r < gateLeft || b.x - b.r > gateRight) return;
  if (b.y - b.r < gateY && b.vy < 0) {
    b.y = gateY + b.r;
    b.vy = Math.abs(b.vy) * P.REST_WALL * 0.5;
  }
}

// ── Ball-ball collision: resolve impulses for candidate pairs ──
// `broadphase.pairs(balls)` yields the [a,b] pairs to test.
export function resolveBallCollisions(balls, rest, broadphase) {
  for (const [a, b] of broadphase.pairs(balls)) {
    if (a.captured || b.captured) continue;
    const dx = b.x-a.x, dy = b.y-a.y;
    const d = Math.hypot(dx,dy);
    const minD = a.r+b.r;
    if (d < minD && d > 1e-5) {
      const nx=dx/d, ny=dy/d;
      const pen=(minD-d)/2;
      a.x -= nx*pen; a.y -= ny*pen;
      b.x += nx*pen; b.y += ny*pen;
      const dvn = (b.vx-a.vx)*nx + (b.vy-a.vy)*ny;
      if (dvn < 0) {
        const imp = dvn * rest;
        a.vx += imp*nx; a.vy += imp*ny;
        b.vx -= imp*nx; b.vy -= imp*ny;
      }
    }
  }
}

// ═══════════════════════════════════════════════
//  BROADPHASE STRATEGIES
//  Decide which ball pairs are worth a narrow-phase test.
// ═══════════════════════════════════════════════

// All-pairs O(n²). Yields pairs in exact i<j order — used by the small vases,
// behaviourally identical to the original nested loop.
export class AllPairsBroadphase {
  *pairs(balls) {
    for (let i = 0; i < balls.length; i++)
      for (let j = i+1; j < balls.length; j++)
        yield [balls[i], balls[j]];
  }
}

// Uniform spatial grid → O(n) for evenly-spread balls. NOT wired for the vase;
// intended for the large base (~350 balls) where all-pairs is too costly.
// Each ball checks its own cell plus the four "forward" neighbour cells
// (E, SE, S, SW) so every pair is yielded exactly once.
export class UniformGridBroadphase {
  constructor(cellSize) { this.cellSize = cellSize; }
  *pairs(balls) {
    const cell = this.cellSize;
    const grid = new Map();
    const key = (cx, cy) => cx + ',' + cy;
    for (const b of balls) {
      const cx = Math.floor(b.x / cell), cy = Math.floor(b.y / cell);
      const k = key(cx, cy);
      let bucket = grid.get(k);
      if (!bucket) grid.set(k, bucket = []);
      bucket.push(b);
    }
    const NEIGHBORS = [[1,0],[1,1],[0,1],[-1,1]]; // E, SE, S, SW
    for (const [k, bucket] of grid) {
      // within-cell pairs
      for (let i = 0; i < bucket.length; i++)
        for (let j = i+1; j < bucket.length; j++)
          yield [bucket[i], bucket[j]];
      // forward-neighbour pairs
      const [cxs, cys] = k.split(',');
      const cx = +cxs, cy = +cys;
      for (const [dx, dy] of NEIGHBORS) {
        const other = grid.get(key(cx+dx, cy+dy));
        if (!other) continue;
        for (const a of bucket)
          for (const b of other)
            yield [a, b];
      }
    }
  }
}
