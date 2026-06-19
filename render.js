// ═══════════════════════════════════════════════
//  render.js
//  All canvas drawing. Every function takes a target ctx,
//  the container geometry (`geo`) and a `view` snapshot
//  ({ airPower, gate, balls, airParts }) — no globals.
//
//  Depends on: geometry.js (shadeColor).
// ═══════════════════════════════════════════════
import { shadeColor } from './geometry.js';

// Draw one full frame for a container into its own ctx.
export function drawScene(ctx, geo, view, renderStrategy) {
  ctx.clearRect(0, 0, geo.w, geo.h);
  drawContainer(ctx, geo, view.airPower);
  drawNozzle(ctx, geo, view.airPower);
  drawAirParts(ctx, view.airParts, view.airPower);
  for (const b of view.balls) renderStrategy.draw(ctx, geo, view, b);
  drawGate(ctx, geo, view.gate);
  drawTube(ctx, geo);
}

// ── Container glass (vase outline) ──
function containerPath(ctx, geo) {
  ctx.beginPath();
  ctx.moveTo(geo.bodyLeft + geo.topInset, geo.bodyTopY);
  ctx.lineTo(geo.bodyRight - geo.topInset, geo.bodyTopY);
  ctx.lineTo(geo.bodyRight, geo.bodyTopY + geo.topH);
  ctx.lineTo(geo.bodyRight, geo.bodyBotY);
  ctx.lineTo(geo.nozzleR,   geo.funnelBotY);
  ctx.lineTo(geo.nozzleL,   geo.funnelBotY);
  ctx.lineTo(geo.bodyLeft,  geo.bodyBotY);
  ctx.lineTo(geo.bodyLeft,  geo.bodyTopY + geo.topH);
  ctx.closePath();
}

function drawContainer(ctx, geo, airPower) {
  // Exterior glow
  if (airPower > 0.04) {
    const g = ctx.createRadialGradient(geo.centerX, geo.funnelBotY, 0, geo.centerX, geo.funnelBotY, 160);
    g.addColorStop(0, `rgba(50,130,255,${0.30*airPower})`);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.fillRect(0, geo.funnelBotY-40, geo.w, 80);
  }

  // Interior fill
  ctx.save();
  containerPath(ctx, geo);
  ctx.fillStyle = '#080c16';
  ctx.fill();
  ctx.restore();

  // Air jet column (narrow glow from nozzle upward)
  if (airPower > 0.03) {
    ctx.save();
    containerPath(ctx, geo); ctx.clip();
    const jw = 45 + 30*airPower;
    const jg = ctx.createRadialGradient(geo.centerX, geo.funnelBotY, 0, geo.centerX, geo.funnelBotY, geo.w*0.8);
    jg.addColorStop(0,   `rgba(50,130,255,${0.32*airPower})`);
    jg.addColorStop(0.25,`rgba(50,130,255,${0.10*airPower})`);
    jg.addColorStop(1,   'transparent');
    ctx.fillStyle = jg;
    ctx.fillRect(geo.centerX-jw, geo.bodyTopY, jw*2, geo.funnelBotY-geo.bodyTopY);
    ctx.restore();
  }

  // Glass walls — specular left
  ctx.save();
  containerPath(ctx, geo);
  const gl = ctx.createLinearGradient(geo.bodyLeft, 0, geo.bodyLeft+26, 0);
  gl.addColorStop(0, 'rgba(180,215,255,0.11)');
  gl.addColorStop(.6, 'rgba(180,215,255,0.02)');
  gl.addColorStop(1, 'transparent');
  ctx.fillStyle = gl; ctx.fill();
  ctx.strokeStyle = 'rgba(150,200,255,0.30)';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.restore();

  // Funnel angle accent lines
  ctx.save();
  ctx.strokeStyle = 'rgba(100,160,255,0.12)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const frac = i / 4;
    const lx = geo.bodyLeft + frac*(geo.nozzleL-geo.bodyLeft);
    const ly = geo.bodyBotY + frac*(geo.funnelBotY-geo.bodyBotY);
    const rx = geo.bodyRight + frac*(geo.nozzleR-geo.bodyRight);
    ctx.beginPath();
    ctx.moveTo(lx, ly); ctx.lineTo(rx, ly);
    ctx.stroke();
  }
  ctx.restore();
}

