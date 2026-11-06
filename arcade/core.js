"use strict";
// =====================================================================
//  3-in-1 아케이드 공용 엔진: 화면, 유틸, 오디오, 이펙트, 장면 전환, 입력
// =====================================================================
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const FONT = "'Black Han Sans','Arial Black','Malgun Gothic',sans-serif";
const TAU = Math.PI * 2;
let W = 800, H = 600, DPR = 1, T = 0;

// ---------------- 유틸 ----------------
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, k) => a + (b - a) * k;
const damp = (a, b, r, dt) => lerp(a, b, 1 - Math.exp(-r * dt));
const easeOutBack = k => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const easeInBack = k => 2.7 * k * k * k - 1.7 * k * k;
const easeOutElastic = k => k <= 0 ? 0 : k >= 1 ? 1 : Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * 2 * Math.PI / 3) + 1;
const easeOutCubic = k => 1 - Math.pow(1 - k, 3);
const easeInOutCubic = k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
function hex(c) { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function mix(a, b, k) { const A = hex(a), B = hex(b); return `rgb(${A[0] + (B[0] - A[0]) * k | 0},${A[1] + (B[1] - A[1]) * k | 0},${A[2] + (B[2] - A[2]) * k | 0})`; }
function rgba(c, a) { const A = hex(c); return `rgba(${A[0]},${A[1]},${A[2]},${a})`; }
const hsl = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;
function rr(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, TAU); }
function outlined(txt, x, y, size, col, align = 'left', lw, stroke = 'rgba(0,0,0,.85)') {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.lineJoin = 'round';
  ctx.lineWidth = lw ?? Math.max(3, size * 0.15); ctx.strokeStyle = stroke; ctx.strokeText(txt, x, y);
  ctx.fillStyle = col; ctx.fillText(txt, x, y);
}
const inRect = (x, y, r) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// ---------------- 화면 연출 상태 ----------------
const S = { shake: 0, punch: 0, hitstop: 0, slowT: 0, timeScale: 1, flash: 0, red: 0 };

