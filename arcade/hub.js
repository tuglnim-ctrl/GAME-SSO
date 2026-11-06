"use strict";
// =====================================================================
//  메인 메뉴 (허브)
// =====================================================================
(() => {
  const GAMES = [
    { id: 'breakout', title: '블록 깨기', sub: 'BRICK BREAKER', col: '#3ad0ff', desc: '공을 튕겨 벽돌을 부숴라!' },
    { id: 'rhythm', title: '비트 러시', sub: 'RHYTHM BEAT', col: '#ff4fd8', desc: 'D F J K, 박자에 맞춰 눌러라!' },
    { id: 'runner', title: '대시 런', sub: 'ENDLESS RUN', col: '#ffc23a', desc: '점프와 슬라이드로 끝까지!' },
  ];
  const LC = ['#3ad0ff', '#7cff6b', '#ffc23a', '#ff4fd8'];
  let cards = [], focus = 0, t0 = 0, picked = -1, pickT = 0, gone = false, hover = -1, vertical = false, stars = [], bests = [0, 0, 0], riseT = 0;

  function layout() {
    vertical = W < 760 && H > W * 0.9;
    cards = GAMES.map((g, i) => {
      let x, y, w, h;
      if (!vertical) {
        w = Math.min(290, (W - 60) / 3); h = Math.min(w * 1.32, H * 0.58);
        const gap = Math.min(40, (W - 3 * w) / 4), tot = 3 * w + 2 * gap;
        x = W / 2 - tot / 2 + i * (w + gap); y = H * 0.6 - h / 2;
      } else {
        w = Math.min(W - 32, 460); h = Math.max(90, Math.min(170, (H - 190) / 3 - 12));
        x = W / 2 - w / 2; y = 150 + i * (h + 12);
      }
      const old = cards[i] || { hk: 0, tx: 0, ty: 0 };
      return { ...g, x, y, w, h, hk: old.hk, tx: old.tx, ty: old.ty };
    });
  }
  function cardAt(x, y) { for (let i = 0; i < cards.length; i++) { const c = cards[i]; if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return i; } return -1; }
  function pick(i) {
    if (picked >= 0 || Arcade.trans || i < 0 || i > 2) return;
    picked = i; pickT = 0; focus = i; gone = false;
    const c = cards[i], cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    AU.tone(400, 1300, 0.25, 'square', 0.07); AU.noise(0.3, 7000, 600, 0.12);
    FX.sparks(cx, cy, 40, { min: 200, max: 900, col: c.col, g: 200 });
    FX.ring(cx, cy, c.w, 0.5, 6, c.col); S.punch += 0.03;
  }

  // ---------- 미리보기 애니메이션 ----------
  const tri = u => 1 - Math.abs(2 * (u - Math.floor(u)) - 1);
  function prevBreakout(x, y, w, h, tt, col) {
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#0a1838'); g.addColorStop(1, '#050a1c');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    const cols = 7, rows = 4, bw = (w - 16) / cols, bh = Math.max(6, Math.min(14, h * 0.09));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (((idx * 37 + Math.floor(tt * 1.5) * 11) % 13) < 3) continue;
      ctx.fillStyle = hsl(190 + r * 40, 85, 60); rr(x + 8 + c * bw + 1, y + 8 + r * (bh + 3), bw - 2, bh, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x + 8 + c * bw + 3, y + 9 + r * (bh + 3), bw - 6, 2);
    }
    const yTop = y + 10 + rows * (bh + 3), yBot = y + h - 18;
    const pos = k => [x + 10 + (w - 20) * tri(k * 0.43), yTop + (yBot - yTop) * tri(k * 0.71)];
    const [bx] = pos(tt);
    const px = clamp(bx, x + 26, x + w - 26);
    ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 12; rr(px - 24, y + h - 12, 48, 7, 3.5); ctx.fill(); ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 7; k >= 0; k--) { const [qx, qy] = pos(tt - k * 0.018); ctx.fillStyle = `rgba(150,230,255,${0.5 * (1 - k / 8)})`; circle(qx, qy, 5 * (1 - k / 10)); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
    const [qx, qy] = pos(tt); ctx.fillStyle = '#fff'; circle(qx, qy, 5); ctx.fill();
  }
  function prevRhythm(x, y, w, h, tt) {
    ctx.fillStyle = '#140826'; ctx.fillRect(x, y, w, h);
    const beat = Math.exp(-((tt * 2) % 1) * 6);
    ctx.fillStyle = `rgba(255,79,216,${beat * 0.15})`; ctx.fillRect(x, y, w, h);
    const lw = w / 4, hitY = y + h - 18;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.06)'; ctx.fillRect(x + i * lw, y, lw, h);
      for (let j = 0; j < 3; j++) {
        const ph = (tt * 0.8 + j / 3 + i * 0.29) % 1, ny = y - 10 + ph * (h - 8);
        if (ny > hitY + 4) continue;
        ctx.fillStyle = LC[i]; rr(x + i * lw + 5, ny, lw - 10, 8, 3); ctx.fill();
        if (ph > 0.88) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = rgba(LC[i], (ph - 0.88) * 5); ctx.fillRect(x + i * lw, hitY - 30, lw, 34);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    }
    ctx.fillStyle = `rgba(255,255,255,${0.6 + beat * 0.4})`; ctx.fillRect(x, hitY, w, 3);
  }
  function prevRunner(x, y, w, h, tt) {
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#6b3aa0'); g.addColorStop(1, '#ffb36b');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,240,200,.85)'; circle(x + w * 0.75, y + h * 0.45, h * 0.18); ctx.fill();
    ctx.fillStyle = 'rgba(60,20,80,.5)';
    for (let k = 0; k < 8; k++) { const bx = x + ((k * 47 - tt * 40) % (w + 60) + w + 60) % (w + 60) - 30, bh2 = 18 + (k * 13 % 25); ctx.fillRect(bx, y + h - 14 - bh2, 26, bh2); }
    const gy = y + h - 14;
    ctx.fillStyle = '#3a2a4a'; ctx.fillRect(x, gy, w, 14);
    ctx.fillStyle = 'rgba(255,255,255,.15)';
    for (let k = 0; k < 12; k++) ctx.fillRect(x + ((k * 30 - tt * 160) % (w + 30) + w + 30) % (w + 30) - 15, gy + 5, 12, 3);
    const period = 1.5, ph = (tt % period) / period, ox = x + w + 20 - ph * (w + 60);
    ctx.fillStyle = '#b07a3c'; ctx.fillRect(ox, gy - 16, 16, 16); ctx.strokeStyle = '#7a4f22'; ctx.lineWidth = 2; ctx.strokeRect(ox + 1, gy - 15, 14, 14);
    const cx = x + w * 0.28, d = ox - cx;
    let jy = 0; if (d < 60 && d > -50) jy = -Math.sin(Math.PI * clamp((60 - d) / 110, 0, 1)) * h * 0.4;
    const run = tt * 18;
    ctx.save(); ctx.translate(cx, gy + jy);
    ctx.strokeStyle = '#2a1840'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(Math.sin(run) * 6, 0); ctx.moveTo(0, -10); ctx.lineTo(-Math.sin(run) * 6, 0); ctx.stroke();
    ctx.fillStyle = '#ff5a3a'; rr(-5, -22, 10, 13, 4); ctx.fill();
    ctx.fillStyle = '#ffd9a8'; circle(1, -26, 5); ctx.fill();
    ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-3, -19);
    for (let i = 1; i < 5; i++) ctx.lineTo(-3 - i * 4, -19 + Math.sin(tt * 14 - i) * 2); ctx.stroke();
    ctx.lineCap = 'butt'; ctx.restore();
  }
  const PREV = [prevBreakout, prevRhythm, prevRunner];

  // ---------- 그리기 ----------
  function drawBG() {
    const hy = H * 0.7;
    const g = ctx.createLinearGradient(0, 0, 0, hy); g.addColorStop(0, '#0d0322'); g.addColorStop(1, '#4a0c5c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, hy);
    ctx.fillStyle = '#fff';
    for (const s of stars) { ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(T * s.f + s.p)); circle(s.x * W, s.y * hy, s.s); ctx.fill(); }
    ctx.globalAlpha = 1;
    // 레트로 태양
    const R = Math.min(W, H) * 0.24, sx = W / 2, sy = hy;
    ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createRadialGradient(sx, sy, R * 0.5, sx, sy, R * 2.2); hg.addColorStop(0, 'rgba(255,80,160,.35)'); hg.addColorStop(1, 'rgba(255,80,160,0)');
    ctx.fillStyle = hg; circle(sx, sy, R * 2.2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, hy); ctx.clip();
    const sg = ctx.createLinearGradient(0, sy - R, 0, sy); sg.addColorStop(0, '#ffe45a'); sg.addColorStop(1, '#ff3d8b');
    ctx.fillStyle = sg; circle(sx, sy, R); ctx.fill();
    ctx.fillStyle = '#3c0a50';
    for (let k = 0; k < 7; k++) {
      const u = ((k / 7) + T * 0.06) % 1, yy = sy - R * 0.75 * (1 - u), th = 1 + u * 9;
      ctx.fillRect(sx - R, yy, R * 2, th);
    }
    ctx.restore();
    // 그리드 바닥
    const fg = ctx.createLinearGradient(0, hy, 0, H); fg.addColorStop(0, '#22053a'); fg.addColorStop(1, '#05010d');
    ctx.fillStyle = fg; ctx.fillRect(0, hy, W, H - hy);
    ctx.strokeStyle = '#ff3dc8'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 22; i++) {
      const z = (i + (T * 1.2) % 1) / 22, yy = hy + (H - hy) * z * z;
      ctx.globalAlpha = z; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
    }
    ctx.globalAlpha = 0.6;
    for (let j = -16; j <= 16; j++) { ctx.beginPath(); ctx.moveTo(W / 2 + j * 22, hy); ctx.lineTo(W / 2 + j * W * 0.16, H); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ff7ae0'; ctx.shadowColor = '#ff3dc8'; ctx.shadowBlur = 20; ctx.fillRect(0, hy - 1, W, 3); ctx.shadowBlur = 0;
  }
  function drawTitle() {
    const title = '3-in-1 ARCADE', sz = Math.min(84, W * 0.11), ty = vertical ? 78 : H * 0.17;
    ctx.font = `${sz}px ${FONT}`;
    const ws = [...title].map(ch => ctx.measureText(ch).width), tw = ws.reduce((a, b) => a + b, 0);
    let x = W / 2 - tw / 2;
    for (let i = 0; i < title.length; i++) {
      const intro = clamp((T - t0) * 2.5 - i * 0.06, 0, 1);
      const yy = ty + Math.sin(T * 3 + i * 0.5) * 6 - (1 - easeOutElastic(intro)) * 220;
      const col = i < 6 ? '#ffd23a' : hsl(T * 80 + i * 25, 100, 65);
      ctx.save(); ctx.translate(x + ws[i] / 2, yy); ctx.rotate(Math.sin(T * 2 + i) * 0.06);
      const s = 1 + Math.max(0, Math.sin(T * 3 + i * 0.5)) * 0.08; ctx.scale(s, s);
      ctx.globalAlpha = intro; ctx.shadowColor = col; ctx.shadowBlur = 25;
      outlined(title[i], 0, 0, sz, col, 'center', sz * 0.1);
      ctx.restore(); x += ws[i];
    }
    ctx.globalAlpha = clamp((T - t0) * 1.5 - 0.6, 0, 1);
    outlined('▼ 플레이할 게임을 골라주세요 ▼', W / 2, ty + sz * 0.62, Math.min(20, W * 0.04), '#fff', 'center', 4);
    ctx.globalAlpha = 1;
  }
  function drawCard(c, i) {
    const intro = clamp((T - t0) * 2.2 - 0.25 - i * 0.13, 0, 1); if (intro <= 0) return;
    const ik = easeOutBack(intro), cx = c.x + c.w / 2, cy = c.y + c.h / 2, w = c.w, h = c.h;
    let s = 1 + c.hk * 0.06, alpha = clamp(intro * 2, 0, 1);
    if (picked >= 0) { const pk = easeOutCubic(clamp(pickT / 0.3, 0, 1)); if (picked === i) s += pk * 0.12; else alpha *= 1 - pk; }
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.translate(cx, cy + (1 - ik) * H * 0.5 + Math.sin(T * 1.6 + i * 2) * 5 * (1 - c.hk));
    ctx.scale(s, s); ctx.rotate(c.tx * 0.035); ctx.transform(1, c.ty * 0.02, -c.tx * 0.05, 1, 0, 0);
    ctx.shadowColor = c.col; ctx.shadowBlur = 10 + c.hk * 40;
    ctx.fillStyle = 'rgba(18,10,40,.94)'; rr(-w / 2, -h / 2, w, h, 18); ctx.fill(); ctx.shadowBlur = 0;
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, rgba(c.col, 0.22 + c.hk * 0.15)); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; rr(-w / 2, -h / 2, w, h, 18); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = rgba(c.col, 0.35); rr(-w / 2, -h / 2, w, h, 18); ctx.stroke();
    const P = 2 * (w + h);
    ctx.lineWidth = 3 + c.hk * 2; ctx.strokeStyle = c.col; ctx.setLineDash([P * 0.18, P * 0.32]); ctx.lineDashOffset = -T * (120 + c.hk * 300);
    ctx.shadowColor = c.col; ctx.shadowBlur = 15; rr(-w / 2, -h / 2, w, h, 18); ctx.stroke(); ctx.shadowBlur = 0; ctx.setLineDash([]);
    // 미리보기
    const pr = vertical ? { x: -w / 2 + 10, y: -h / 2 + 10, w: Math.min((h - 20) * 1.35, w * 0.42), h: h - 20 } : { x: -w / 2 + 12, y: -h / 2 + 12, w: w - 24, h: h * 0.52 };
    ctx.save(); rr(pr.x, pr.y, pr.w, pr.h, 12); ctx.clip(); PREV[i](pr.x, pr.y, pr.w, pr.h, T + i * 0.7, c.col);
    if (c.hk > 0.02) {
      ctx.fillStyle = `rgba(0,0,0,${c.hk * 0.35})`; ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
      const pcx = pr.x + pr.w / 2, pcy = pr.y + pr.h / 2, ps = c.hk * (1 + Math.sin(T * 6) * 0.06);
      ctx.save(); ctx.translate(pcx, pcy); ctx.scale(ps, ps);
      ctx.fillStyle = 'rgba(255,255,255,.92)'; circle(0, 0, 26); ctx.fill();
      ctx.fillStyle = c.col; ctx.beginPath(); ctx.moveTo(-8, -12); ctx.lineTo(13, 0); ctx.lineTo(-8, 12); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,.18)'; rr(pr.x, pr.y, pr.w, pr.h, 12); ctx.stroke();
    // 번호 배지
    ctx.fillStyle = c.col; circle(-w / 2 + 16, -h / 2 + 16, 13); ctx.fill();
    ctx.textBaseline = 'middle'; outlined(String(i + 1), -w / 2 + 16, -h / 2 + 17, 16, '#fff', 'center', 3); ctx.textBaseline = 'alphabetic';
    // 텍스트
    const best = bests[i] ? 'BEST ' + bests[i].toLocaleString() : 'BEST -';
    if (!vertical) {
      const ty = pr.y + pr.h;
      outlined(c.title, 0, ty + 42, Math.min(32, w * 0.12), '#fff', 'center', 5);
      outlined(c.sub, 0, ty + 64, 13, c.col, 'center', 3);
      if (h > 300) { ctx.fillStyle = 'rgba(255,255,255,.78)'; ctx.font = `${Math.min(15, w * 0.055)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(c.desc, 0, ty + 90); }
      outlined(best, 0, h / 2 - 16, 15, '#ffd86a', 'center', 3);
    } else {
      const tx = pr.x + pr.w + 14, ty = -h / 2;
      outlined(c.title, tx, ty + Math.min(40, h * 0.3), Math.min(28, h * 0.2), '#fff', 'left', 5);
      outlined(c.sub, tx, ty + Math.min(60, h * 0.45), 12, c.col, 'left', 3);
      ctx.fillStyle = 'rgba(255,255,255,.78)'; ctx.font = `13px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(c.desc, tx, ty + Math.min(84, h * 0.65));
      outlined(best, tx, h / 2 - 12, 13, '#ffd86a', 'left', 3);
    }
    ctx.restore();
  }

  Arcade.register({
    id: 'hub', title: '메인 메뉴', noVignette: false,
    enter() {
      t0 = T; picked = -1; gone = false; hover = -1; layout();
      bests = GAMES.map(g => Arcade.best(g.id));
      if (!stars.length) for (let i = 0; i < 140; i++) stars.push({ x: Math.random(), y: Math.random(), s: rand(0.5, 1.8), p: rand(0, 6), f: rand(1, 3) });
    },
    onResize: layout,
    update(dt, rdt) {
      for (let i = 0; i < cards.length; i++) {
        const c = cards[i], on = focus === i ? 1 : 0;
        c.hk = damp(c.hk, on, 10, rdt);
        let nx = 0, ny = 0;
        if (hover === i) { nx = clamp((M.x - c.x - c.w / 2) / (c.w / 2), -1, 1); ny = clamp((M.y - c.y - c.h / 2) / (c.h / 2), -1, 1); }
        c.tx = damp(c.tx, nx, 8, rdt); c.ty = damp(c.ty, ny, 8, rdt);
      }
      if (picked >= 0) { pickT += rdt; if (pickT >= 0.3 && !gone) { gone = true; const c = cards[picked]; Arcade.go(c.id, { x: c.x + c.w / 2, y: c.y + c.h / 2, col: c.col }); } }
      riseT -= rdt;
      if (riseT <= 0) { riseT = 0.06; FX.add({ type: 'glow', x: rand(0, W), y: H + 10, vx: rand(-10, 10), vy: rand(-140, -60), life: rand(3, 6), s: rand(1.5, 3.5), dr: 1, g: 0, col: hsl(rand(280, 340), 100, 70) }); }
    },
    render() {
      drawBG();
      Arcade.pushCam();
      FX.draw();
      drawTitle();
      cards.forEach((c, i) => { if (i !== focus) drawCard(c, i); });
      if (cards[focus]) drawCard(cards[focus], focus);
      Arcade.popCam();
      ctx.globalAlpha = 0.75;
      outlined(W < 600 ? '탭해서 선택' : '←/→ 선택 · Enter 시작 · 게임 중 Esc = 메뉴, P = 일시정지', W / 2, H - 16, 14, '#fff', 'center', 3);
      ctx.globalAlpha = 1;
    },
    onMove(x, y) {
      const h = cardAt(x, y);
      if (h !== hover && h >= 0 && picked < 0) { AU.tone(900, 1100, 0.04, 'sine', 0.05); focus = h; }
      hover = h;
    },
    onDown(x, y) { const h = cardAt(x, y); if (h >= 0) pick(h); },
    onKey(code, down) {
      if (!down || picked >= 0) return;
      if (code === 'ArrowLeft' || code === 'ArrowUp') { focus = (focus + 2) % 3; AU.click(); }
      else if (code === 'ArrowRight' || code === 'ArrowDown') { focus = (focus + 1) % 3; AU.click(); }
      else if (code === 'Enter' || code === 'Space') pick(focus);
      else if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3') pick(+code.slice(-1) - 1);
    },
  });
})();
