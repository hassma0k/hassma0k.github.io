/* Aegis Grid site: (1) looping maze demo, (2) Arabic suggestion banner. No dependencies. */
(function () {
  'use strict';
  /* ---------- language suggestion (never redirects) ---------- */
  try {
    var bar = document.getElementById('langbar');
    if (bar) {
      var langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']).join(',').toLowerCase();
      var want = bar.getAttribute('data-want');
      var dismissed = false;
      try { dismissed = localStorage.getItem('aegis.langbar') === '1'; } catch (e) {}
      if (!dismissed && langs.split(',').some(function (l) { return l.indexOf(want) === 0; })) bar.className += ' show';
      var x = bar.querySelector('button');
      if (x) x.addEventListener('click', function () {
        bar.className = 'langbar';
        try { localStorage.setItem('aegis.langbar', '1'); } catch (e) {}
      });
    }
  } catch (e) {}

  /* ---------- maze demo ---------- */
  var cv = document.getElementById('demo');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var chip = document.getElementById('demo-chip');
  var lenEl = document.getElementById('demo-len');
  var N = 10;
  var PORTAL = [4, 0];
  var CORE = [[4, 9], [5, 9]];
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // scripted build: four wall rows with alternating gaps; every second piece is a turret
  var plan = [];
  [[2, 9], [4, 0], [6, 9], [8, 0]].forEach(function (row) {
    var r = row[0], gap = row[1], cols = [];
    for (var c = 0; c < N; c++) if (c !== gap) cols.push(c);
    cols.forEach(function (c, i) { plan.push({ c: c, r: r, turret: i % 2 === 1 ? (((c + r) % 3) + 1) : 0 }); });
  });

  var W, H, S;
  function fit() {
    var d = Math.min(window.devicePixelRatio || 1, 2);
    var w = cv.clientWidth || 400;
    cv.width = Math.round(w * d);
    cv.height = Math.round(w * d);
    W = H = cv.width;
    S = W / N;
  }

  var grid, dist, enemies, parts, shots, built, t, nextBuild, nextSpawn, prevPath, prevT, curPath, coreGlow, lastLen;
  function reset() {
    grid = []; for (var i = 0; i < N * N; i++) grid.push(null);
    enemies = []; parts = []; shots = []; built = 0; t = 0; nextBuild = 1.6; nextSpawn = 0.2; prevPath = null; prevT = 0; coreGlow = 0; lastLen = -1;
    solve();
    setLen(true);
  }
  function blocked(c, r) { return c < 0 || r < 0 || c >= N || r >= N || grid[r * N + c] !== null; }
  function isCore(c, r) { return CORE.some(function (k) { return k[0] === c && k[1] === r; }); }
  function solve() {
    dist = []; for (var i = 0; i < N * N; i++) dist.push(-1);
    var q = [];
    CORE.forEach(function (k) { dist[k[1] * N + k[0]] = 0; q.push(k); });
    for (var h = 0; h < q.length; h++) {
      var p = q[h], d = dist[p[1] * N + p[0]];
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (v) {
        var c = p[0] + v[0], r = p[1] + v[1];
        if (blocked(c, r) || dist[r * N + c] >= 0) return;
        dist[r * N + c] = d + 1; q.push([c, r]);
      });
    }
    // path from the portal
    var path = [], c = PORTAL[0], r = PORTAL[1], guard = 0;
    path.push([c, r]);
    while (dist[r * N + c] > 0 && guard++ < 400) {
      var nx = step(c, r, 0);
      if (!nx) break;
      c = nx[0]; r = nx[1]; path.push([c, r]);
    }
    curPath = path;
  }
  function step(c, r, dirPref) {
    var best = null, bd = 1e9, dirs = [[0, 1], [1, 0], [-1, 0], [0, -1]];
    for (var i = 0; i < dirs.length; i++) {
      var nc = c + dirs[i][0], nr = r + dirs[i][1];
      if (nc < 0 || nr < 0 || nc >= N || nr >= N) continue;
      var dd = dist[nr * N + nc];
      if (dd < 0) continue;
      if (dd < bd) { bd = dd; best = [nc, nr]; }
    }
    return best;
  }
  function setLen(force) {
    var n = dist[PORTAL[1] * N + PORTAL[0]];
    if (n === lastLen && !force) return;
    var up = lastLen >= 0 && n > lastLen;
    lastLen = n;
    if (lenEl) lenEl.textContent = n;
    if (chip) chip.className = 'demo-chip' + (up ? ' up' : '');
  }
  function enemyOn(c, r) {
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if ((e.tc === c && e.tr === r) || (Math.floor(e.x) === c && Math.floor(e.y) === r)) return true;
    }
    return false;
  }

  function update(dt) {
    t += dt;
    // build, one piece at a time (skip when an enemy stands there)
    if (built < plan.length && t >= nextBuild) {
      var p = plan[built];
      if (!enemyOn(p.c, p.r)) {
        grid[p.r * N + p.c] = { turret: p.turret, cd: Math.random() * 0.5, born: t };
        prevPath = curPath; prevT = t;
        solve(); setLen();
        built++;
        nextBuild = t + 0.15;
        // enemies re-pick their next tile
        enemies.forEach(function (e) { if (e.tc !== undefined && blocked(e.tc, e.tr)) e.tc = undefined; });
      }
    }
    if (t < 5.4 || built < plan.length || t < 14.5) {
      nextSpawn -= dt;
      if (nextSpawn <= 0 && t < 13.2) {
        var heavy = Math.random() < 0.22;
        enemies.push({ x: PORTAL[0] + 0.5, y: PORTAL[1] + 0.5, hp: heavy ? 6 : 3, max: heavy ? 6 : 3, heavy: heavy, sp: heavy ? 1.9 : 2.7 });
        nextSpawn = 0.55;
      }
    }
    // enemies
    for (var i = enemies.length - 1; i >= 0; i--) {
      var e = enemies[i];
      var cc = Math.floor(e.x), cr = Math.floor(e.y);
      if (e.tc === undefined) {
        var nx = dist[cr * N + cc] > 0 ? step(cc, cr, 0) : null;
        if (!nx) { // at the core
          coreGlow = 1; enemies.splice(i, 1); continue;
        }
        e.tc = nx[0]; e.tr = nx[1];
      }
      var tx = e.tc + 0.5, ty = e.tr + 0.5, dx = tx - e.x, dy = ty - e.y, dl = Math.sqrt(dx * dx + dy * dy), mv = e.sp * dt;
      if (dl <= mv) { e.x = tx; e.y = ty; e.tc = undefined; } else { e.x += (dx / dl) * mv; e.y += (dy / dl) * mv; }
      e.a = Math.atan2(dy, dx);
    }
    // turrets
    for (var k = 0; k < N * N; k++) {
      var g = grid[k];
      if (!g || !g.turret) continue;
      g.cd -= dt;
      if (g.cd > 0) continue;
      var tc = (k % N) + 0.5, tr = Math.floor(k / N) + 0.5, tgt = null, bd = 2.7 * 2.7;
      for (var j = 0; j < enemies.length; j++) {
        var q = enemies[j], ddx = q.x - tc, ddy = q.y - tr, d2 = ddx * ddx + ddy * ddy;
        if (d2 < bd) { bd = d2; tgt = q; }
      }
      if (tgt) {
        g.cd = g.turret === 2 ? 0.7 : 0.38;
        tgt.hp -= g.turret === 2 ? 2 : 1;
        shots.push({ x1: tc, y1: tr, x2: tgt.x, y2: tgt.y, life: 0.12, k: g.turret });
        if (tgt.hp <= 0) {
          for (var b = 0; b < 8; b++) { var an = Math.random() * 6.28, sp = 1 + Math.random() * 2.2; parts.push({ x: tgt.x, y: tgt.y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, life: 0.5, hv: tgt.heavy }); }
          enemies.splice(enemies.indexOf(tgt), 1);
        }
      }
    }
    for (var s = shots.length - 1; s >= 0; s--) { shots[s].life -= dt; if (shots[s].life <= 0) shots.splice(s, 1); }
    for (var pi = parts.length - 1; pi >= 0; pi--) { var pp = parts[pi]; pp.x += pp.vx * dt; pp.y += pp.vy * dt; pp.life -= dt; if (pp.life <= 0) parts.splice(pi, 1); }
    coreGlow = Math.max(0, coreGlow - dt * 2);
    if (t > 16) reset();
  }

  var COL = ['', '#38e1ff', '#a78bfa', '#2a8cff'];
  function poly(n, cx, cy, r, rot) {
    ctx.beginPath();
    for (var i = 0; i < n; i++) { var a = rot + (i * 6.2832) / n; ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    ctx.closePath();
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#080d1f'; ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = Math.max(1, S * 0.02);
    ctx.strokeStyle = '#17244d';
    for (var i = 0; i <= N; i++) { ctx.beginPath(); ctx.moveTo(i * S, 0); ctx.lineTo(i * S, H); ctx.moveTo(0, i * S); ctx.lineTo(W, i * S); ctx.stroke(); }
    // old path (faint) and current path (dashed, marching)
    function trace(path, color, alpha, dash, off) {
      if (!path) return;
      ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = S * 0.09; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (dash) { ctx.setLineDash([S * 0.26, S * 0.2]); ctx.lineDashOffset = off; }
      ctx.shadowColor = color; ctx.shadowBlur = S * 0.25;
      ctx.beginPath();
      path.forEach(function (p, j) { ctx[j ? 'lineTo' : 'moveTo']((p[0] + 0.5) * S, (p[1] + 0.5) * S); });
      ctx.stroke(); ctx.restore();
    }
    if (prevPath && t - prevT < 0.7) trace(prevPath, '#ff4fd8', 0.35 * (1 - (t - prevT) / 0.7), false, 0);
    trace(curPath, '#38e1ff', 0.9, true, -t * S * 1.1);
    // portal + core
    ctx.save(); ctx.strokeStyle = '#ff4fd8'; ctx.shadowColor = '#ff4fd8'; ctx.shadowBlur = S * 0.5; ctx.lineWidth = S * 0.09;
    ctx.beginPath(); ctx.arc((PORTAL[0] + 0.5) * S, (PORTAL[1] + 0.5) * S, S * 0.34, 0, 6.2832); ctx.stroke();
    ctx.beginPath(); ctx.arc((PORTAL[0] + 0.5) * S, (PORTAL[1] + 0.5) * S, S * 0.16 + Math.sin(t * 4) * S * 0.03, 0, 6.2832); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.fillStyle = 'rgba(56,225,255,' + (0.14 + coreGlow * 0.3) + ')'; ctx.strokeStyle = '#38e1ff'; ctx.shadowColor = '#38e1ff'; ctx.shadowBlur = S * (0.4 + coreGlow);
    ctx.lineWidth = S * 0.07; ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(4 * S + S * 0.1, 9 * S + S * 0.14, 2 * S - S * 0.2, S * 0.72, S * 0.18); else ctx.rect(4 * S + S * 0.1, 9 * S + S * 0.14, 2 * S - S * 0.2, S * 0.72);
    ctx.fill(); ctx.stroke(); poly(6, 5 * S, 9.5 * S, S * 0.2, 0); ctx.stroke(); ctx.restore();
    // buildings
    for (var k = 0; k < N * N; k++) {
      var g = grid[k]; if (!g) continue;
      var c = k % N, r = Math.floor(k / N), x = c * S, y = r * S, pop = Math.min(1, (t - g.born) / 0.18), pad = S * (0.1 + 0.2 * (1 - pop));
      ctx.save(); ctx.globalAlpha = pop;
      if (!g.turret) {
        ctx.fillStyle = '#12224f'; ctx.strokeStyle = '#2a8cff'; ctx.lineWidth = S * 0.05; ctx.shadowColor = '#2a8cff'; ctx.shadowBlur = S * 0.15;
        ctx.fillRect(x + pad, y + pad, S - pad * 2, S - pad * 2); ctx.strokeRect(x + pad, y + pad, S - pad * 2, S - pad * 2);
        ctx.strokeStyle = 'rgba(42,140,255,.5)'; ctx.beginPath(); ctx.moveTo(x + pad, y + S - pad); ctx.lineTo(x + S - pad, y + pad); ctx.stroke();
      } else {
        var col = COL[g.turret];
        ctx.fillStyle = '#0d1a3d'; ctx.strokeStyle = col; ctx.lineWidth = S * 0.06; ctx.shadowColor = col; ctx.shadowBlur = S * 0.35;
        ctx.fillRect(x + pad, y + pad, S - pad * 2, S - pad * 2); ctx.strokeRect(x + pad, y + pad, S - pad * 2, S - pad * 2);
        ctx.beginPath(); ctx.arc(x + S / 2, y + S / 2, S * 0.17, 0, 6.2832); ctx.fillStyle = col; ctx.fill();
      }
      ctx.restore();
    }
    // tracers
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    shots.forEach(function (s) { ctx.globalAlpha = Math.min(1, s.life / 0.12); ctx.strokeStyle = COL[s.k]; ctx.lineWidth = S * (s.k === 2 ? 0.09 : 0.06); ctx.shadowColor = COL[s.k]; ctx.shadowBlur = S * 0.3; ctx.beginPath(); ctx.moveTo(s.x1 * S, s.y1 * S); ctx.lineTo(s.x2 * S, s.y2 * S); ctx.stroke(); });
    ctx.restore();
    // enemies
    enemies.forEach(function (e) {
      var cx = e.x * S, cy = e.y * S;
      ctx.save(); ctx.shadowBlur = S * 0.3;
      if (e.heavy) { ctx.fillStyle = 'rgba(255,176,46,.28)'; ctx.strokeStyle = '#ffb02e'; ctx.shadowColor = '#ffb02e'; ctx.lineWidth = S * 0.08; poly(6, cx, cy, S * 0.3, 0); }
      else { ctx.fillStyle = 'rgba(255,79,216,.3)'; ctx.strokeStyle = '#ff4fd8'; ctx.shadowColor = '#ff4fd8'; ctx.lineWidth = S * 0.06; poly(3, cx, cy, S * 0.24, e.a || 1.57); }
      ctx.fill(); ctx.stroke();
      if (e.hp < e.max) { ctx.shadowBlur = 0; ctx.fillStyle = '#16213f'; ctx.fillRect(cx - S * 0.22, cy - S * 0.42, S * 0.44, S * 0.06); ctx.fillStyle = '#5dffb0'; ctx.fillRect(cx - S * 0.22, cy - S * 0.42, S * 0.44 * (e.hp / e.max), S * 0.06); }
      ctx.restore();
    });
    // bursts
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    parts.forEach(function (p) { ctx.globalAlpha = Math.max(0, p.life / 0.5); ctx.fillStyle = p.hv ? '#ffb02e' : '#ff4fd8'; ctx.fillRect(p.x * S - S * 0.04, p.y * S - S * 0.04, S * 0.08, S * 0.08); });
    ctx.restore();
  }

  var running = false, last = 0, visible = true;
  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    update(dt); draw();
    requestAnimationFrame(frame);
  }
  function start() { if (running || reduce) return; running = true; last = performance.now(); requestAnimationFrame(frame); }
  function stop() { running = false; }

  fit(); reset();
  if (reduce) {
    // static final frame: the finished serpentine and its path
    t = 20;
    plan.forEach(function (p) { grid[p.r * N + p.c] = { turret: p.turret, cd: 9, born: -5 }; });
    solve(); setLen(true); draw();
    window.addEventListener('resize', function () { fit(); draw(); });
    return;
  }
  window.addEventListener('resize', function () { fit(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; visible && !document.hidden ? start() : stop(); }, { threshold: 0.05 }).observe(cv);
  } else start();
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : visible && start(); });
})();
