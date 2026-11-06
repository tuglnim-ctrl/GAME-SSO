"use strict";
// =====================================================================
//  게임 1: 블록 깨기
// =====================================================================
(() => {
  const PATS = [
    ['1111111111', '1111111111', '2222222222', '2222222222', '3333333333'],
    ['....33....', '...3223...', '..321123..', '.32111123.', '..321123..', '...3223...', '....33....'],
    ['3.3.3.3.3.', '.2.2.2.2.2', '1111111111', '2.2.2.2.2.', '.3.3.3.3.3', '1111111111'],
    ['..1....1..', '...1..1...', '..222222..', '.22.22.22.', '3333333333', '3.333333.3', '3.3....3.3', '...22.22..'],
    ['.333..333.', '3222332223', '3211111123', '.32111123.', '..321123..', '...3223...', '....33....'],
  ];
  const ITEMS = [
    { k: 'multi', col: '#3ad0ff', ic: 'M', name: '멀티볼!', w: 3 },
    { k: 'wide', col: '#7cff6b', ic: 'W', name: '와이드 패들!', w: 3 },
    { k: 'laser', col: '#ff4f6b', ic: 'L', name: '레이저!', w: 2 },
    { k: 'fire', col: '#ff9a2a', ic: 'F', name: '불덩이 공!', w: 2 },
    { k: 'life', col: '#ff6bd0', ic: '♥', name: '생명 +1', w: 1 },
  ];
  let fx0, fw, top, bw, bh, padY;
  let bricks, balls, items, beams, pad, stage, lives, score, shownScore, scoreBump, combo, comboBump, maxCombo, broken;
  let state, stateT, bannerT, bannerTxt, wall, bokeh = [], keyL, keyR, useKeys, fwT, heartPop;

  const k = () => clamp(H / 800, 0.75, 1.25);
  const maxSpd = () => 900 * k();
  function geom() {
    fw = Math.min(W - 24, 820); fx0 = (W - fw) / 2; top = 84;
    bw = fw / 10; bh = clamp(bw * 0.42, 16, 30); padY = H - 56;
  }
  function rect(b) { return { x: fx0 + b.c * bw, y: top + 34 + b.r * bh, w: bw, h: bh }; }
  function addScore(v) { score += v; scoreBump = 1; }

  function newBall() {
    balls = [{ x: pad.x, y: padY - 20, vx: 0, vy: 0, r: 8, stuck: true, off: rand(-18, 18), trail: [], sq: 0, spd: 470 * k() * (1 + Math.min(0.4, (stage - 1) * 0.05)) }];
  }
  function loadStage(n) {
    stage = n; geom();
    const p = PATS[(n - 1) % PATS.length], loop = Math.floor((n - 1) / PATS.length);
    bricks = [];
    p.forEach((row, r) => {
      for (let c = 0; c < 10; c++) {
        const ch = row[c]; if (ch === '.') continue;
        const hp = Math.min(3, +ch + loop);
        bricks.push({ c, r, hp, max: hp, hue: (r * 30 + n * 57) % 360, hit: 0, age: 0, delay: (r * 10 + c) * 0.022 + rand(0, 0.05), alive: true });
      }
    });
    items = []; beams = []; pad.wide = 0; pad.laser = 0; pad.fire = 0;
    newBall(); state = 'ready'; stateT = 0; bannerT = 0; bannerTxt = 'STAGE ' + n;
    AU.tone(300, 600, 0.3, 'square', 0.06);
  }
  function launch() {
    for (const b of balls) if (b.stuck) {
      b.stuck = false; const a = rand(-0.45, 0.45);
      b.vx = Math.sin(a) * b.spd; b.vy = -Math.cos(a) * b.spd;
      FX.sparks(b.x, b.y, 10, { dir: -Math.PI / 2, spread: 0.7, col: '#bff' });
    }
    state = 'play'; AU.tone(500, 900, 0.12, 'triangle', 0.12);
  }
  function fixAngle(b) {
    const sp = Math.hypot(b.vx, b.vy) || b.spd;
    if (Math.abs(b.vy) < sp * 0.3) { b.vy = Math.sign(b.vy || -1) * sp * 0.3; b.vx = Math.sign(b.vx || 1) * Math.sqrt(sp * sp - b.vy * b.vy); }
  }
  function wallHit(side, b) {
    wall[side] = 1; fixAngle(b); b.sq = 1;
    FX.sparks(b.x, b.y, 5, { min: 80, max: 300, col: '#9ef', g: 0 });
    AU.tone(180, 140, 0.05, 'square', 0.04);
  }
  function damage(kb, d, b) {
    if (!kb.alive) return;
    kb.hp -= d; kb.hit = 1;
    combo++; comboBump = 1; maxCombo = Math.max(maxCombo, combo);
    const R = rect(kb), cx = R.x + R.w / 2, cy = R.y + R.h / 2;
    const f = 330 * Math.pow(2, Math.min(combo, 24) / 12);
    AU.tone(f, f * 1.02, 0.12, 'square', 0.06);
    if (kb.hp <= 0) {
      kb.alive = false; broken++;
      const pts = Math.round(50 * (1 + combo * 0.1)); addScore(pts);
      FX.text(cx, cy, '+' + pts, combo >= 10 ? '#ffd23a' : '#fff', 18 + Math.min(14, combo), 0.7);
      FX.shards(cx, cy, 10, [hsl(kb.hue, 85, 60), hsl(kb.hue, 85, 75), '#ffffff'], { w: R.w, h: R.h, min: 80, max: 380, up: 150, floor: H + 50 });
      FX.glow(cx, cy, 8, hsl(kb.hue, 100, 70), { max: 260 });
      FX.ring(cx, cy, bw * 0.7, 0.3, 3, hsl(kb.hue, 100, 80));
      S.shake = Math.min(30, S.shake + 2.5); S.hitstop = Math.max(S.hitstop, 0.012);
      if (Math.random() < 0.14) dropItem(cx, cy);
      if (combo > 0 && combo % 10 === 0) { FX.text(W / 2, H * 0.55, combo + ' COMBO!', '#ffd23a', 56, 1.2); S.punch += 0.03; AU.tone(600, 1800, 0.35, 'square', 0.08); }
    } else {
      addScore(10);
      FX.sparks(cx, cy, 6, { min: 60, max: 260, col: hsl(kb.hue, 100, 80), g: 300 });
      S.shake = Math.min(30, S.shake + 1);
    }
  }
  function dropItem(x, y) {
    const tot = ITEMS.reduce((a, i) => a + i.w, 0); let r = Math.random() * tot, it = ITEMS[0];
    for (const i of ITEMS) { if ((r -= i.w) < 0) { it = i; break; } }
    items.push({ x, y, vy: 60, it, t: 0 });
  }
  function applyItem(it) {
    FX.text(pad.x, padY - 40, it.name, it.col, 26, 1);
    FX.ring(pad.x, padY, pad.w, 0.4, 5, it.col); FX.glow(pad.x, padY, 20, it.col, { max: 300 });
    AU.tone(500, 1400, 0.15, 'square', 0.08); AU.tone(800, 2000, 0.2, 'sine', 0.1);
    if (it.k === 'multi') {
      if (balls.some(b => b.stuck)) launch();
      const add = [];
      for (const b of balls) {
        if (balls.length + add.length >= 12) break;
        for (const da of [-0.45, 0.45]) {
          const a = Math.atan2(b.vy, b.vx) + da, sp = Math.hypot(b.vx, b.vy);
          add.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: b.r, stuck: false, trail: [], sq: 0, spd: b.spd });
        }
      }
      add.forEach(fixAngle); balls.push(...add);
    } else if (it.k === 'wide') pad.wide = 14;
    else if (it.k === 'laser') pad.laser = 10;
    else if (it.k === 'fire') pad.fire = 8;
    else if (it.k === 'life') { lives = Math.min(5, lives + 1); heartPop[lives - 1] = 1; }
  }
  function loseLife() {
    lives--; heartPop[lives] = -0.01;
    S.shake = Math.min(30, S.shake + 14); S.red = 0.7; combo = 0;
    FX.text(W / 2, H * 0.5, 'MISS!', '#ff4f6b', 60, 1);
    AU.tone(300, 60, 0.5, 'sawtooth', 0.15);
    if (lives <= 0) {
      state = 'dead'; S.slowT = 1;
      FX.explode(pad.x, padY, 90);
      Arcade.gameOver(score, [`스테이지 ${stage}  ·  부순 블록 ${broken}`, `최고 콤보 ${maxCombo}`]);
    } else { pad.wide = 0; pad.laser = 0; pad.fire = 0; items = []; newBall(); state = 'ready'; stateT = 0; }
  }
  function clearStage() {
    state = 'clear'; stateT = 0; bannerT = 0; bannerTxt = 'STAGE CLEAR!'; fwT = 0;
    const bonus = 1000 * stage + lives * 200; addScore(bonus);
    FX.text(W / 2, H * 0.58, `+${bonus} 보너스`, '#7dff9a', 34, 1.8);
    for (const b of balls) { FX.glow(b.x, b.y, 16, '#bff', { max: 300 }); FX.ring(b.x, b.y, 60, 0.4, 4); }
    balls = []; items = []; beams = [];
    S.slowT = 0.6; AU.tone(523, 1046, 0.5, 'square', 0.08); AU.tone(659, 1318, 0.6, 'square', 0.06, AU.now() + 0.12);
  }

  function updateBall(b, dt) {
    if (b.stuck) { b.x = pad.x + b.off; b.y = padY - pad.h / 2 - b.r - 1; b.trail = []; return; }
    const sp = Math.hypot(b.vx, b.vy), steps = Math.max(1, Math.ceil(sp * dt / (b.r * 0.7))), h = dt / steps;
    const fire = pad.fire > 0;
    for (let s = 0; s < steps; s++) {
      b.x += b.vx * h; b.y += b.vy * h;
      if (b.x < fx0 + b.r) { b.x = fx0 + b.r; b.vx = Math.abs(b.vx); wallHit('L', b); }
      if (b.x > fx0 + fw - b.r) { b.x = fx0 + fw - b.r; b.vx = -Math.abs(b.vx); wallHit('R', b); }
      if (b.y < top + b.r) { b.y = top + b.r; b.vy = Math.abs(b.vy); wallHit('T', b); }
      const pt = padY - pad.h / 2;
      if (b.vy > 0 && b.y + b.r >= pt && b.y - b.r < padY + pad.h / 2 && b.x > pad.x - pad.w / 2 - b.r && b.x < pad.x + pad.w / 2 + b.r) {
        const off = clamp((b.x - pad.x) / (pad.w / 2), -1, 1), a = off * 1.05;
        b.spd = Math.min(b.spd * 1.02, maxSpd());
        b.vx = Math.sin(a) * b.spd; b.vy = -Math.cos(a) * b.spd; b.y = pt - b.r;
        pad.sqv -= 7; b.sq = 1;
        if (combo >= 5) FX.text(pad.x, padY - 50, combo + ' HIT', '#9ef', 22, 0.6);
        combo = 0;
        S.shake = Math.min(30, S.shake + 2);
        FX.sparks(b.x, pt, 8, { dir: -Math.PI / 2, spread: 1, col: '#7df', g: 300 }); FX.ring(b.x, pt, 32, 0.25, 3, '#9ef');
        AU.tone(220, 330, 0.08, 'triangle', 0.15);
      }
      for (const kb of bricks) {
        if (!kb.alive || kb.age - kb.delay < 0.4) continue;
        const R = rect(kb), cx = clamp(b.x, R.x, R.x + R.w), cy = clamp(b.y, R.y, R.y + R.h), dx = b.x - cx, dy = b.y - cy;
        if (dx * dx + dy * dy < b.r * b.r) {
          if (fire) { damage(kb, 99, b); continue; }
          if (dx === 0 && dy === 0) b.vy = -b.vy;
          else if (Math.abs(dx) > Math.abs(dy)) { b.vx = Math.sign(dx) * Math.abs(b.vx); b.x = cx + Math.sign(dx) * b.r; }
          else { b.vy = Math.sign(dy) * Math.abs(b.vy); b.y = cy + Math.sign(dy) * b.r; }
          b.sq = 1; damage(kb, 1, b); fixAngle(b); break;
        }
      }
      if (b.y > H + 30) { b.dead = true; FX.sparks(b.x, H, 12, { dir: -Math.PI / 2, col: '#f66' }); break; }
    }
    b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 14) b.trail.shift();
    if (fire) FX.add({ type: 'fire', x: b.x, y: b.y, vx: rand(-40, 40), vy: rand(-40, 40), life: 0.3, s: 12, dr: 0.1, g: -100 });
  }

  // ---------- 그리기 ----------
  function heart(x, y, s) {
    ctx.beginPath(); ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x - s, y - s * 0.4, x - s * 0.5, y - s, x, y - s * 0.45);
    ctx.bezierCurveTo(x + s * 0.5, y - s, x + s, y - s * 0.4, x, y + s * 0.35); ctx.closePath();
  }
  function drawBrick(kb) {
    const R = rect(kb), ap = clamp((kb.age - kb.delay) / 0.4, 0, 1); if (ap <= 0) return;
    const e = easeOutBack(ap), cx = R.x + R.w / 2, cy = R.y + R.h / 2;
    ctx.save(); ctx.globalAlpha = ap; ctx.translate(cx, cy - (1 - e) * 70);
    ctx.scale(e * (1 + kb.hit * 0.15), e * (1 - kb.hit * 0.12));
    const w = R.w - 4, h = R.h - 4, light = 62 - (kb.max - 1) * 7;
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, kb.hit > 0.5 ? '#fff' : hsl(kb.hue, 90, light + 14)); g.addColorStop(1, hsl(kb.hue, 85, light - 14));
    ctx.fillStyle = g; rr(-w / 2, -h / 2, w, h, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; rr(-w / 2 + 3, -h / 2 + 2, w - 6, h * 0.28, 3); ctx.fill();
    if (kb.max >= 2) { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; rr(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 3); ctx.stroke(); }
    if (kb.max >= 3) { ctx.fillStyle = 'rgba(255,255,255,.8)'; for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { circle(sx * (w / 2 - 6), sy * (h / 2 - 5), 1.8); ctx.fill(); } }
    if (kb.hp < kb.max) {
      ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1.6; ctx.beginPath();
      const sd = kb.c * 7 + kb.r * 13;
      ctx.moveTo(-w * 0.1, -h / 2); ctx.lineTo(((sd % 5) - 2) * 3, 0); ctx.lineTo(w * 0.15, h / 2);
      if (kb.max - kb.hp >= 2) { ctx.moveTo(-w / 2, -h * 0.1); ctx.lineTo(-w * 0.2, h * 0.15); ctx.lineTo(((sd % 5) - 2) * 3, 0); ctx.lineTo(w / 2, -h * 0.2); }
      ctx.stroke();
    }
    // 반짝이는 광택 띠
    const sheen = (T * 420) % (fw + 600) - 300, d = (R.x - fx0) - sheen - (R.y - top) * 0.6;
    if (Math.abs(d) < 40) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - Math.abs(d) / 40)})`; rr(-w / 2, -h / 2, w, h, 5); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    ctx.restore();
  }
  function drawPaddle() {
    const sx = 1 - pad.sq * 0.35, sy = 1 + pad.sq * 0.7;
    ctx.save(); ctx.translate(pad.x, padY); ctx.scale(sx, sy);
    const w = pad.w, h = pad.h, col = pad.fire > 0 ? '#ff9a2a' : '#3ad0ff';
    ctx.globalCompositeOperation = 'lighter';
    const gg = ctx.createRadialGradient(0, 0, 4, 0, 0, w * 0.7); gg.addColorStop(0, rgba(col, 0.35)); gg.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = gg; ctx.fillRect(-w, -w * 0.4, w * 2, w * 0.8);
    ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#e8fbff'); g.addColorStop(0.4, col); g.addColorStop(1, '#0a3a5a');
    ctx.fillStyle = g; rr(-w / 2, -h / 2, w, h, h / 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.6)'; rr(-w / 2 + 8, -h / 2 + 2, w - 16, 3, 1.5); ctx.fill();
    for (let i = -2; i <= 2; i++) { ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.4 * Math.sin(T * 10 + i)})`; circle(i * w * 0.12, 3, 1.8); ctx.fill(); }
    if (pad.laser > 0) { ctx.fillStyle = '#ff4f6b'; for (const s of [-1, 1]) { rr(s * (w / 2 - 8) - 4, -h / 2 - 8, 8, 12, 2); ctx.fill(); } }
    ctx.restore();
  }
  function drawBall(b) {
    const sp = Math.hypot(b.vx, b.vy), fire = pad.fire > 0, col = fire ? '255,150,40' : '150,230,255';
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < b.trail.length; i++) {
      const q = b.trail[i], a = i / b.trail.length;
      ctx.fillStyle = `rgba(${col},${a * 0.4})`; circle(q.x, q.y, b.r * a); ctx.fill();
    }
    const gg = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, b.r * 3.5); gg.addColorStop(0, `rgba(${col},.6)`); gg.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = gg; circle(b.x, b.y, b.r * 3.5); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    const st = Math.min(1, sp / 900);
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
    ctx.scale(1 + st * 0.3 - b.sq * 0.3, 1 - st * 0.15 + b.sq * 0.25);
    ctx.fillStyle = fire ? '#fff3c0' : '#ffffff'; circle(0, 0, b.r); ctx.fill();
    ctx.restore();
  }
  function drawItem(o) {
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(Math.sin(o.t * 6) * 0.25);
    const s = 1 + Math.sin(o.t * 10) * 0.06; ctx.scale(s, s);
    ctx.shadowColor = o.it.col; ctx.shadowBlur = 18;
    ctx.fillStyle = o.it.col; rr(-20, -10, 40, 20, 10); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.45)'; rr(-16, -8, 32, 6, 3); ctx.fill();
    ctx.textBaseline = 'middle'; outlined(o.it.ic, 0, 1, 15, '#fff', 'center', 3); ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }
  function drawBG() {
    const hue = (stage * 57) % 360;
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, hsl(hue + 220, 55, 11)); g.addColorStop(1, hsl(hue + 260, 60, 5));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const b of bokeh) {
      const x = ((b.x * W + T * b.vx) % (W + 200) + W + 200) % (W + 200) - 100, y = b.y * H + Math.sin(T * b.f + b.p) * 30;
      const gg = ctx.createRadialGradient(x, y, 0, x, y, b.r); gg.addColorStop(0, hsl(hue + b.h, 90, 60, 0.18)); gg.addColorStop(1, hsl(hue + b.h, 90, 60, 0));
      ctx.fillStyle = gg; circle(x, y, b.r); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // 필드 격자
    ctx.strokeStyle = 'rgba(120,180,255,.06)'; ctx.lineWidth = 1; ctx.beginPath();
    const off = (T * 20) % 40;
    for (let x = fx0; x <= fx0 + fw; x += 40) { ctx.moveTo(x, top); ctx.lineTo(x, H); }
    for (let y = top + off; y <= H; y += 40) { ctx.moveTo(fx0, y); ctx.lineTo(fx0 + fw, y); }
    ctx.stroke();
  }
  function drawWalls() {
    const seg = (x1, y1, x2, y2, a) => {
      ctx.strokeStyle = `rgba(120,220,255,${0.35 + a * 0.65})`; ctx.lineWidth = 3 + a * 4;
      ctx.shadowColor = '#3ad0ff'; ctx.shadowBlur = 10 + a * 30;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    };
    seg(fx0, H, fx0, top, wall.L); seg(fx0 + fw, H, fx0 + fw, top, wall.R); seg(fx0, top, fx0 + fw, top, wall.T);
    ctx.shadowBlur = 0;
  }
  function drawHUD() {
    ctx.save(); ctx.translate(130, 46); const s = 1 + scoreBump * 0.2; ctx.scale(s, s);
    outlined(Math.round(shownScore).toLocaleString(), 0, 0, 30, '#fff'); ctx.restore();
    outlined('SCORE', 130, 62, 12, '#9ef', 'left', 3);
    outlined('STAGE ' + stage, W / 2, 46, 24, '#fff', 'center', 4);
    for (let i = 0; i < Math.max(lives, 0) + (heartPop.some(v => v < 0) ? 1 : 0) && i < 5; i++) {
      const pop = heartPop[i], x = W - 30 - i * 32, y = 40;
      ctx.save(); ctx.translate(x, y);
      if (pop < 0) { ctx.globalAlpha = 1 + pop; ctx.rotate(-pop * 0.8); ctx.translate(0, pop * 30); }
      const sc = 1 + Math.max(0, pop) * 0.6 + Math.sin(T * 4 + i) * 0.05; ctx.scale(sc, sc);
      ctx.fillStyle = '#ff4f8b'; ctx.shadowColor = '#ff4f8b'; ctx.shadowBlur = 12; heart(0, 0, 13); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,.5)'; circle(-5, -5, 3); ctx.fill();
      ctx.restore();
    }
    if (combo >= 3) {
      ctx.save(); ctx.translate(W - 30, 92); const s2 = 1 + comboBump * 0.35; ctx.scale(s2, s2); ctx.rotate(-0.06);
      outlined('x' + combo, 0, 0, 30, combo >= 10 ? '#ffd23a' : '#fff', 'right'); ctx.restore();
    }
    // 아이템 타이머
    let yy = H - 24;
    for (const [v, max, name, col] of [[pad.wide, 14, '와이드', '#7cff6b'], [pad.laser, 10, '레이저', '#ff4f6b'], [pad.fire, 8, '불덩이', '#ff9a2a']]) {
      if (v <= 0) continue;
      ctx.fillStyle = 'rgba(0,0,0,.5)'; rr(12, yy - 12, 120, 16, 8); ctx.fill();
      ctx.fillStyle = col; rr(12, yy - 12, Math.max(10, 120 * v / max), 16, 8); ctx.fill();
      outlined(name, 20, yy + 1, 12, '#fff', 'left', 3); yy -= 22;
    }
  }
  function drawBanner() {
    if (state !== 'ready' && state !== 'clear') return;
    const dur = 2.2, t = bannerT; if (t > dur) return;
    let x;
    if (t < 0.45) x = lerp(W * 1.3, W / 2, easeOutBack(t / 0.45));
    else if (t > dur - 0.4) x = lerp(W / 2, -W * 0.6, easeInBack((t - (dur - 0.4)) / 0.4));
    else x = W / 2;
    const a = t < 0.2 ? t / 0.2 : t > dur - 0.3 ? Math.max(0, (dur - t) / 0.3) : 1;
    ctx.save(); ctx.globalAlpha = a * 0.7; ctx.fillStyle = '#060a20';
    ctx.beginPath(); ctx.moveTo(0, H * 0.5 - 50); ctx.lineTo(W, H * 0.5 - 70); ctx.lineTo(W, H * 0.5 + 40); ctx.lineTo(0, H * 0.5 + 60); ctx.fill();
    ctx.globalAlpha = 1; ctx.translate(x, H * 0.5); ctx.transform(1, 0, -0.15, 1, 0, 0);
    const sc = 1 + Math.max(0, 0.3 - t) * 1.5; ctx.scale(sc, sc);
    outlined(bannerTxt, 0, 18, Math.min(80, W * 0.11), state === 'clear' ? '#7dff9a' : '#fff', 'center', 9);
    ctx.restore();
  }

  Arcade.register({
    id: 'breakout', title: '블록 깨기',
    enter() {
      geom();
      pad = { x: W / 2, w: 110, tw: 110, h: 16, sq: 0, sqv: 0, vx: 0, wide: 0, laser: 0, fire: 0, laserT: 0 };
      score = 0; shownScore = 0; scoreBump = 0; combo = 0; comboBump = 0; maxCombo = 0; broken = 0; lives = 3;
      wall = { L: 0, R: 0, T: 0 }; keyL = keyR = false; useKeys = false; heartPop = [0, 0, 0, 0, 0];
      if (!bokeh.length) for (let i = 0; i < 14; i++) bokeh.push({ x: Math.random(), y: Math.random(), r: rand(60, 180), vx: rand(-15, 15), f: rand(0.3, 1), p: rand(0, 6), h: rand(0, 120) });
      loadStage(1);
    },
    onResize: geom,
    update(dt, rdt) {
      geom(); stateT += dt; bannerT += rdt;
      // 패들
      let tx = pad.x;
      if (useKeys) tx += ((keyR ? 1 : 0) - (keyL ? 1 : 0)) * 1000 * dt; else if (M.x > -900) tx = M.x;
      pad.tw = clamp(fw * 0.14, 80, 130) * (pad.wide > 0 ? 1.6 : 1); pad.w = damp(pad.w, pad.tw, 10, rdt);
      tx = clamp(tx, fx0 + pad.w / 2, fx0 + fw - pad.w / 2);
      const nx = useKeys ? tx : damp(pad.x, tx, 28, dt);
      if (dt > 0) pad.vx = (nx - pad.x) / dt; pad.x = nx;
      pad.sqv += (-260 * pad.sq - 9 * pad.sqv) * rdt; pad.sq += pad.sqv * rdt;
      pad.wide = Math.max(0, pad.wide - dt); pad.laser = Math.max(0, pad.laser - dt); pad.fire = Math.max(0, pad.fire - dt);
      // 레이저
      if (pad.laser > 0 && state === 'play') {
        pad.laserT -= dt;
        if (pad.laserT <= 0) { pad.laserT = 0.25; for (const s of [-1, 1]) beams.push({ x: pad.x + s * (pad.w / 2 - 8), y: padY - 14 }); AU.tone(1200, 400, 0.08, 'sawtooth', 0.04); }
      }
      for (const bm of beams) {
        bm.y -= 1100 * dt;
        if (bm.y < top) { bm.dead = true; FX.sparks(bm.x, top, 4, { dir: Math.PI / 2, col: '#f8a' }); continue; }
        for (const kb of bricks) { if (!kb.alive) continue; const R = rect(kb); if (bm.x > R.x && bm.x < R.x + R.w && bm.y > R.y && bm.y < R.y + R.h) { damage(kb, 1, null); bm.dead = true; FX.sparks(bm.x, bm.y, 5, { col: '#f8a' }); break; } }
      }
      beams = beams.filter(b => !b.dead);
      // 공
      for (const b of balls) { updateBall(b, dt); b.sq *= Math.pow(0.001, rdt); }
      balls = balls.filter(b => !b.dead);
      if (state === 'play' && balls.length === 0) loseLife();
      // 아이템
      for (const o of items) {
        o.t += dt; o.vy = Math.min(220, o.vy + 300 * dt); o.y += o.vy * dt;
        if (o.y > padY - pad.h / 2 - 10 && o.y < padY + pad.h && Math.abs(o.x - pad.x) < pad.w / 2 + 20) { o.dead = true; applyItem(o.it); }
        if (o.y > H + 30) o.dead = true;
      }
      items = items.filter(o => !o.dead);
      for (const kb of bricks) { kb.age += rdt; kb.hit = Math.max(0, kb.hit - rdt * 5); }
      if (state === 'play' && !bricks.some(b => b.alive)) clearStage();
      if (state === 'clear') {
        fwT -= rdt;
        if (fwT <= 0 && stateT < 1.8) {
          fwT = 0.22; const x = rand(fx0 + 60, fx0 + fw - 60), y = rand(top + 40, H * 0.45), hue = rand(0, 360);
          FX.sparks(x, y, 30, { min: 150, max: 500, col: hsl(hue, 100, 70), g: 200, life: 1.6 }); FX.flash(x, y, 80, 0.2); FX.ring(x, y, 90, 0.4, 3, hsl(hue, 100, 80));
          AU.noise(0.25, 3000, 300, 0.12);
        }
        if (stateT > 2.4) loadStage(stage + 1);
      }
      for (const s of ['L', 'R', 'T']) wall[s] *= Math.pow(0.003, rdt);
      for (let i = 0; i < 5; i++) { if (heartPop[i] > 0) heartPop[i] = Math.max(0, heartPop[i] - rdt * 2); else if (heartPop[i] < 0) heartPop[i] = Math.max(-1, heartPop[i] - rdt * 2); if (heartPop[i] <= -1) heartPop[i] = 0; }
      scoreBump *= Math.pow(0.005, rdt); comboBump *= Math.pow(0.01, rdt);
      shownScore = damp(shownScore, score, 10, rdt); if (Math.abs(shownScore - score) < 1) shownScore = score;
    },
    render() {
      drawBG();
      Arcade.pushCam(W / 2, H * 0.6);
      drawWalls();
      for (const kb of bricks) if (kb.alive) drawBrick(kb);
      for (const o of items) drawItem(o);
      ctx.globalCompositeOperation = 'lighter';
      for (const bm of beams) { ctx.strokeStyle = 'rgba(255,90,130,.9)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(bm.x, bm.y); ctx.lineTo(bm.x, bm.y + 26); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over';
      if (state !== 'dead') drawPaddle();
      for (const b of balls) drawBall(b);
      FX.draw();
      Arcade.popCam();
      drawHUD(); drawBanner();
      if (state === 'ready' && bannerT > 0.6) {
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(T * 5);
        outlined(useKeys ? '스페이스로 발사!' : '클릭해서 발사!', W / 2, padY - 60, 22, '#fff', 'center', 4);
        ctx.globalAlpha = 1;
        const b = balls[0];
        if (b) { const a = Math.sin(T * 3) * 0.45; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -T * 30; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + Math.sin(a) * 70, b.y - Math.cos(a) * 70); ctx.stroke(); ctx.setLineDash([]); }
      }
    },
    debug() { return { state, stage, lives, score, balls, bricks: bricks.filter(b => b.alive).length, fx0, fw, top }; },
    onDown() { if (state === 'ready') launch(); useKeys = false; },
    onMove() { useKeys = false; },
    onKey(code, down) {
      if (code === 'ArrowLeft' || code === 'KeyA') { keyL = down; if (down) useKeys = true; }
      if (code === 'ArrowRight' || code === 'KeyD') { keyR = down; if (down) useKeys = true; }
      if (code === 'Space' && down && state === 'ready') launch();
    },
  });
})();
