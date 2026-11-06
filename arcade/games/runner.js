"use strict";
// =====================================================================
//  게임 3: 대시 런 (무한 러너)
// =====================================================================
(() => {
  const G = 2800, JUMP = 940, JUMP2 = 820;
  const SKY = [
    ['#3d8bff', '#c4ecff'], ['#ff7a59', '#ffd9a0'], ['#1b1450', '#e0608a'], ['#060a20', '#283070'], ['#4a3a8a', '#ffb38a'],
  ];
  let GY, P, obs, coins, items, flyCoins, lines, speed, dist, coinN, state, deadT, gapLeft, magnet, shield, invul, holdJump, downHeld;
  let coinChain, coinChainT, hudCoinBump, scoreShown, tutT, footT, spdK, ptrStart, peak = 0;

  const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  function geom() { GY = Math.round(H * 0.78); spdK = clamp(W / 1200, 0.7, 1.15); if (P) P.x = Math.max(90, W * 0.2); }
  const score = () => Math.floor(dist / 10) + coinN * 10;

  // ---------- 생성 ----------
  function spawn() {
    const d = clamp((speed / spdK - 430) / 600, 0, 1), x = W + 80;
    const pool = ['box', 'box', 'spike', 'bird', 'pit'];
    if (d > 0.25) pool.push('box2', 'bird', 'pit');
    const type = pool[Math.floor(Math.random() * pool.length)];
    let o;
    if (type === 'box') o = { type, x, w: 44, h: 44 };
    else if (type === 'box2') o = { type, x, w: 44, h: 88 };
    else if (type === 'spike') o = { type, x, w: 72, h: 26 };
    else if (type === 'bird') o = { type, x, w: 46, h: 26, fy: GY - 78, ph: rand(0, 6) };
    else o = { type: 'pit', x, w: rand(110, 160 + d * 40), h: 0 };
    obs.push(o);
    // 코인
    if (Math.random() < 0.65) {
      const cx = x + o.w / 2;
      if (type === 'bird') for (let i = 0; i < 5; i++) coins.push({ x: cx - 80 + i * 40, y: GY - 22, ph: i });
      else for (let i = 0; i < 6; i++) coins.push({ x: cx + (i - 2.5) * 38, y: GY - 70 - Math.sin(Math.PI * (i + 0.5) / 6) * (o.h > 60 ? 170 : 120), ph: i });
    }
    if (Math.random() < 0.08) items.push({ x: x + o.w + 220, y: GY - 150, kind: Math.random() < 0.5 ? 'magnet' : 'shield', ph: 0 });
    gapLeft = speed * rand(0.95, 1.55) + o.w;
  }

  // ---------- 플레이어 ----------
  function jump() {
    if (state !== 'play') return;
    if (P.on) {
      P.vy = -JUMP; P.on = false; P.jumps = 1; P.holdT = 0; holdJump = true; P.sq = -0.6;
      FX.smoke(P.x, GY, 6, { col: '220,210,200', v: 80, vx: -speed * 0.2 });
      AU.tone(300, 700, 0.12, 'square', 0.06);
    } else if (P.jumps < 2) {
      P.vy = -JUMP2; P.jumps = 2; P.flip = 0.0001; holdJump = true; P.holdT = 0; P.sq = -0.5;
      FX.ring(P.x, P.y - 28, 50, 0.35, 4, '#ffd23a'); FX.glow(P.x, P.y - 20, 10, '#ffd23a', { max: 200 });
      AU.tone(500, 1200, 0.15, 'square', 0.06);
    }
  }
  function overPit() { for (const o of obs) if (o.type === 'pit' && P.x - 8 > o.x && P.x + 8 < o.x + o.w) return true; return false; }
  function hitbox() { const h = P.slide ? 26 : 54; return { x: P.x - 13, y: P.y - h, w: 26, h }; }
  function obox(o) {
    if (o.type === 'bird') return { x: o.x + 4, y: o.fy, w: o.w - 8, h: o.h };
    if (o.type === 'spike') return { x: o.x + 6, y: GY - o.h + 6, w: o.w - 12, h: o.h - 6 };
    return { x: o.x + 3, y: GY - o.h + 3, w: o.w - 6, h: o.h - 3 };
  }
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  function die(kind) {
    if (state !== 'play') return;
    state = 'dead'; deadT = 0; peak = speed; S.slowT = 1.2; S.shake = 24; S.red = 0.8;
    if (kind === 'hit') { P.vy = -750; P.vx = -160; P.on = false; FX.explode(P.x + 20, P.y - 30, 50); }
    else { P.vx = 0; AU.tone(600, 80, 0.9, 'sine', 0.2); }
    FX.shards(P.x, P.y - 30, 14, ['#ff5a3a', '#ffd23a', '#2a1840'], { min: 150, max: 500, up: 300, floor: GY });
    AU.tone(400, 60, 0.7, 'sawtooth', 0.15);
  }

  // ---------- 그리기 ----------
  function skyCols() {
    const u = (dist / 9000) % SKY.length, i = Math.floor(u), k = u - i, j = (i + 1) % SKY.length, kk = easeInOutCubic(clamp((k - 0.7) / 0.3, 0, 1));
    return [mix(SKY[i][0], SKY[j][0], kk), mix(SKY[i][1], SKY[j][1], kk), i === 3 ? 1 - kk : j === 3 ? kk : 0];
  }
  function drawBG() {
    const [top, bot, night] = skyCols();
    const g = ctx.createLinearGradient(0, 0, 0, GY); g.addColorStop(0, top); g.addColorStop(1, bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (night > 0.01) { ctx.fillStyle = '#fff'; for (let i = 0; i < 80; i++) { ctx.globalAlpha = night * (0.4 + 0.6 * Math.abs(Math.sin(T * 2 + i))); circle(hash(i) * W, hash(i + 99) * GY * 0.6, 1 + hash(i + 7)); ctx.fill(); } ctx.globalAlpha = 1; }
    ctx.fillStyle = night > 0.5 ? '#eef2ff' : '#fff6c0'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 40;
    circle(W * 0.8, GY * 0.28, 38); ctx.fill(); ctx.shadowBlur = 0;
    // 구름 (0.05)
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    for (let i = 0; i < 6; i++) {
      const span = W + 300, x = ((hash(i) * span - dist * 0.05 - T * 10) % span + span) % span - 150, y = GY * (0.1 + hash(i + 3) * 0.3), s = 20 + hash(i + 5) * 25;
      ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.arc(x + s, y - s * 0.4, s * 1.2, 0, TAU); ctx.arc(x + s * 2.1, y, s * 0.9, 0, TAU); ctx.fill();
    }
    // 먼 산 (0.1)
    ctx.fillStyle = rgbaMix(top, '#1a1040', 0.55); ctx.beginPath(); ctx.moveTo(0, GY);
    for (let x = 0; x <= W + 20; x += 20) { const wx = x + dist * 0.1; ctx.lineTo(x, GY - 40 - H * 0.13 * (0.6 + 0.4 * Math.sin(wx * 0.004) + 0.25 * Math.sin(wx * 0.011 + 1.3))); }
    ctx.lineTo(W, GY); ctx.fill();
    // 도시 (0.3)
    const cityOff = dist * 0.3, bwid = 70;
    for (let i = Math.floor(cityOff / bwid) - 1; i < Math.floor((cityOff + W) / bwid) + 2; i++) {
      const x = i * bwid - cityOff, h = 50 + hash(i) * H * 0.22, w = bwid - 8 - hash(i + 1) * 20;
      ctx.fillStyle = rgbaMix(top, '#140a2a', 0.75); ctx.fillRect(x, GY - h, w, h);
      if (night > 0.2) {
        for (let wy = GY - h + 10; wy < GY - 10; wy += 14) for (let wx = x + 6; wx < x + w - 8; wx += 12) {
          if (hash(wx * 3.1 + wy) > 0.55) { ctx.fillStyle = `rgba(255,220,120,${night * 0.8})`; ctx.fillRect(wx, wy, 5, 7); }
        }
      }
    }
    // 가까운 나무 (0.6)
    const tOff = dist * 0.6, tw = 160;
    for (let i = Math.floor(tOff / tw) - 1; i < Math.floor((tOff + W) / tw) + 2; i++) {
      if (hash(i + 50) < 0.35) continue;
      const x = i * tw - tOff + hash(i) * 60, s = 0.7 + hash(i + 9) * 0.6;
      ctx.fillStyle = rgbaMix(top, '#0f2a1a', 0.85);
      ctx.fillRect(x - 3 * s, GY - 30 * s, 6 * s, 30 * s);
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x - (26 - k * 5) * s, GY - (22 + k * 22) * s); ctx.lineTo(x, GY - (60 + k * 22) * s); ctx.lineTo(x + (26 - k * 5) * s, GY - (22 + k * 22) * s); ctx.fill(); }
    }
    if (night > 0.01) { ctx.fillStyle = `rgba(5,5,30,${night * 0.25})`; ctx.fillRect(0, 0, W, H); }
  }
  function rgbaMix(c1, c2, k) { // c1 = 'rgb(...)' 문자열일 수도 있음
    const p = s => s[0] === '#' ? hex(s) : s.match(/\d+/g).map(Number);
    const A = p(c1), B = p(c2);
    return `rgb(${A[0] + (B[0] - A[0]) * k | 0},${A[1] + (B[1] - A[1]) * k | 0},${A[2] + (B[2] - A[2]) * k | 0})`;
  }
  function drawGround() {
    const L = -W, R = W * 2;
    const g = ctx.createLinearGradient(0, GY, 0, H); g.addColorStop(0, '#6b4a33'); g.addColorStop(1, '#2b1d14');
    ctx.fillStyle = g; ctx.fillRect(L, GY, R - L, H - GY + 200);
    ctx.fillStyle = '#4fae4a'; ctx.fillRect(L, GY - 4, R - L, 10);
    ctx.fillStyle = '#6ccf5a'; ctx.fillRect(L, GY - 4, R - L, 3);
    ctx.fillStyle = 'rgba(0,0,0,.15)';
    const off = dist % 60;
    for (let x = -off - 60; x < W + 60; x += 60) { ctx.fillRect(x, GY + 18, 30, 6); ctx.fillRect(x + 25, GY + 46, 20, 5); }
    for (const o of obs) if (o.type === 'pit') {
      const pg = ctx.createLinearGradient(0, GY, 0, H); pg.addColorStop(0, '#0a0610'); pg.addColorStop(1, '#000');
      ctx.fillStyle = pg; ctx.fillRect(o.x, GY - 4, o.w, H - GY + 200);
      ctx.fillStyle = '#3a2618'; ctx.fillRect(o.x - 4, GY - 4, 6, H); ctx.fillRect(o.x + o.w - 2, GY - 4, 6, H);
    }
  }
  function drawObs(o) {
    if (o.type === 'box' || o.type === 'box2') {
      const n = o.h / 44;
      for (let k = 0; k < n; k++) {
        const y = GY - 44 * (k + 1);
        ctx.fillStyle = '#b07a3c'; rr(o.x, y, 44, 44, 4); ctx.fill();
        ctx.strokeStyle = '#7a4f22'; ctx.lineWidth = 4; ctx.strokeRect(o.x + 4, y + 4, 36, 36);
        ctx.beginPath(); ctx.moveTo(o.x + 4, y + 4); ctx.lineTo(o.x + 40, y + 40); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(o.x + 2, y + 2, 40, 5);
      }
    } else if (o.type === 'spike') {
      const n = 4, sw = o.w / n;
      for (let k = 0; k < n; k++) {
        const g = ctx.createLinearGradient(o.x + k * sw, 0, o.x + (k + 1) * sw, 0); g.addColorStop(0, '#e8eef8'); g.addColorStop(1, '#6a7488');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(o.x + k * sw, GY); ctx.lineTo(o.x + k * sw + sw / 2, GY - o.h); ctx.lineTo(o.x + (k + 1) * sw, GY); ctx.fill();
      }
      ctx.fillStyle = '#4a5060'; ctx.fillRect(o.x - 2, GY - 4, o.w + 4, 5);
    } else if (o.type === 'bird') {
      const y = o.fy + o.h / 2 + Math.sin(T * 6 + o.ph) * 4, x = o.x + o.w / 2, flap = Math.sin(T * 22 + o.ph);
      ctx.save(); ctx.translate(x, y);
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(26 + k * 6, -6 + k * 6); ctx.lineTo(44 + k * 10, -6 + k * 6); ctx.stroke(); }
      ctx.fillStyle = '#6a3aa0';
      ctx.beginPath(); ctx.moveTo(-2, -2); ctx.quadraticCurveTo(8, -22 * flap - 4, 18, -2); ctx.fill();
      ctx.fillStyle = '#8a4fd0'; ctx.beginPath(); ctx.ellipse(0, 0, 20, 11, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffc23a'; ctx.beginPath(); ctx.moveTo(-18, -2); ctx.lineTo(-30, 2); ctx.lineTo(-18, 5); ctx.fill();
      ctx.fillStyle = '#fff'; circle(-10, -3, 4); ctx.fill(); ctx.fillStyle = '#000'; circle(-11, -3, 2); ctx.fill();
      ctx.fillStyle = '#5a2a90'; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(4, 22 * flap, 14, 0); ctx.fill();
      ctx.restore();
    }
  }
  function drawCoin(c) {
    const w = Math.abs(Math.cos(T * 5 + c.ph)) * 11 + 1;
    ctx.save(); ctx.translate(c.x, c.y + Math.sin(T * 4 + c.ph) * 3);
    ctx.shadowColor = '#ffd23a'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffcc2a'; ctx.beginPath(); ctx.ellipse(0, 0, w, 12, 0, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff2a0'; ctx.beginPath(); ctx.ellipse(-w * 0.25, -3, w * 0.35, 5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#c08a10'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, w, 12, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  function drawItem(it) {
    ctx.save(); ctx.translate(it.x, it.y + Math.sin(T * 3 + it.ph) * 8);
    const s = 1 + Math.sin(T * 6) * 0.06; ctx.scale(s, s);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = it.kind === 'magnet' ? 'rgba(255,80,100,.25)' : 'rgba(80,180,255,.25)'; circle(0, 0, 30); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; circle(0, 0, 24); ctx.stroke();
    if (it.kind === 'magnet') {
      ctx.strokeStyle = '#ff3a4a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 2, 9, 0, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-9, 2); ctx.lineTo(-9, -8); ctx.moveTo(9, 2); ctx.lineTo(9, -8); ctx.stroke();
      ctx.fillStyle = '#ddd'; ctx.fillRect(-12.5, -13, 7, 6); ctx.fillRect(5.5, -13, 7, 6);
    } else {
      ctx.fillStyle = '#3a9dff'; ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(12, -8); ctx.lineTo(10, 6); ctx.lineTo(0, 14); ctx.lineTo(-10, 6); ctx.lineTo(-12, -8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(8, -6); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function drawPlayer() {
    const stretch = P.on ? 0 : clamp(-P.vy / 1200, -0.15, 0.25);
    const sx = (1 - P.sq * 0.3) * (1 - stretch * 0.6), sy = (1 + P.sq * 0.35) * (1 + stretch);
    ctx.save(); ctx.translate(P.x, P.y);
    if (invul > 0 && Math.sin(T * 40) > 0) ctx.globalAlpha = 0.5;
    ctx.scale(sx, sy);
    if (P.flip > 0 || state === 'dead') { ctx.translate(0, -28); ctx.rotate(state === 'dead' ? P.rot : -P.flip * TAU); ctx.translate(0, 28); }
    const ph = P.phase, slide = P.slide && P.on;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // 그림자
    if (state !== 'dead') { ctx.save(); ctx.scale(1 / sx, 1 / sy); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, GY - P.y + 2, 18 * clamp(1 - (GY - P.y) / 300, 0.3, 1), 4, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    if (slide) ctx.rotate(-1.15);
    // 목도리
    ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-2, -42);
    const wv = 3 + speed / 300;
    for (let i = 1; i <= 6; i++) ctx.lineTo(-2 - i * 7, -42 + Math.sin(T * 16 - i * 0.9) * wv * (i / 6) + (slide ? 0 : i * 0.8));
    ctx.stroke();
    // 다리
    const legA = P.on ? Math.sin(ph) * 0.9 : 0.5, legB = P.on ? -Math.sin(ph) * 0.9 : -0.3;
    const leg = (a, col) => {
      ctx.strokeStyle = col; ctx.lineWidth = 7;
      const kx = Math.sin(a) * 12, ky = -22 + Math.cos(a) * 12, fx = kx + Math.sin(a - 0.8) * 11, fy = Math.min(0, ky + 11);
      ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    };
    leg(legB, '#1a1030');
    // 팔 (뒤)
    ctx.strokeStyle = '#d0402a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, -38); ctx.lineTo(Math.sin(-ph) * 12, -28 + Math.abs(Math.cos(ph)) * 2); ctx.stroke();
    // 몸통
    ctx.fillStyle = '#ff5a3a'; rr(-10, -46, 20, 26, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.25)'; rr(-7, -44, 6, 18, 3); ctx.fill();
    leg(legA, '#2a1a48');
    // 팔 (앞)
    ctx.strokeStyle = '#ff6a4a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(2, -38); ctx.lineTo(2 + Math.sin(ph) * 13, -28 + Math.abs(Math.sin(ph)) * 2); ctx.stroke();
    // 머리
    ctx.fillStyle = '#ffd9a8'; circle(3, -56, 11); ctx.fill();
    ctx.fillStyle = '#2a1840'; ctx.beginPath(); ctx.arc(3, -58, 11.5, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
    ctx.fillStyle = '#ffd23a'; ctx.fillRect(-8, -60, 22, 4);
    ctx.fillStyle = '#111'; circle(9, -55, 2); ctx.fill();
    if (state === 'dead') { ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(6, -58); ctx.lineTo(11, -53); ctx.moveTo(11, -58); ctx.lineTo(6, -53); ctx.stroke(); }
    ctx.restore();
    ctx.lineCap = 'butt';
    // 실드
    if (shield) {
      ctx.save(); ctx.translate(P.x, P.y - 28); const s = 1 + Math.sin(T * 8) * 0.05; ctx.scale(s, s * (P.slide && P.on ? 0.7 : 1));
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 20, 0, 0, 44); g.addColorStop(0, 'rgba(80,180,255,0)'); g.addColorStop(0.8, 'rgba(80,180,255,.25)'); g.addColorStop(1, 'rgba(160,220,255,.6)');
      ctx.fillStyle = g; circle(0, 0, 44); ctx.fill();
      ctx.strokeStyle = `rgba(200,240,255,${0.5 + 0.3 * Math.sin(T * 10)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 42, T * 3, T * 3 + 2); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over'; ctx.restore();
    }
    if (magnet > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,90,110,${0.25 + 0.15 * Math.sin(T * 10)})`; ctx.lineWidth = 2;
      for (let k = 0; k < 2; k++) { circle(P.x, P.y - 28, 60 + ((T * 120 + k * 60) % 120)); ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  function drawHUD() {
    const m = Math.floor(dist / 10);
    outlined(m.toLocaleString() + ' m', W / 2, 48, 36, '#fff', 'center');
    outlined('SCORE ' + Math.round(scoreShown).toLocaleString(), W / 2, 72, 16, '#ffd86a', 'center', 3);
    ctx.save(); ctx.translate(W - 110, 40); const s = 1 + hudCoinBump * 0.4; ctx.scale(s, s);
    ctx.fillStyle = '#ffcc2a'; ctx.shadowColor = '#ffd23a'; ctx.shadowBlur = 12; circle(0, 0, 12); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = '#c08a10'; ctx.lineWidth = 2; circle(0, 0, 12); ctx.stroke(); ctx.restore();
    outlined('x ' + coinN, W - 90, 48, 24, '#fff', 'left', 4);
    const sp = speed / (430 * spdK);
    outlined(`SPEED x${sp.toFixed(1)}`, 130, 44, 16, sp > 2 ? '#ff7a59' : '#fff', 'left', 3);
    let yy = 66;
    if (magnet > 0) { outlined(`자석 ${magnet.toFixed(1)}s`, 130, yy, 14, '#ff8a9a', 'left', 3); yy += 20; }
    if (shield) outlined('실드 ON', 130, yy, 14, '#7cc8ff', 'left', 3);
    if (tutT > 0) {
      ctx.globalAlpha = Math.min(1, tutT) * (0.7 + 0.3 * Math.sin(T * 5));
      outlined(W < 600 ? '탭: 점프 (공중에서 한 번 더 = 이단 점프)  ·  아래로 스와이프: 슬라이드' : '스페이스/↑/클릭: 점프 (꾹 = 높이, 공중에서 한 번 더 = 이단 점프)  ·  ↓: 슬라이드', W / 2, H * 0.3, Math.min(18, W * 0.035), '#fff', 'center', 4);
      ctx.globalAlpha = 1;
    }
  }

  Arcade.register({
    id: 'runner', title: '대시 런',
    enter() {
      P = null; geom();
      P = { x: Math.max(90, W * 0.2), y: GY, vy: 0, vx: 0, on: true, jumps: 0, slide: false, sq: 0, flip: 0, phase: 0, holdT: 0, rot: 0 };
      obs = []; coins = []; items = []; flyCoins = []; lines = [];
      speed = 430 * spdK; dist = 0; coinN = 0; state = 'play'; deadT = 0; gapLeft = W * 0.7; magnet = 0; shield = false; invul = 0;
      holdJump = false; downHeld = false; coinChain = 0; coinChainT = 0; hudCoinBump = 0; scoreShown = 0; tutT = 5; footT = 0; ptrStart = null;
      FX.text(W / 2, H * 0.42, 'GO!', '#ffd23a', 110, 0.9, 0);
    },
    onResize: geom,
    update(dt, rdt) {
      geom();
      tutT -= rdt;
      if (state === 'play') {
        speed = Math.min(1150 * spdK, speed + 9 * spdK * dt);
        dist += speed * dt;
        gapLeft -= speed * dt; if (gapLeft <= 0) spawn();
      } else {
        speed = damp(speed, 0, 3, dt);
        deadT += rdt;
        if (deadT > 1.4 && !Arcade.over) Arcade.gameOver(score(), [`거리 ${Math.floor(dist / 10).toLocaleString()}m  ·  코인 ${coinN}`, `최고 속도 x${(peak / (430 * spdK)).toFixed(1)}`]);
      }
      const mv = speed * dt;
      for (const o of obs) { o.x -= mv + (o.type === 'bird' ? 90 * dt : 0); }
      obs = obs.filter(o => o.x + o.w > -150);
      for (const c of coins) {
        c.x -= mv;
        if (state === 'play' && magnet > 0) { const dx = P.x - c.x, dy = P.y - 28 - c.y, d = Math.hypot(dx, dy); if (d < 260) { c.x += dx / d * 900 * dt; c.y += dy / d * 900 * dt; } }
      }
      for (const it of items) it.x -= mv;
      // 플레이어
      if (state === 'play') {
        P.slide = downHeld && P.on;
        const g = (holdJump && P.vy < 0 && P.holdT < 0.25) ? G * 0.45 : G;
        P.vy += g * dt; P.y += P.vy * dt; P.holdT += dt;
        if (!P.on && downHeld && P.vy > -200) P.vy = Math.max(P.vy, 1100);
        const sup = !overPit();
        if (P.y >= GY && sup && P.vy >= 0 && P.y < GY + 30) {
          if (!P.on) {
            P.sq = clamp(P.vy / 1400, 0.3, 1);
            FX.smoke(P.x, GY, 8, { col: '220,200,180', v: 90, vx: -speed * 0.3 });
            AU.tone(140, 80, 0.06, 'sine', 0.2);
          }
          P.y = GY; P.vy = 0; P.on = true; P.jumps = 0; P.flip = 0;
        } else if (P.y < GY || !sup) P.on = P.y >= GY && sup ? P.on : false;
        if (P.y > GY + 70) die('fall');
        if (P.flip > 0) { P.flip += dt * 2.2; if (P.flip >= 1) P.flip = 0; }
        if (P.on) {
          P.phase += speed * dt * 0.03;
          footT -= dt;
          if (P.slide) { if (Math.random() < 0.6) FX.add({ type: 'spark', x: P.x - 10, y: GY - 2, vx: -speed * 0.6 + rand(-60, 60), vy: rand(-200, -50), life: 0.3, s: 2, dr: 0.3, g: 600, col: '#ffe08a' }); }
          else if (footT <= 0) { footT = 0.22; FX.smoke(P.x - 6, GY, 1, { col: '210,195,175', v: 30, vx: -speed * 0.25, s: 8, life: 0.6, a: 0.7 }); }
        }
        // 충돌
        invul = Math.max(0, invul - dt);
        const hb = hitbox();
        for (const o of obs) {
          if (o.type === 'pit' || o.dead) continue;
          if (overlap(hb, obox(o))) {
            if (invul > 0) continue;
            if (shield) {
              shield = false; invul = 0.8; o.dead = true;
              FX.ring(P.x, P.y - 28, 90, 0.5, 6, '#9fdcff'); FX.flash(P.x, P.y - 28, 120, 0.2, '160,220,255');
              FX.shards(o.x + o.w / 2, GY - o.h / 2, 14, o.type === 'bird' ? ['#8a4fd0', '#6a3aa0'] : o.type === 'spike' ? ['#e8eef8', '#6a7488'] : ['#b07a3c', '#7a4f22'], { min: 200, max: 600, up: 300, floor: GY, vx: -speed * 0.3 });
              S.shake = Math.min(30, S.shake + 12); S.hitstop = 0.06; AU.noise(0.3, 4000, 300, 0.3); AU.tone(900, 200, 0.3, 'triangle', 0.15);
              FX.text(P.x, P.y - 90, '실드 방어!', '#9fdcff', 28, 0.9);
            } else { die('hit'); break; }
          }
        }
        obs = obs.filter(o => !o.dead);
        // 코인 획득
        for (const c of coins) {
          if (Math.hypot(c.x - P.x, c.y - (P.y - 28)) < 34) {
            c.dead = true; coinN++; coinChain = coinChainT > 0 ? coinChain + 1 : 0; coinChainT = 0.4;
            const f = 880 * Math.pow(2, Math.min(coinChain, 12) / 12); AU.tone(f, f * 1.5, 0.1, 'square', 0.05);
            flyCoins.push({ x: c.x, y: c.y, sx: c.x, sy: c.y, t: 0 });
            FX.glow(c.x, c.y, 6, '#ffe45a', { max: 160 }); FX.ring(c.x, c.y, 26, 0.25, 3, '#ffe45a');
          }
          if (c.x < -50) c.dead = true;
        }
        coins = coins.filter(c => !c.dead);
        for (const it of items) {
          if (Math.hypot(it.x - P.x, it.y - (P.y - 28)) < 44) {
            it.dead = true;
            if (it.kind === 'magnet') { magnet = 8; FX.text(P.x, P.y - 100, '코인 자석!', '#ff8a9a', 30); }
            else { shield = true; FX.text(P.x, P.y - 100, '실드!', '#9fdcff', 30); }
            FX.ring(it.x, it.y, 80, 0.45, 5, '#ffffff'); FX.glow(it.x, it.y, 18, it.kind === 'magnet' ? '#ff6a8a' : '#6ac8ff', { max: 300 });
            AU.tone(500, 1500, 0.2, 'square', 0.07); S.punch += 0.03;
          }
          if (it.x < -60) it.dead = true;
        }
        items = items.filter(i => !i.dead);
        magnet = Math.max(0, magnet - dt);
        coinChainT -= dt;
      } else {
        P.vy += G * 0.8 * dt; P.y += P.vy * dt; P.x += P.vx * dt; P.rot += dt * 9;
        if (P.y > GY && !overPit() && P.vy > 0 && P.vx !== 0) { P.y = GY; P.vy *= -0.4; P.vx *= 0.5; if (Math.abs(P.vy) < 60) { P.vy = 0; P.vx = 0; } }
      }
      // 날아가는 코인 → HUD
      for (const f of flyCoins) {
        f.t += rdt / 0.55; const k = easeInOutCubic(Math.min(1, f.t));
        f.x = lerp(f.sx, W - 110, k); f.y = lerp(f.sy, 40, k) - Math.sin(Math.PI * k) * 80;
        if (f.t >= 1) { f.dead = true; hudCoinBump = 1; }
      }
      flyCoins = flyCoins.filter(f => !f.dead);
      // 속도선
      const sk = clamp((speed / spdK - 650) / 400, 0, 1);
      if (sk > 0 && Math.random() < sk * 0.8) lines.push({ x: W + 20, y: rand(0, GY), len: rand(60, 200), a: rand(0.2, 0.6) * sk });
      for (const l of lines) l.x -= speed * 2 * dt; lines = lines.filter(l => l.x + l.len > 0);
      P.sq *= Math.pow(0.001, rdt);
      hudCoinBump *= Math.pow(0.003, rdt);
      scoreShown = damp(scoreShown, score(), 10, rdt);
    },
    render() {
      drawBG();
      const sk = clamp((speed / spdK - 430) / 700, 0, 1), z = 1 - 0.1 * sk;
      Arcade.pushCam(P.x, GY, z);
      drawGround();
      for (const o of obs) drawObs(o);
      for (const c of coins) drawCoin(c);
      for (const it of items) drawItem(it);
      drawPlayer();
      FX.draw();
      Arcade.popCam();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      for (const l of lines) { ctx.globalAlpha = l.a; ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x + l.len, l.y); ctx.stroke(); }
      ctx.globalAlpha = 1;
      for (const f of flyCoins) { const s = 1 - f.t * 0.4; ctx.fillStyle = '#ffcc2a'; ctx.shadowColor = '#ffd23a'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.ellipse(f.x, f.y, 11 * s, 12 * s, 0, 0, TAU); ctx.fill(); ctx.shadowBlur = 0; }
      drawHUD();
    },
    onKey(code, down, e) {
      if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') { if (down) { if (!e.repeat) jump(); } else holdJump = false; }
      if (code === 'ArrowDown' || code === 'KeyS') downHeld = down;
    },
    debug() { return { state, P, obs, speed, dist, coinN, GY }; },
    onDown(x, y, e) { ptrStart = { y, id: e.pointerId }; jump(); },
    onMove(x, y, e) { if (ptrStart && e.pointerId === ptrStart.id && y - ptrStart.y > 40) { downHeld = true; holdJump = false; } },
    onUp(x, y, e) { if (ptrStart && e.pointerId === ptrStart.id) { ptrStart = null; downHeld = false; holdJump = false; } },
  });
})();
