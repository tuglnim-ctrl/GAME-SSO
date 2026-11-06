"use strict";
// =====================================================================
//  게임 2: 비트 러시 (리듬)
//  음악은 WebAudio로 실시간 합성, 노트는 오디오 시계(AC.currentTime) 기준으로 배치
// =====================================================================
(() => {
  const KEYS = [['KeyD', 'ArrowLeft'], ['KeyF', 'ArrowDown'], ['KeyJ', 'ArrowUp'], ['KeyK', 'ArrowRight']];
  const LBL = ['D', 'F', 'J', 'K'];
  const LC = ['#3ad0ff', '#7cff6b', '#ffc23a', '#ff4fd8'];
  const JUDGE = [
    { txt: 'PERFECT', col: '#7dfcff', win: 0.05, pts: 300, hp: 2, fv: 8 },
    { txt: 'GREAT', col: '#7cff6b', win: 0.1, pts: 200, hp: 1, fv: 5 },
    { txt: 'GOOD', col: '#ffc23a', win: 0.15, pts: 100, hp: 0.5, fv: 2 },
  ];
  const BASS = [55, 43.65, 65.41, 49];            // A F C G
  const LEAD = [440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  const COUNT_BARS = 2;

  let bus = null, notes, kicks, evs, nextStep, stepIdx, bpm, approach, rng, lastLane;
  let hp, score, shownScore, combo, maxCombo, fever, feverT, counts, held, laneFlash, recep, judge, comboBump, state, deadT, lastKick, pointerLanes, spectrum;
  let lw, lx0, hitY;

  function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function geom() { lw = clamp((W - 40) / 4, 60, 100); lx0 = W / 2 - lw * 2; hitY = H - 110; }
  const level = bar => Math.max(0, Math.floor((bar - COUNT_BARS) / 8));

  // ---------- 악기 ----------
  const kick = tm => { AU.tone(160, 40, 0.3, 'sine', 0.9, tm, bus); AU.noise(0.03, 4000, 1000, 0.15, tm, bus); };
  const snare = tm => { AU.noise(0.18, 5000, 1500, 0.35, tm, bus, 'highpass'); AU.tone(240, 160, 0.1, 'triangle', 0.25, tm, bus); };
  const hat = (tm, v) => AU.noise(0.045, 9000, 7000, v, tm, bus, 'highpass');
  const bass = (f, tm, d) => AU.tone(f, f, d, 'sawtooth', 0.22, tm, bus, 900);

  function playStep(st, bar, tm) {
    const lvl = level(bar), stepDur = 60 / bpm / 4, chord = BASS[bar % 4];
    if (st % 8 === 0 || (lvl >= 1 && st === 10) || (lvl >= 2 && st === 14 && rng() < 0.5)) {
      kick(tm); kicks.push(tm);
    }
    if (st === 4 || st === 12) snare(tm);
    if (lvl >= 2 ? true : st % 2 === 0) hat(tm, st % 4 === 2 ? 0.1 : 0.05);
    if ([0, 3, 6, 8, 11, 14].includes(st)) bass(chord * (st === 14 ? 2 : 1), tm, stepDur * 1.8);
    if (bar < COUNT_BARS && st % 4 === 0) {
      const beat = bar * 4 + st / 4;
      const txt = beat < 4 ? (beat === 0 ? 'READY' : '') : ['3', '2', '1', 'GO!'][beat - 4];
      if (txt) evs.push({ t: tm, f: () => { FX.text(W / 2, H * 0.4, txt, txt === 'GO!' ? '#7dfcff' : '#fff', txt === 'READY' ? 64 : 110, 0.55, 0); AU.tone(txt === 'GO!' ? 1320 : 880, txt === 'GO!' ? 1320 : 880, 0.12, 'square', 0.05); } });
    }
  }
  function genNotes(st, bar, tm) {
    const lvl = level(bar);
    let p = st % 4 === 0 ? 0.82 : st % 2 === 0 ? 0.2 + lvl * 0.12 : (lvl >= 2 ? 0.05 + (lvl - 2) * 0.05 : 0);
    p = Math.min(p, 0.85);
    if (rng() < p) {
      let lane = Math.floor(rng() * 4);
      if (lane === lastLane && rng() < 0.6) lane = (lane + 1 + Math.floor(rng() * 3)) % 4;
      lastLane = lane; addNote(lane, tm);
      if (st === 0 && lvl >= 1 && rng() < 0.35) addNote((lane + 2) % 4, tm);
    }
  }
  function addNote(l, tm) {
    const f = LEAD[(l * 2 + Math.floor(rng() * 3)) % LEAD.length];
    notes.push({ l, t: tm, ap: approach, done: false });
    AU.tone(f, f, 0.14, 'square', 0.045, tm, bus, 3000);
  }
  function schedule() {
    const now = AU.now();
    while (nextStep < now + approach + 0.25) {
      const st = stepIdx % 16, bar = Math.floor(stepIdx / 16), tm = nextStep;
      playStep(st, bar, tm);
      if (bar >= COUNT_BARS) genNotes(st, bar, tm);
      stepIdx++;
      if (stepIdx % 16 === 0) {
        const nb = stepIdx / 16;
        if (nb > COUNT_BARS && (nb - COUNT_BARS) % 8 === 0 && bpm < 176) {
          bpm = Math.min(176, bpm + 8); approach = Math.max(0.85, approach - 0.08);
          const b2 = bpm;
          evs.push({ t: nextStep + 60 / bpm / 4, f: () => { FX.text(W / 2, H * 0.3, `SPEED UP!  BPM ${b2}`, '#ffd23a', 40, 1.4); S.punch += 0.04; } });
        }
      }
      nextStep += 60 / bpm / 4;
    }
  }

  // ---------- 판정 ----------
  function press(l) {
    held[l] = true; laneFlash[l] = 1; recep[l] = 1;
    if (state !== 'play') return;
    const now = AU.now();
    let best = null, bd = 1;
    for (const n of notes) { if (n.done || n.l !== l) continue; const d = Math.abs(n.t - now); if (d < bd) { bd = d; best = n; } }
    if (best && bd <= JUDGE[2].win) { best.done = true; hit(best, bd <= JUDGE[0].win ? 0 : bd <= JUDGE[1].win ? 1 : 2); }
  }
  function laneX(l) { return lx0 + l * lw + lw / 2; }
  function hit(n, j) {
    const J = JUDGE[j], x = laneX(n.l);
    counts[j]++; combo++; comboBump = 1; maxCombo = Math.max(maxCombo, combo);
    const pts = Math.round(J.pts * (1 + Math.min(combo, 100) / 50) * (feverT > 0 ? 2 : 1));
    score += pts; hp = Math.min(100, hp + J.hp);
    if (feverT <= 0) { fever = Math.min(100, fever + J.fv); if (fever >= 100) startFever(); }
    judge = { txt: J.txt, col: J.col, t: 0 };
    FX.sparks(x, hitY, j === 0 ? 22 : 12, { dir: -Math.PI / 2, spread: 1.1, min: 200, max: 700, col: LC[n.l], g: 600 });
    FX.ring(x, hitY, lw * 0.9, 0.35, j === 0 ? 6 : 3, j === 0 ? '#ffffff' : LC[n.l]);
    FX.flash(x, hitY, lw * 1.2, 0.15, j === 0 ? '200,255,255' : '255,255,255');
    if (j === 0) { FX.glow(x, hitY, 8, LC[n.l], { max: 250 }); S.punch += 0.006; }
    if (combo % 50 === 0) { FX.text(W / 2, H * 0.32, combo + ' COMBO!', '#ffd23a', 56, 1.2); S.punch += 0.03; }
  }
  function miss(n) {
    n.done = true; counts[3]++;
    if (combo >= 10) FX.text(W / 2, H * 0.45, 'COMBO BREAK', '#ff4f6b', 30, 0.8);
    combo = 0; hp -= 9; judge = { txt: 'MISS', col: '#ff4f6b', t: 0 };
    S.red = Math.max(S.red, 0.35); S.shake = Math.min(30, S.shake + 4);
    FX.sparks(laneX(n.l), hitY, 6, { col: '#f55', g: 800 });
    if (hp <= 0) die();
  }
  function startFever() {
    feverT = 8; fever = 100;
    FX.text(W / 2, H * 0.35, 'FEVER!!', '#ff5aff', 84, 1.4); S.punch += 0.06; S.flash = 0.5;
    AU.tone(400, 1600, 0.6, 'sawtooth', 0.08, 0, bus, 4000);
  }
  function die() {
    hp = 0; state = 'dead'; deadT = 0;
    if (bus && AU.ac) { bus.gain.cancelScheduledValues(AU.ac.currentTime); bus.gain.setTargetAtTime(0, AU.ac.currentTime, 0.4); }
    AU.tone(300, 40, 1.4, 'sawtooth', 0.2, 0, null, 1500);
    S.shake = 20; S.red = 1;
    for (let l = 0; l < 4; l++) FX.sparks(laneX(l), hitY, 15, { col: LC[l], g: 900 });
  }

  // ---------- 그리기 ----------
  function drawBG(pulse, fv) {
    const hue = fv ? (T * 120) % 360 : 275;
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, hsl(hue, 60, 7 + pulse * 4)); g.addColorStop(1, hsl(hue + 40, 70, 4));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 스펙트럼 바
    const n = 48, bwid = W / n;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      spectrum[i] = damp(spectrum[i], (0.25 + 0.75 * Math.abs(Math.sin(i * 0.7 + T * 2.3) * Math.cos(i * 0.31 - T * 1.7))) * (0.3 + pulse * 0.9), 12, 1 / 60);
      const h = spectrum[i] * H * 0.35, col = fv ? hsl(i * 8 + T * 200, 100, 60, 0.35) : hsl(280 + i * 2, 90, 60, 0.22);
      ctx.fillStyle = col; ctx.fillRect(i * bwid + 1, H - h, bwid - 2, h); ctx.fillRect(i * bwid + 1, 0, bwid - 2, h * 0.5);
    }
    // 원형 펄스
    const cx = W / 2, cy = H * 0.4;
    for (let k = 0; k < 3; k++) {
      const r = (Math.min(W, H) * 0.25) * (1 + k * 0.45) * (1 + pulse * 0.08);
      ctx.strokeStyle = fv ? hsl(T * 150 + k * 60, 100, 65, 0.25) : `rgba(255,80,220,${0.08 + pulse * 0.12})`; ctx.lineWidth = 2 + pulse * 3;
      circle(cx, cy, r); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    if (fv) {
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 36; i++) { const a = i / 36 * TAU + T * 0.4, r1 = Math.max(W, H) * (0.4 + Math.random() * 0.1), r2 = Math.max(W, H); ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); }
      ctx.stroke();
    }
  }
  function drawLanes(now, pulse, fv) {
    // 레인 배경
    ctx.fillStyle = 'rgba(5,2,15,.7)'; rr(lx0 - 6, -10, lw * 4 + 12, H + 20, 10); ctx.fill();
    for (let l = 0; l < 4; l++) {
      const x = lx0 + l * lw;
      ctx.fillStyle = l % 2 ? 'rgba(255,255,255,.025)' : 'rgba(255,255,255,.05)'; ctx.fillRect(x, 0, lw, H);
      if (laneFlash[l] > 0.01) {
        const g = ctx.createLinearGradient(0, hitY, 0, hitY - H * 0.6); g.addColorStop(0, rgba(LC[l], 0.45 * laneFlash[l])); g.addColorStop(1, rgba(LC[l], 0));
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x, hitY - H * 0.6, lw, H * 0.6); ctx.globalCompositeOperation = 'source-over';
      }
      ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    // 판정선
    ctx.shadowColor = fv ? hsl(T * 200, 100, 70) : '#ff4fd8'; ctx.shadowBlur = 15 + pulse * 25;
    ctx.fillStyle = fv ? hsl(T * 200, 100, 80) : `rgba(255,255,255,${0.7 + pulse * 0.3})`; ctx.fillRect(lx0, hitY - 2, lw * 4, 4);
    ctx.shadowBlur = 0;
    // 노트
    const dist = hitY + 40;
    for (const n of notes) {
      if (n.done) continue;
      const y = hitY - (n.t - now) / n.ap * dist;
      if (y < -40) continue;
      const x = lx0 + n.l * lw, col = fv ? hsl(T * 200 + n.l * 90, 100, 65) : LC[n.l];
      if (fv) for (let g = 3; g >= 1; g--) { ctx.globalAlpha = 0.15 * (4 - g) / 3; ctx.fillStyle = col; rr(x + 7, y - 11 - g * 16, lw - 14, 22, 8); ctx.fill(); }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(LC[n.l], 0.25); rr(x + 2, y - 15, lw - 4, 30, 12); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      const g = ctx.createLinearGradient(0, y - 11, 0, y + 11); g.addColorStop(0, '#fff'); g.addColorStop(0.35, col); g.addColorStop(1, rgba(LC[n.l], 0.7));
      ctx.fillStyle = g; rr(x + 7, y - 11, lw - 14, 22, 8); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; rr(x + 14, y - 2, lw - 28, 4, 2); ctx.fill();
    }
    // 키 버튼
    for (let l = 0; l < 4; l++) {
      const x = lx0 + l * lw + lw / 2, p = recep[l], pressed = held[l];
      ctx.save(); ctx.translate(x, hitY + 42 + (pressed ? 4 : 0)); const s = 1 - p * 0.12 + (pressed ? 0 : 0); ctx.scale(s, s);
      ctx.shadowColor = LC[l]; ctx.shadowBlur = pressed ? 30 : 8;
      ctx.fillStyle = pressed ? LC[l] : 'rgba(30,20,50,.95)'; rr(-lw / 2 + 8, -22, lw - 16, 44, 12); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = LC[l]; ctx.lineWidth = 2.5; rr(-lw / 2 + 8, -22, lw - 16, 44, 12); ctx.stroke();
      ctx.textBaseline = 'middle'; outlined(LBL[l], 0, 2, 22, pressed ? '#111' : '#fff', 'center', pressed ? 0 : 3, pressed ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,.8)'); ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }
  }
  function drawHUD(fv) {
    // 콤보 (레인 뒤 중앙)
    if (combo >= 3) {
      const s = 1 + comboBump * 0.35;
      ctx.save(); ctx.translate(W / 2, H * 0.36); ctx.scale(s, s); ctx.globalAlpha = 0.85;
      ctx.textBaseline = 'middle';
      outlined(String(combo), 0, 0, Math.min(110, W * 0.18), fv ? hsl(T * 200, 100, 70) : '#fff', 'center', 8);
      outlined('COMBO', 0, Math.min(62, W * 0.1), 20, '#ffd86a', 'center', 4);
      ctx.restore(); ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
    }
    // 판정 텍스트
    if (judge && judge.t < 0.6) {
      const k = judge.t, s = easeOutElastic(Math.min(1, k / 0.35)) * (1 + (judge.txt === 'PERFECT' ? Math.sin(T * 30) * 0.03 : 0));
      ctx.save(); ctx.translate(W / 2, hitY - 150); ctx.scale(s, s); ctx.globalAlpha = Math.min(1, (0.6 - k) / 0.2);
      ctx.shadowColor = judge.col; ctx.shadowBlur = 20;
      ctx.textBaseline = 'middle'; outlined(judge.txt, 0, 0, 44, judge.col, 'center', 6); ctx.textBaseline = 'alphabetic';
      ctx.restore(); ctx.globalAlpha = 1;
    }
    // 점수
    outlined(Math.round(shownScore).toLocaleString(), W - 20, 46, 32, '#fff', 'right');
    outlined('SCORE', W - 20, 64, 12, '#ff9af0', 'right', 3);
    outlined(`BPM ${bpm}`, 130, 34, 18, '#fff', 'left', 3);
    outlined(`LV ${level(Math.floor(stepIdx / 16)) + 1}`, 130, 56, 14, '#ffd86a', 'left', 3);
    // HP 바
    const hw = Math.min(260, W * 0.35), hx = W / 2 - hw / 2, hy = 22;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; rr(hx - 3, hy - 3, hw + 6, 18, 8); ctx.fill();
    const hc = hp > 50 ? '#7cff6b' : hp > 25 ? '#ffc23a' : (Math.sin(T * 12) > 0 ? '#ff4f6b' : '#a01030');
    if (hp > 0) { ctx.fillStyle = hc; rr(hx, hy, Math.max(10, hw * hp / 100), 12, 6); ctx.fill(); }
    // 피버 게이지 (세로)
    const gx = lx0 + lw * 4 + 18, gh = hitY - 120, gy = 100;
    if (gx + 20 < W) {
      ctx.fillStyle = 'rgba(0,0,0,.5)'; rr(gx, gy, 14, gh, 7); ctx.fill();
      const v = feverT > 0 ? feverT / 8 : fever / 100;
      const g = ctx.createLinearGradient(0, gy + gh, 0, gy); g.addColorStop(0, '#ff4fd8'); g.addColorStop(1, '#ffd23a');
      ctx.fillStyle = feverT > 0 ? hsl(T * 300, 100, 65) : g; rr(gx, gy + gh * (1 - v), 14, Math.max(8, gh * v), 7); ctx.fill();
      ctx.save(); ctx.translate(gx + 7, gy - 12); ctx.textBaseline = 'middle'; outlined('FEVER', 0, 0, 12, feverT > 0 ? '#fff' : '#ff9af0', 'center', 3); ctx.restore();
      ctx.textBaseline = 'alphabetic';
    }
    if (feverT > 0) {
      ctx.save(); ctx.translate(W / 2, 90); const s = 1 + Math.sin(T * 12) * 0.08; ctx.scale(s, s);
      outlined('★ FEVER x2 ★', 0, 0, 26, hsl(T * 300, 100, 70), 'center', 4); ctx.restore();
    }
  }

  Arcade.register({
    id: 'rhythm', title: '비트 러시', noVignette: false,
    enter() {
      geom(); AU.init();
      if (AU.ac) { bus = AU.ac.createGain(); bus.gain.value = 0.9; bus.connect(AU.master); }
      notes = []; kicks = []; evs = []; bpm = 112; approach = 1.5; stepIdx = 0; lastLane = -1; lastKick = -9;
      rng = mulberry32((Math.random() * 1e9) | 0);
      nextStep = AU.now() + 0.5;
      hp = 100; score = 0; shownScore = 0; combo = 0; maxCombo = 0; fever = 0; feverT = 0; counts = [0, 0, 0, 0];
      held = [false, false, false, false]; laneFlash = [0, 0, 0, 0]; recep = [0, 0, 0, 0]; judge = null; comboBump = 0;
      state = 'play'; deadT = 0; pointerLanes = {}; spectrum = new Array(48).fill(0);
    },
    exit() {
      if (bus && AU.ac) { const b = bus; b.gain.cancelScheduledValues(AU.ac.currentTime); b.gain.setTargetAtTime(0, AU.ac.currentTime, 0.03); setTimeout(() => { try { b.disconnect(); } catch (e) { } }, 400); }
      bus = null;
    },
    onPause(p) { if (!AU.ac) return; if (p) AU.ac.suspend(); else AU.ac.resume(); },
    onResize: geom,
    update(dt, rdt) {
      geom();
      const now = AU.now();
      if (state === 'play') {
        schedule();
        for (const n of notes) if (!n.done && now - n.t > JUDGE[2].win) { miss(n); if (state !== 'play') break; }
        notes = notes.filter(n => !n.done);
        if (feverT > 0) { feverT -= rdt; if (feverT <= 0) { fever = 0; FX.text(W / 2, H * 0.3, 'FEVER END', '#ff9af0', 28, 0.8); } }
      } else if (state === 'dead') {
        deadT += rdt;
        if (deadT > 1.2 && !Arcade.over) Arcade.gameOver(score, [`PERFECT ${counts[0]} · GREAT ${counts[1]} · GOOD ${counts[2]} · MISS ${counts[3]}`, `최고 콤보 ${maxCombo}  ·  최고 BPM ${bpm}`]);
      }
      for (const e of evs) if (!e.done && now >= e.t) { e.done = true; if (state === 'play') e.f(); }
      evs = evs.filter(e => !e.done);
      while (kicks.length && kicks[0] <= now) { lastKick = kicks.shift(); if (state === 'play') S.punch += 0.012; }
      for (let l = 0; l < 4; l++) { laneFlash[l] = held[l] ? Math.max(laneFlash[l], 0.6) : laneFlash[l] * Math.pow(0.002, rdt); recep[l] *= Math.pow(0.0005, rdt); }
      if (judge) judge.t += rdt;
      comboBump *= Math.pow(0.003, rdt);
      shownScore = damp(shownScore, score, 12, rdt); if (Math.abs(shownScore - score) < 1) shownScore = score;
    },
    render() {
      const now = AU.now(), pulse = Math.exp(-Math.max(0, now - lastKick) * 7), fv = feverT > 0;
      drawBG(state === 'play' ? pulse : 0, fv);
      Arcade.pushCam(W / 2, hitY);
      drawLanes(now, pulse, fv);
      FX.draw();
      Arcade.popCam();
      drawHUD(fv);
      if (stepIdx < COUNT_BARS * 16 + 8) {
        ctx.globalAlpha = 0.85;
        outlined(W < 600 ? '레인을 탭하세요' : 'D  F  J  K  (또는 ← ↓ ↑ →)  키로 연주!', W / 2, hitY - 210, 18, '#fff', 'center', 4);
        ctx.globalAlpha = 1;
      }
    },
    debug() { return { state, notes, bpm, hp, score, combo, counts, stepIdx }; },
    onKey(code, down, e) {
      const l = KEYS.findIndex(k => k.includes(code)); if (l < 0) return;
      if (down) { if (!e.repeat) press(l); } else held[l] = false;
    },
    onDown(x, y, e) {
      if (y < H * 0.25) return;
      const l = Math.floor((x - lx0) / lw); if (l < 0 || l > 3) return;
      pointerLanes[e.pointerId] = l; press(l);
    },
    onUp(x, y, e) { const l = pointerLanes && pointerLanes[e.pointerId]; if (l != null) { held[l] = false; delete pointerLanes[e.pointerId]; } },
  });
})();
