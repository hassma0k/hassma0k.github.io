/* Fusecore hero: 6x6 module grid inside the loop track, enemies circling clockwise, a module merge. No libraries. */
(function () {
  var cv = document.getElementById('hero');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var C = { slot: '#1c2430', line: '#2b3645', panel: '#141921', amber: '#ffb21e', gold: '#ffd76a', violet: '#a974ff', red: '#ff3d5f', kin: '#ff8a3d', en: '#3cc8ff', log: '#5be38a' };
  var S = 0, cell = 0, dpr = 1;

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    S = cv.clientWidth;
    cv.width = Math.round(S * dpr);
    cv.height = Math.round(S * dpr);
    cell = S / 8;
    if (reduce) draw(2.6);
  }

  function pathPos(u) {
    u = ((u % 28) + 28) % 28;
    if (u < 7) return [0.5 + u, 0.5];
    if (u < 14) return [7.5, 0.5 + (u - 7)];
    if (u < 21) return [7.5 - (u - 14), 7.5];
    return [0.5, 7.5 - (u - 21)];
  }

  // modules on the 8x8 frame (slots occupy 1..6); type: t triangle, c circle, d diamond
  var mods = [
    [1, 1, 't', 1], [2, 1, 'd', 2], [5, 1, 'c', 2], [6, 2, 't', 1], [1, 3, 'c', 1], [2, 4, 'd', 1],
    [5, 4, 't', 2], [6, 5, 'c', 1], [3, 6, 'd', 2], [5, 6, 't', 1], [4, 5, 'c', 2], [1, 6, 'd', 1]
  ];
  var col = { t: C.kin, c: C.en, d: C.log };

  function shape(x, y, r, type, color) {
    ctx.beginPath();
    if (type === 't') { ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.95, y + r * 0.8); ctx.lineTo(x - r * 0.95, y + r * 0.8); ctx.closePath(); }
    else if (type === 'c') { ctx.arc(x, y, r * 0.95, 0, 6.283); }
    else { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }
    ctx.fillStyle = color; ctx.fill();
  }
  function chevrons(x, y, n) {
    ctx.strokeStyle = '#0b0d11'; ctx.lineWidth = Math.max(1.2, cell * 0.04);
    for (var i = 0; i < n; i++) {
      var yy = y + cell * 0.2 - i * cell * 0.09;
      ctx.beginPath(); ctx.moveTo(x - cell * 0.1, yy + cell * 0.04); ctx.lineTo(x, yy - cell * 0.03); ctx.lineTo(x + cell * 0.1, yy + cell * 0.04); ctx.stroke();
    }
  }
  function mod(cx, cy, type, tier, scale, glow) {
    var x = (cx + 0.5) * cell, y = (cy + 0.5) * cell;
    ctx.fillStyle = '#222c3a'; rr(x - cell * 0.4, y - cell * 0.4, cell * 0.8, cell * 0.8, cell * 0.12); ctx.fill();
    if (tier >= 2) { ctx.strokeStyle = col[type]; ctx.lineWidth = 1.5; rr(x - cell * 0.4, y - cell * 0.4, cell * 0.8, cell * 0.8, cell * 0.12); ctx.stroke(); }
    if (glow) { ctx.shadowColor = col[type]; ctx.shadowBlur = cell * 0.5; }
    shape(x, y - cell * 0.03, cell * 0.24 * (scale || 1), type, col[type]);
    ctx.shadowBlur = 0;
    chevrons(x, y, tier);
  }
  function rr(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function star(x, y, r, t) {
    ctx.save(); ctx.translate(x, y);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.2);
    g.addColorStop(0, 'rgba(255,215,106,' + (0.5 + 0.2 * Math.sin(t * 3)) + ')'); g.addColorStop(1, 'rgba(255,215,106,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 2.2, 0, 6.283); ctx.fill();
    ctx.rotate(t * 0.4); ctx.beginPath();
    for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4, rad = i % 2 ? r * 0.5 : r; ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
    ctx.closePath(); ctx.fillStyle = C.gold; ctx.fill(); ctx.restore();
  }

  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, S, S);
    // track band
    ctx.fillStyle = '#10151c'; rr(0, 0, S, S, cell * 0.4); ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 2;
    for (var k = 0; k < 28; k++) { var p = pathPos(k); ctx.strokeRect(p[0] * cell - cell / 2 + 3, p[1] * cell - cell / 2 + 3, cell - 6, cell - 6); }
    ctx.strokeStyle = 'rgba(255,178,30,.55)'; ctx.lineWidth = 3; rr(1.5, 1.5, S - 3, S - 3, cell * 0.4); ctx.stroke();
    // slots + core ring
    for (var y = 1; y <= 6; y++) for (var x = 1; x <= 6; x++) {
      ctx.fillStyle = C.slot; rr(x * cell + 3, y * cell + 3, cell - 6, cell - 6, cell * 0.1); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,215,106,.35)'; ctx.lineWidth = 2; rr(3 * cell + 1, 3 * cell + 1, 2 * cell - 2, 2 * cell - 2, cell * 0.2); ctx.stroke();
    // breach gate marker top-centre
    ctx.fillStyle = 'rgba(255,61,95,.5)'; ctx.fillRect(4 * cell - cell * 0.35, 2, cell * 0.7, 5);

    // merge cycle (9 s): slide 3.0-3.8, flash 3.8-4.6, merged 4.6-8.2, fade out
    var ph = t % 9, ax = 1, ay = 4, bx = 2, by = 4;
    var slide = ph < 3 ? 0 : ph < 3.8 ? (ph - 3) / 0.8 : 1;
    for (var i = 0; i < mods.length; i++) mod(mods[i][0], mods[i][1], mods[i][2], mods[i][3]);
    mods.forEach(function () {});
    if (ph < 4.4) {
      var e = slide * slide * (3 - 2 * slide);
      if (ph < 3.8) { mod(ax + (bx - ax) * e, ay, 'c', 1); mod(bx, by, 'c', 1); }
      else mod(bx, by, 'c', 1);
    } else if (ph < 8.4) {
      var s = Math.min(1, (ph - 4.4) / 0.4); mod(bx, by, 'c', 2, 1 + 0.25 * (1 - s), true);
    } else mod(bx, by, 'c', 2);
    if (ph > 3.8 && ph < 4.9) {
      var f = (ph - 3.8) / 1.1, cx = (bx + 0.5) * cell, cy = (by + 0.5) * cell;
      ctx.strokeStyle = 'rgba(255,215,106,' + (1 - f) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, cell * (0.3 + f * 1.1), 0, 6.283); ctx.stroke();
    }
    // mythic at the core
    star(4 * cell, 4 * cell, cell * 0.55, t);

    // enemies + beams
    var speed = 1.3;
    for (var n = 0; n < 5; n++) {
      var q = pathPos(t * speed + n * 5.6), px = q[0] * cell, py = q[1] * cell;
      ctx.shadowColor = C.red; ctx.shadowBlur = cell * 0.4; ctx.fillStyle = C.red;
      ctx.beginPath(); ctx.arc(px, py, cell * 0.2, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
      // nearest module beam
      var best = null, bd = 1e9;
      for (var m = 0; m < mods.length; m++) {
        var dx = (mods[m][0] + 0.5) * cell - px, dy = (mods[m][1] + 0.5) * cell - py, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = mods[m]; }
      }
      if (best && bd < cell * cell * 2.8) {
        ctx.strokeStyle = 'rgba(' + (best[2] === 't' ? '255,138,61' : best[2] === 'c' ? '60,200,255' : '91,227,138') + ',.55)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo((best[0] + 0.5) * cell, (best[1] + 0.5) * cell); ctx.lineTo(px, py); ctx.stroke();
      }
    }
  }

  var start = 0;
  function frame(ts) {
    if (!start) start = ts;
    draw((ts - start) / 1000);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', size);
  size();
  if (reduce) draw(2.6); else requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) start = 0; });
})();