// ---------------- 이펙트 ----------------
const FX = {
  parts: [], rings: [], flashes: [], texts: [],
  reset() { this.parts = []; this.rings = []; this.flashes = []; this.texts = []; },
  add(o) {
    if (this.parts.length > 2500) return null;
    o.max = o.life; o.dr = o.dr ?? 0.3; o.g = o.g ?? 0; o.rot = o.rot ?? rand(0, TAU); o.vr = o.vr ?? rand(-10, 10); o.s = o.s ?? 3;
    this.parts.push(o); return o;
  },
  text(x, y, txt, col = '#fff', size = 28, life = 1, vy = -60) { this.texts.push({ x, y, txt, col, size, life, max: life, vy }); },
  ring(x, y, R, life = 0.45, w = 5, col = '#ffffff') { this.rings.push({ x, y, R, life, max: life, w, col }); },
  flash(x, y, r, life = 0.18, col = '255,250,235') { this.flashes.push({ x, y, r, life, max: life, col }); },
  sparks(x, y, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const sp = o.spread ?? 0.6, a = o.dir != null ? o.dir + rand(-sp, sp) : rand(0, TAU), v = rand(o.min ?? 150, o.max ?? 600);
      this.add({ type: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.25, 0.6) * (o.life ?? 1), s: o.w ?? 2, dr: 0.2, g: o.g ?? 500, col: o.col || '#ffe08a' });
    }
  },
  glow(x, y, n, col, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), v = rand(o.min ?? 30, o.max ?? 220);
      this.add({ type: 'glow', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.4, 0.9) * (o.life ?? 1), s: rand(2, o.s ?? 5), dr: 0.15, g: o.g ?? 0, col });
    }
  },
  shards(x, y, n, cols, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = o.dir != null ? o.dir + rand(-1.2, 1.2) : rand(0, TAU), v = rand(o.min ?? 100, o.max ?? 500);
      this.add({ type: 'shard', x: x + rand(-(o.w ?? 0), o.w ?? 0) / 2, y: y + rand(-(o.h ?? 0), o.h ?? 0) / 2, vx: Math.cos(a) * v + (o.vx ?? 0), vy: Math.sin(a) * v - (o.up ?? 200), life: rand(0.7, 1.4) * (o.life ?? 1), s: rand(o.smin ?? 3, o.smax ?? 8), dr: 0.6, g: o.g ?? 1400, col: Array.isArray(cols) ? cols[i % cols.length] : cols, floor: o.floor });
    }
  },
  smoke(x, y, n, o = {}) {
    for (let i = 0; i < n; i++) this.add({ type: 'smoke', x: x + rand(-8, 8), y: y + rand(-8, 8), vx: rand(-1, 1) * (o.v ?? 60) + (o.vx ?? 0), vy: rand(-1, 0.3) * (o.v ?? 60), life: rand(0.5, 1) * (o.life ?? 1), s: rand(6, o.s ?? 14), dr: 0.15, g: -30, col: o.col || '200,200,210', a: o.a ?? 1 });
  },
  explode(x, y, r, o = {}) {
    this.flash(x, y, r * 1.6, 0.2);
    this.ring(x, y, r * 1.5, 0.5, r > 100 ? 10 : 6, '#ffffff');
    this.ring(x, y, r * 0.9, 0.3, 4, '#ffbe5a');
    const n = Math.min(60, r * 0.5 | 0);
    for (let i = 0; i < n; i++) { const a = rand(0, TAU), v = rand(0.15, 1) * r * 4; this.add({ type: 'fire', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.3, 0.7), s: rand(0.14, 0.32) * r, dr: 0.015, g: -150 }); }
    for (let i = 0; i < n * 0.5; i++) { const a = rand(0, TAU), v = rand(0.1, 0.5) * r * 2, sh = rand(60, 120) | 0; this.add({ type: 'smoke', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: rand(0.8, 1.8), s: rand(0.2, 0.4) * r, dr: 0.12, g: -50, col: `${sh},${sh},${sh + 8}` }); }
    this.sparks(x, y, 14 + r * 0.1, { min: 300, max: 900, g: 700 });
    S.shake = Math.min(30, S.shake + r * 0.1); S.punch += r * 0.0003;
    if (!o.quiet) AU.boom(r);
  },
  update(dt) {
    for (const p of this.parts) {
      p.life -= dt; const d = Math.pow(p.dr, dt);
      p.vx *= d; p.vy *= d; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.floor != null && p.y > p.floor) { p.y = p.floor; p.vy *= -0.35; p.vx *= 0.6; p.vr *= 0.5; }
    }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const r of this.rings) r.life -= dt; this.rings = this.rings.filter(r => r.life > 0);
    for (const f of this.flashes) f.life -= dt; this.flashes = this.flashes.filter(f => f.life > 0);
    for (const x of this.texts) { x.life -= dt; x.y += x.vy * dt; x.vy *= Math.pow(0.1, dt); }
    this.texts = this.texts.filter(x => x.life > 0);
  },
  draw() {
    for (const p of this.parts) {
      const k = p.life / p.max;
      if (p.type === 'smoke') { ctx.globalAlpha = k * 0.45 * (p.a ?? 1); ctx.fillStyle = `rgb(${p.col})`; circle(p.x, p.y, p.s * (1.7 - k)); ctx.fill(); }
      else if (p.type === 'shard') {
        ctx.globalAlpha = Math.min(1, k * 3); ctx.fillStyle = p.col;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.7); ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      const k = p.life / p.max;
      if (p.type === 'fire') {
        const c = k > 0.75 ? '255,250,210' : k > 0.5 ? '255,190,60' : k > 0.25 ? '255,90,30' : '140,40,20';
        ctx.fillStyle = `rgba(${c},${k * 0.85})`; circle(p.x, p.y, p.s * (0.35 + 0.65 * k)); ctx.fill();
      } else if (p.type === 'spark') {
        ctx.globalAlpha = k; ctx.strokeStyle = p.col; ctx.lineWidth = p.s;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); ctx.stroke();
      } else if (p.type === 'glow') {
        ctx.globalAlpha = k; ctx.fillStyle = p.col; circle(p.x, p.y, p.s * (0.4 + 0.6 * k)); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (const f of this.flashes) {
      const k = f.life / f.max, g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      g.addColorStop(0, `rgba(${f.col},${k})`); g.addColorStop(0.35, `rgba(${f.col},${k * 0.4})`); g.addColorStop(1, `rgba(${f.col},0)`);
      ctx.fillStyle = g; circle(f.x, f.y, f.r); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const r of this.rings) {
      const k = r.life / r.max, e = 1 - Math.pow(k, 3);
      ctx.globalAlpha = k; ctx.strokeStyle = r.col; ctx.lineWidth = r.w * k + 0.5;
      circle(r.x, r.y, r.R * e); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'middle';
    for (const x of this.texts) {
      const age = x.max - x.life, s = easeOutElastic(Math.min(1, age / 0.5)), a = Math.min(1, x.life / 0.3);
      ctx.save(); ctx.translate(x.x, x.y); ctx.scale(s, s); ctx.rotate(Math.sin(age * 10) * 0.05 * (1 - Math.min(1, age)));
      ctx.globalAlpha = a; outlined(x.txt, 0, 0, x.size, x.col, 'center');
      ctx.restore();
    }
    ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
  },
};

// ---------------- 오디오 (파일 없이 합성) ----------------
const AU = {
  ac: null, master: null, nb: null, lastBoom: 0,
  init() {
    if (this.ac) { if (this.ac.state === 'suspended' && !Arcade.paused) this.ac.resume(); return; }
    try {
      this.ac = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ac.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ac.destination);
      this.nb = this.ac.createBuffer(1, this.ac.sampleRate * 2, this.ac.sampleRate);
      const d = this.nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ac = null; }
  },
  now() { return this.ac ? this.ac.currentTime : performance.now() / 1000; },
  tone(f0, f1, dur, type = 'sine', vol = 0.2, when = 0, dest = null, cut = 0) {
    if (!this.ac) return; const t0 = Math.max(when || 0, this.ac.currentTime);
    const o = this.ac.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    const g = this.ac.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    let node = o;
    if (cut) { const f = this.ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(cut, t0); f.frequency.exponentialRampToValueAtTime(Math.max(80, cut * 0.25), t0 + dur); o.connect(f); node = f; }
    node.connect(g); g.connect(dest || this.master); o.start(t0); o.stop(t0 + dur + 0.02);
  },
  noise(dur, f0, f1, vol = 0.3, when = 0, dest = null, ft = 'lowpass') {
    if (!this.ac) return; const t0 = Math.max(when || 0, this.ac.currentTime);
    const s = this.ac.createBufferSource(); s.buffer = this.nb;
    const f = this.ac.createBiquadFilter(); f.type = ft;
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = this.ac.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.master); s.start(t0, Math.random()); s.stop(t0 + dur + 0.02);
  },
  boom(r) {
    if (!this.ac || this.ac.currentTime - this.lastBoom < 0.035) return; this.lastBoom = this.ac.currentTime;
    const k = clamp(r / 150, 0.25, 1.4);
    this.noise(0.3 + k * 0.8, 2500, 60, 0.4 + k * 0.3); this.tone(140, 30, 0.3 + k * 0.5, 'sine', 0.5 + k * 0.3);
  },
  click() { this.tone(700, 950, 0.06, 'square', 0.06); },
};