function drawNozzle(ctx, geo, airPower) {
  const nw = geo.nozzleHalf*2, ny = geo.funnelBotY;
  const nx = geo.centerX - geo.nozzleHalf;
  ctx.save();
  ctx.fillStyle = `rgba(70,150,255,${0.12+airPower*0.42})`;
  ctx.strokeStyle = `rgba(70,150,255,${0.35+airPower*0.55})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.rect(nx, ny, nw, 7); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = `rgba(100,180,255,${0.4+airPower*0.45})`;
  ctx.lineWidth = 1;
  for (let i=1;i<4;i++){
    const sx = nx + i*nw/4;
    ctx.beginPath(); ctx.moveTo(sx,ny+1); ctx.lineTo(sx,ny+6); ctx.stroke();
  }
  if (airPower>0.05) {
    ctx.shadowColor='#4090ff'; ctx.shadowBlur=14*airPower;
    ctx.strokeStyle=`rgba(130,200,255,${0.75*airPower})`;
    ctx.lineWidth=1.8;
    ctx.beginPath(); ctx.moveTo(nx,ny); ctx.lineTo(nx+nw,ny); ctx.stroke();
    ctx.shadowBlur=0;
  }
  ctx.restore();
}

function drawAirParts(ctx, airParts, airPower) {
  if (airPower < 0.02) return;
  ctx.save();
  for (const p of airParts) {
    ctx.globalAlpha = p.alpha || 0;
    ctx.fillStyle = '#9fd8ff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawGate(ctx, geo, gate) {
  if (gate.t >= 1.0) return;
  const gateY   = geo.bodyTopY;
  const slideX  = gate.t * (geo.tubeW + 6);
  const barL    = geo.tubeL + slideX;
  const barR    = geo.tubeR;
  if (barL >= barR) return;

  ctx.save();
  const gateAlpha = 1 - gate.t*0.6;
  ctx.fillStyle = `rgba(255,90,50,${0.75*gateAlpha})`;
  ctx.strokeStyle = `rgba(255,140,80,${0.9*gateAlpha})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(barL, gateY-4, barR-barL, 4);
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = `rgba(255,160,80,${0.8*gateAlpha})`;
  ctx.beginPath(); ctx.arc(barL+3, gateY-2, 3, 0, Math.PI*2); ctx.fill();

  if (gate.t < 0.1) {
    ctx.shadowColor = '#ff5522';
    ctx.shadowBlur  = 8;
    ctx.strokeStyle = `rgba(255,100,60,0.6)`;
    ctx.beginPath(); ctx.moveTo(barL, gateY); ctx.lineTo(barR, gateY); ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawTube(ctx, geo) {
  ctx.save();
  ctx.fillStyle = '#080c16';
  ctx.fillRect(geo.tubeL, geo.tubeTopY, geo.tubeW, geo.tubeH);
  ctx.strokeStyle = 'rgba(150,200,255,0.26)';
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(geo.tubeL, geo.tubeTopY+3); ctx.lineTo(geo.tubeL, geo.bodyTopY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(geo.tubeR, geo.tubeTopY+3); ctx.lineTo(geo.tubeR, geo.bodyTopY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(geo.tubeL, geo.tubeTopY+3); ctx.lineTo(geo.tubeR, geo.tubeTopY+3); ctx.stroke();
  ctx.font='8px DM Mono,monospace'; ctx.fillStyle='rgba(150,200,255,0.35)';
  ctx.textAlign='center';
  ctx.fillText('EXIT', geo.centerX, geo.tubeTopY-3);
  ctx.restore();
}

// ═══════════════════════════════════════════════
//  BALL RENDER STRATEGIES
// ═══════════════════════════════════════════════

// Per-ball radial gradient + shadow + numeric label. Used by the small vases —
// identical to the original drawBall.
export class BallTextRenderer {
  draw(ctx, geo, view, b) {
    if (b.captured) return;
    const airPower = view.airPower;
    ctx.save();
    if (airPower > 0.05) { ctx.shadowColor=b.color; ctx.shadowBlur=8*airPower; }
    const g = ctx.createRadialGradient(
      b.x-b.r*.3, b.y-b.r*.3, b.r*.04,
      b.x, b.y, b.r
    );
    g.addColorStop(0,'rgba(255,255,255,.70)');
    g.addColorStop(.3, b.color);
    g.addColorStop(1, shadeColor(b.color,-55));
    ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2);
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.12)'; ctx.lineWidth=.8; ctx.stroke();
    ctx.shadowBlur=0;
    ctx.font=`600 ${Math.round(b.r*1.0)}px Inter,sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='rgba(255,255,255,.95)';
    ctx.fillText(b.label, b.x, b.y+.5);
    ctx.restore();
  }
}

// Cached offscreen sprites, one per palette colour, blitted via drawImage —
// color-only (no per-ball text). NOT wired for the vase; intended for the
// large base (~350 balls) where per-ball gradients + text are too costly.
// Sprites are built lazily on first use and keyed by colour.
export class BallSpriteRenderer {
  constructor() { this.sprites = new Map(); }
  _sprite(color, r) {
    const key = color + '@' + r;
    let s = this.sprites.get(key);
    if (s) return s;
    const size = Math.ceil(r*2) + 2;
    const off = (typeof OffscreenCanvas !== 'undefined')
      ? new OffscreenCanvas(size, size)
      : Object.assign(document.createElement('canvas'), { width: size, height: size });
    const c = off.getContext('2d');
    const cx = size/2, cy = size/2;
    const g = c.createRadialGradient(cx-r*.3, cy-r*.3, r*.04, cx, cy, r);
    g.addColorStop(0,'rgba(255,255,255,.70)');
    g.addColorStop(.3, color);
    g.addColorStop(1, shadeColor(color,-55));
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI*2);
    c.fillStyle = g; c.fill();
    this.sprites.set(key, off);
    return off;
  }
  draw(ctx, geo, view, b) {
    if (b.captured) return;
    const s = this._sprite(b.color, b.r);
    ctx.drawImage(s, b.x - s.width/2, b.y - s.height/2);
  }
}