// ---------------- 아케이드 (장면 관리) ----------------
const Arcade = {
  scenes: {}, scene: null, trans: null, paused: false, over: null, btns: {},
  mouse: { x: -999, y: -999, down: false },
  register(s) { this.scenes[s.id] = s; },
  go(id, o = {}) {
    if (this.trans || !this.scenes[id]) return;
    this.trans = { to: id, t: 0, x: o.x ?? W / 2, y: o.y ?? H / 2, col: o.col || '#ff4fd8', switched: false };
    AU.noise(0.5, 400, 6000, 0.12, 0, null, 'bandpass'); AU.tone(200, 900, 0.4, 'sine', 0.06);
  },
  _switch(id) {
    const old = this.scene; if (old && old.exit) old.exit();
    FX.reset(); Object.assign(S, { shake: 0, punch: 0, hitstop: 0, slowT: 0, timeScale: 1, flash: 0, red: 0 });
    this.over = null; this.paused = false;
    if (AU.ac && AU.ac.state === 'suspended') AU.ac.resume();
    this.scene = this.scenes[id]; if (this.scene.enter) this.scene.enter();
  },
  best(id) { try { return +localStorage.getItem('arcade_best_' + id) || 0; } catch (e) { return 0; } },
  saveBest(id, v) { if (v > this.best(id)) { try { localStorage.setItem('arcade_best_' + id, v); } catch (e) { } return true; } return false; },
  gameOver(score, lines = []) {
    if (this.over) return;
    if (this.paused) { this.paused = false; if (this.scene.onPause) this.scene.onPause(false); }
    this.over = { score, lines, t: 0, isNew: score > 0 && this.saveBest(this.scene.id, score) };
    AU.tone(440, 110, 0.9, 'sawtooth', 0.12, 0, null, 2000);
  },
  setPause(p) {
    if (!this.scene || this.scene.id === 'hub' || this.over || this.trans || this.paused === p) return;
    this.paused = p; if (this.scene.onPause) this.scene.onPause(p);
  },
  pushCam(cx = W / 2, cy = H / 2, z = 1) {
    const sx = (Math.random() - 0.5) * S.shake * 2, sy = (Math.random() - 0.5) * S.shake * 2;
    const zz = z * (1 + Math.min(0.08, S.punch));
    ctx.save(); ctx.translate(cx, cy); ctx.scale(zz, zz); ctx.translate(-cx + sx, -cy + sy);
  },
  popCam() { ctx.restore(); },
  start(id) { resize(); this._switch(id); requestAnimationFrame(frame); },
};
const M = Arcade.mouse;

function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  if (Arcade.scene && Arcade.scene.onResize) Arcade.scene.onResize();
}
addEventListener('resize', resize);

// ---------------- 공용 UI ----------------
function button(key, txt, cx, cy, w, h, col) {
  const r = { x: cx - w / 2, y: cy - h / 2, w, h }; Arcade.btns[key] = r;
  const hov = inRect(M.x, M.y, r), s = hov ? 1.08 : 1;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.shadowColor = col; ctx.shadowBlur = hov ? 30 : 12;
  ctx.fillStyle = col; rr(-w / 2, -h / 2, w, h, h / 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,.25)'; rr(-w / 2 + 6, -h / 2 + 4, w - 12, h * 0.35, h * 0.2); ctx.fill();
  ctx.textBaseline = 'middle'; outlined(txt, 0, 2, Math.min(24, h * 0.45), '#fff', 'center', 4); ctx.textBaseline = 'alphabetic';
  ctx.restore();
}
function drawCornerBtns() {
  for (const [x, k] of [[36, 'back'], [92, 'pause']]) {
    const hov = Math.hypot(M.x - x, M.y - 36) < 24;
    ctx.save(); ctx.translate(x, 36); const s = hov ? 1.12 : 1; ctx.scale(s, s);
    ctx.fillStyle = hov ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.45)'; circle(0, 0, 22); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    if (k === 'back') { ctx.moveTo(8, 0); ctx.lineTo(-8, 0); ctx.moveTo(-1, -7); ctx.lineTo(-8, 0); ctx.lineTo(-1, 7); }
    else { ctx.moveTo(-5, -8); ctx.lineTo(-5, 8); ctx.moveTo(5, -8); ctx.lineTo(5, 8); }
    ctx.stroke(); ctx.lineCap = 'butt'; ctx.restore();
  }
}
function drawPause() {
  ctx.fillStyle = 'rgba(5,3,20,.65)'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, H * 0.38); const s = 1 + Math.sin(T * 3) * 0.04; ctx.scale(s, s);
  outlined('PAUSED', 0, 0, Math.min(90, W * 0.13), '#fff', 'center', 9); ctx.restore();
  button('resume', '계속하기', W / 2, H * 0.55, 220, 56, '#3a9dff');
  button('pmenu', '메뉴로', W / 2, H * 0.55 + 72, 220, 56, '#8a4fff');
}
function drawOver() {
  const o = Arcade.over, k = clamp((o.t - 0.5) / 0.6, 0, 1);
  if (k <= 0) return;
  ctx.fillStyle = `rgba(5,3,20,${k * 0.72})`; ctx.fillRect(0, 0, W, H);
  const baseY = H * 0.3, y = lerp(-250, baseY, easeOutBack(k));
  ctx.save(); ctx.translate(W / 2, y); ctx.rotate(Math.sin(T * 2) * 0.015);
  outlined('GAME OVER', 0, 0, Math.min(92, W * 0.13), '#ff4f6b', 'center', 10);
  const cnt = Math.round(o.score * easeOutCubic(clamp((o.t - 0.9) / 1, 0, 1)));
  outlined(cnt.toLocaleString(), 0, 72, Math.min(64, W * 0.1), '#fff', 'center', 8);
  if (o.isNew && o.t > 1.9) {
    ctx.save(); ctx.translate(0, 112); ctx.rotate(-0.05); const p = 1 + Math.sin(T * 8) * 0.08; ctx.scale(p, p);
    outlined('★ 신기록! ★', 0, 0, 28, '#ffd23a', 'center', 5); ctx.restore();
  } else outlined('BEST ' + Arcade.best(Arcade.scene.id).toLocaleString(), 0, 112, 20, '#ffd86a', 'center', 4);
  o.lines.forEach((l, i) => outlined(l, 0, 150 + i * 28, Math.min(20, W * 0.04), 'rgba(255,255,255,.88)', 'center', 4));
  ctx.restore();
  if (o.t > 1.2) {
    const by = Math.min(H - 44, baseY + 190 + o.lines.length * 28), bw = Math.min(200, W * 0.4);
    button('retry', '다시하기', W / 2 - bw / 2 - 10, by, bw, 54, '#ff5a3a');
    button('menu', '메뉴로', W / 2 + bw / 2 + 10, by, bw, 54, '#8a4fff');
  }
}
function drawTrans() {
  const tr = Arcade.trans; if (!tr) return;
  const maxR = Math.hypot(W, H);
  ctx.fillStyle = '#0b0620';
  if (tr.t < 0.42) {
    const k = easeInOutCubic(tr.t / 0.42), r = k * maxR * 1.1;
    circle(tr.x, tr.y, r); ctx.fill();
    ctx.strokeStyle = tr.col; ctx.lineWidth = 10; ctx.shadowColor = tr.col; ctx.shadowBlur = 30; circle(tr.x, tr.y, r); ctx.stroke(); ctx.shadowBlur = 0;
  } else {
    const k = easeInOutCubic(clamp((tr.t - 0.42) / 0.48, 0, 1)), r = k * maxR * 0.6;
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(W / 2, H / 2, Math.max(0.1, r), 0, TAU); ctx.fill('evenodd');
    ctx.strokeStyle = tr.col; ctx.lineWidth = 10 * (1 - k) + 1; ctx.shadowColor = tr.col; ctx.shadowBlur = 30; circle(W / 2, H / 2, r); ctx.stroke(); ctx.shadowBlur = 0;
  }
  const a = clamp(1 - Math.abs(tr.t - 0.45) / 0.22, 0, 1);
  if (a > 0) {
    ctx.globalAlpha = a; ctx.textBaseline = 'middle';
    const sc = Arcade.scenes[tr.to];
    outlined(sc.title || '', W / 2, H / 2, Math.min(64, W * 0.1), tr.col, 'center', 8);
    ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
  }
}
function post() {
  const sc = Arcade.scene;
  if (S.flash > 0.01) { ctx.fillStyle = `rgba(255,245,225,${Math.min(0.8, S.flash) * 0.6})`; ctx.fillRect(0, 0, W, H); }
  if (!sc.noVignette || S.red > 0.02) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, S.red > 0.02 ? `rgba(220,0,30,${0.25 + S.red * 0.6})` : 'rgba(0,0,15,.5)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (sc.id !== 'hub' && !Arcade.over) drawCornerBtns();
  Arcade.btns = {};
  if (Arcade.paused) drawPause();
  if (Arcade.over) drawOver();
  drawTrans();
}

// ---------------- 루프 ----------------
let last = performance.now();
function frame(now) {
  const rdt = Math.min(0.033, Math.max(0, (now - last) / 1000)); last = now; T += rdt;
  const A = Arcade;
  if (A.trans) {
    A.trans.t += rdt;
    if (!A.trans.switched && A.trans.t >= 0.42) { A.trans.switched = true; A._switch(A.trans.to); }
    if (A.trans.t >= 0.9) A.trans = null;
  }
  if (!A.paused) {
    S.shake *= Math.pow(0.004, rdt); S.punch *= Math.pow(0.001, rdt); S.flash *= Math.pow(0.0005, rdt); S.red *= Math.pow(0.02, rdt);
    if (S.slowT > 0) { S.slowT -= rdt; S.timeScale = damp(S.timeScale, 0.25, 14, rdt); } else S.timeScale = damp(S.timeScale, 1, 5, rdt);
    let dt = rdt * S.timeScale;
    if (S.hitstop > 0) { S.hitstop -= rdt; dt = 0; }
    if (A.over) A.over.t += rdt;
    A.scene.update(dt, rdt);
    FX.update(dt);
  }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  A.scene.render();
  post();
  requestAnimationFrame(frame);
}

// ---------------- 입력 ----------------
function evPos(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
cv.addEventListener('pointerdown', e => {
  AU.init();
  const [x, y] = evPos(e); M.x = x; M.y = y; M.down = true;
  try { cv.setPointerCapture(e.pointerId); } catch (_) { }
  const A = Arcade, sc = A.scene; if (A.trans) return;
  // 버튼 영역은 직전 프레임에 그린 위치를 다시 계산
  if (A.over) {
    if (A.over.t > 1.2) {
      const bw = Math.min(200, W * 0.4), by = Math.min(H - 44, H * 0.3 + 190 + A.over.lines.length * 28);
      if (inRect(x, y, { x: W / 2 - bw - 10, y: by - 27, w: bw, h: 54 })) A.go(sc.id, { x, y, col: '#ff5a3a' });
      else if (inRect(x, y, { x: W / 2 + 10, y: by - 27, w: bw, h: 54 })) A.go('hub', { x, y, col: '#8a4fff' });
    }
    return;
  }
  if (A.paused) {
    if (inRect(x, y, { x: W / 2 - 110, y: H * 0.55 - 28, w: 220, h: 56 })) { A.setPause(false); AU.click(); }
    else if (inRect(x, y, { x: W / 2 - 110, y: H * 0.55 + 44, w: 220, h: 56 })) A.go('hub', { x, y, col: '#8a4fff' });
    return;
  }
  if (sc.id !== 'hub') {
    if (Math.hypot(x - 36, y - 36) < 26) { A.go('hub', { x: 36, y: 36, col: '#8a4fff' }); return; }
    if (Math.hypot(x - 92, y - 36) < 26) { A.setPause(true); AU.click(); return; }
  }
  if (sc.onDown) sc.onDown(x, y, e);
});
cv.addEventListener('pointermove', e => { const [x, y] = evPos(e); M.x = x; M.y = y; const sc = Arcade.scene; if (sc && sc.onMove && !Arcade.paused && !Arcade.over) sc.onMove(x, y, e); });
addEventListener('pointerup', e => { M.down = false; const [x, y] = evPos(e); const sc = Arcade.scene; if (sc && sc.onUp) sc.onUp(x, y, e); });
addEventListener('pointercancel', e => { M.down = false; const sc = Arcade.scene; if (sc && sc.onUp) sc.onUp(-1, -1, e); });
cv.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => {
  AU.init();
  const A = Arcade, sc = A.scene;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (!sc || A.trans) return;
  if (e.code === 'Escape') { if (sc.id !== 'hub') A.go('hub', { col: '#8a4fff' }); return; }
  if (A.over) { if ((e.code === 'Enter' || e.code === 'Space') && A.over.t > 1.2) A.go(sc.id, { col: '#ff5a3a' }); return; }
  if (e.code === 'KeyP') { A.setPause(!A.paused); return; }
  if (A.paused) { if (e.code === 'Enter' || e.code === 'Space') A.setPause(false); return; }
  if (sc.onKey) sc.onKey(e.code, true, e);
});
addEventListener('keyup', e => { const sc = Arcade.scene; if (sc && sc.onKey) sc.onKey(e.code, false, e); });
document.addEventListener('visibilitychange', () => { if (document.hidden) Arcade.setPause(true); });
