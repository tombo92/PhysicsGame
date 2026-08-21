/**
 * bob.js — "Meet Bob", the playable intro to the physics game.
 *
 * Bob is a point mass: no size, no shape, no mass, no friction, and he
 * only moves along one axis. That is the entire model, and it is chosen
 * deliberately — with everything else stripped away, the only things left
 * to notice are position, velocity, and the relationship between them.
 *
 * The intro teaches by letting you act first and reading the explanation
 * afterwards, so each idea arrives as a description of something you have
 * already seen happen.
 *
 *   Act 1  drag Bob            → position is just a number
 *   Act 2  flick Bob           → with no friction, motion never stops
 *   Act 3  watch the x–t graph → the slope of that line *is* velocity
 *   Act 4  hit a timed gate    → solve v = Δx / Δt yourself
 */

(function () {
  'use strict';

  // ── World model ────────────────────────────────────────────────────────
  // Metres and seconds throughout; the renderer converts to pixels.
  const world = {
    x: 0,            // position (m)
    v: 0,            // velocity (m/s)
    t: 0,            // seconds since the current run started
    running: false,
    trail: [],       // [{t, x}] samples for the x–t graph
  };

  const VIEW_HALF_WIDTH = 14;   // metres visible either side of centre
  const MAX_SPEED = 12;         // clamp so a wild flick stays on screen
  const TRAIL_SECONDS = 6;

  let act = 0;
  let canvas, ctx, dpr = 1;
  let dragging = false;
  let dragPointerX = 0;
  let lastDrag = null;          // {x, t} for deriving flick velocity
  let gate = null;              // {x, targetTime} during Act 4
  let gateResult = null;
  let reduceMotion = false;

  // ── Element refs ───────────────────────────────────────────────────────
  const el = {};

  function $(id) { return document.getElementById(id); }

  // ── Physics ────────────────────────────────────────────────────────────
  // Constant velocity, so exact integration — no numerical error to explain.
  function step(dt) {
    if (!world.running) return;
    world.t += dt;
    world.x += world.v * dt;

    world.trail.push({ t: world.t, x: world.x });
    while (world.trail.length && world.t - world.trail[0].t > TRAIL_SECONDS) {
      world.trail.shift();
    }

    if (gate && gateResult === null && world.v !== 0) {
      const reached = world.v > 0 ? world.x >= gate.x : world.x <= gate.x;
      if (reached) judgeGate();
    }

    // Keep Bob in sight during the free-play acts by wrapping the world.
    if (!gate && Math.abs(world.x) > VIEW_HALF_WIDTH) {
      world.x = -Math.sign(world.x) * VIEW_HALF_WIDTH;
      world.trail.length = 0;
    }
  }

  // ── Rendering ──────────────────────────────────────────────────────────
  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function metresToPx(x, w) { return w / 2 + (x / VIEW_HALF_WIDTH) * (w / 2); }

  function draw() {
    if (!ctx) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const axisY = Math.round(h * 0.58);
    ctx.clearRect(0, 0, w, h);

    drawNumberLine(w, axisY);
    if (gate) drawGate(gate, w, axisY);
    drawVelocityArrow(w, axisY);
    drawBob(w, axisY);
    if (act >= 3) drawGraph(w, h);
  }

  function drawNumberLine(w, axisY) {
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, axisY);
    ctx.lineTo(w, axisY);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.34)';
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    for (let m = -VIEW_HALF_WIDTH; m <= VIEW_HALF_WIDTH; m += 2) {
      const px = metresToPx(m, w);
      const major = m % 10 === 0;
      ctx.strokeStyle = major ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.moveTo(px, axisY - (major ? 9 : 5));
      ctx.lineTo(px, axisY + (major ? 9 : 5));
      ctx.stroke();
      if (major) ctx.fillText(m + ' m', px, axisY + 24);
    }
  }

  function drawBob(w, axisY) {
    const px = metresToPx(world.x, w);
    const r = 9;
    if (!reduceMotion) {
      const glow = ctx.createRadialGradient(px, axisY, 0, px, axisY, r * 4);
      glow.addColorStop(0, 'rgba(129,140,248,0.55)');
      glow.addColorStop(1, 'rgba(129,140,248,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px, axisY, r * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#c7d2fe';
    ctx.beginPath();
    ctx.arc(px, axisY, r, 0, Math.PI * 2);
    ctx.fill();

    // The dot is drawn big enough to see, but Bob is a *point* — mark it.
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px - 14, axisY); ctx.lineTo(px + 14, axisY);
    ctx.moveTo(px, axisY - 14); ctx.lineTo(px, axisY + 14);
    ctx.stroke();
  }

  function drawVelocityArrow(w, axisY) {
    if (Math.abs(world.v) < 0.05) return;
    const px = metresToPx(world.x, w);
    const len = Math.min(90, Math.abs(world.v) * 14);
    const dir = Math.sign(world.v);
    const tip = px + dir * len;
    const y = axisY - 30;

    ctx.strokeStyle = '#22d3ee';
    ctx.fillStyle = '#22d3ee';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(px, y);
    ctx.lineTo(tip, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tip, y);
    ctx.lineTo(tip - dir * 9, y - 5);
    ctx.lineTo(tip - dir * 9, y + 5);
    ctx.closePath();
    ctx.fill();

    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('v', (px + tip) / 2, y - 9);
  }

  function drawGate(g, w, axisY) {
    const px = metresToPx(g.x, w);
    const cleared = gateResult && gateResult.ok;
    ctx.strokeStyle = cleared ? '#34d399' : '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px, axisY - 46);
    ctx.lineTo(px, axisY + 46);
    ctx.stroke();
    ctx.fillStyle = cleared ? '#34d399' : '#fbbf24';
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GATE', px, axisY - 54);
  }

  // x–t graph: the whole point of Act 3 is seeing that this is a straight
  // line whose slope is the velocity.
  function drawGraph(w, h) {
    const gx = 14, gy = 14, gw = Math.min(230, w * 0.42), gh = 92;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('x (m)', gx + 8, gy + 14);
    ctx.textAlign = 'right';
    ctx.fillText('t (s)', gx + gw - 8, gy + gh - 7);

    if (world.trail.length < 2) return;
    const t0 = world.trail[0].t, t1 = world.trail[world.trail.length - 1].t;
    const span = Math.max(0.5, t1 - t0);
    const pad = 10;
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    world.trail.forEach((p, i) => {
      const px = gx + pad + ((p.t - t0) / span) * (gw - pad * 2);
      const norm = Math.max(-1, Math.min(1, p.x / VIEW_HALF_WIDTH));
      const py = gy + gh / 2 - norm * (gh / 2 - pad);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.stroke();
  }

  // ── Readouts ───────────────────────────────────────────────────────────
  function updateReadouts() {
    if (el.rx) el.rx.textContent = world.x.toFixed(2);
    if (el.rv) el.rv.textContent = world.v.toFixed(2);
    if (el.rt) el.rt.textContent = world.t.toFixed(1);
  }

  // ── Narrative ──────────────────────────────────────────────────────────
  const ACTS = [
    {
      title: 'This is Bob.',
      body: 'He has no size, no shape and no mass. He is a single point, and the only thing true about him is <em>where</em> he is.',
      hint: 'Drag Bob along the line.',
    },
    {
      title: 'Now give him a push.',
      body: 'Drag him and let go while still moving — a flick. Watch what happens next.',
      hint: 'Flick Bob and release.',
    },
    {
      title: 'He never stops.',
      body: 'Nothing here slows Bob down: no friction, no air, nothing to push back. A moving point with no forces on it keeps exactly the velocity it was given. Forever.',
      hint: 'Flick him again, harder or softer.',
    },
    {
      title: 'That straight line is his velocity.',
      body: 'The graph plots position against time. Bob covers the same distance every second, so it is a straight line — and its steepness <em>is</em> the velocity: <code>v = Δx / Δt</code>.',
      hint: 'Try a few speeds and watch the slope change.',
    },
    {
      title: 'Your turn.',
      body: 'A gate sits at <strong>+10 m</strong>. Send Bob through it in <strong>exactly 4.0 seconds</strong>. You choose the velocity — work out which one gets him there on time.',
      hint: 'Set a velocity, then launch.',
    },
  ];

  function renderAct() {
    const a = ACTS[Math.min(act, ACTS.length - 1)];
    el.title.innerHTML = a.title;
    el.body.innerHTML = a.body;
    el.hint.textContent = a.hint;
    el.next.hidden = act >= ACTS.length - 1;
    el.challenge.hidden = act < 4;
    el.progress.textContent = `${Math.min(act + 1, ACTS.length)} / ${ACTS.length}`;
  }

  function advanceTo(n) {
    if (n <= act) return;
    act = n;
    if (act === 4) startChallenge();
    renderAct();
  }

  // ── Act 4: the gate challenge ──────────────────────────────────────────
  function startChallenge() {
    gate = { x: 10, targetTime: 4 };
    gateResult = null;
    resetBob();
    el.result.hidden = true;
  }

  function resetBob() {
    world.x = 0; world.v = 0; world.t = 0;
    world.running = false;
    world.trail.length = 0;
    updateReadouts();
  }

  function launch() {
    if (!gate) return;
    gateResult = null;
    el.result.hidden = true;
    world.x = 0; world.t = 0;
    world.trail.length = 0;
    world.v = parseFloat(el.vInput.value) || 0;
    world.running = true;
  }

  function judgeGate() {
    const err = Math.abs(world.t - gate.targetTime);
    const ok = err <= 0.12;                 // ±0.12 s — tight but fair
    gateResult = { ok, t: world.t, err };
    world.running = false;

    const exact = gate.x / gate.targetTime;
    el.result.hidden = false;
    el.result.className = 'result ' + (ok ? 'ok' : 'miss');
    el.result.innerHTML = ok
      ? `<strong>Through in ${world.t.toFixed(2)} s.</strong>
         <span>v = Δx / Δt = ${gate.x} m / ${gate.targetTime} s =
         <code>${exact.toFixed(2)} m/s</code></span>
         <span class="next-up">Next, Bob learns to accelerate — and then the line stops being straight.</span>`
      : `<strong>${world.t.toFixed(2)} s — ${world.t < gate.targetTime ? 'too fast' : 'too slow'}.</strong>
         <span>He needs to cover ${gate.x} m in ${gate.targetTime} s. What velocity is that?</span>`;
    updateReadouts();
  }

  // ── Input ──────────────────────────────────────────────────────────────
  function pointerX(ev) {
    const rect = canvas.getBoundingClientRect();
    const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
    return ((cx - rect.width / 2) / (rect.width / 2)) * VIEW_HALF_WIDTH;
  }

  function onDown(ev) {
    if (gate) return;                    // Act 4 uses the slider, not dragging
    dragging = true;
    world.running = false;
    world.v = 0;
    dragPointerX = pointerX(ev);
    lastDrag = { x: dragPointerX, t: performance.now() };
    world.trail.length = 0;
    ev.preventDefault();
  }

  function onMove(ev) {
    if (!dragging) return;
    const x = pointerX(ev);
    world.x = Math.max(-VIEW_HALF_WIDTH, Math.min(VIEW_HALF_WIDTH, x));
    const now = performance.now();
    if (lastDrag && now - lastDrag.t > 12) {
      lastDrag = { x, t: now };
    }
    if (act === 0) advanceTo(1);
    updateReadouts();
    ev.preventDefault();
  }

  function onUp(ev) {
    if (!dragging) return;
    dragging = false;
    const now = performance.now();
    if (lastDrag) {
      const dt = Math.max(0.016, (now - lastDrag.t) / 1000);
      const v = (pointerX(ev.changedTouches ? { clientX: ev.changedTouches[0].clientX } : ev) - lastDrag.x) / dt;
      world.v = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, v));
    }
    world.t = 0;
    world.trail.length = 0;
    world.running = Math.abs(world.v) > 0.05;

    if (world.running && act === 1) {
      // Let the motion speak for itself before explaining it.
      setTimeout(() => advanceTo(2), 2600);
      setTimeout(() => advanceTo(3), 7000);
    }
    updateReadouts();
  }

  // ── Loop ───────────────────────────────────────────────────────────────
  let lastFrame = 0;
  function frame(ts) {
    if (!lastFrame) lastFrame = ts;
    const dt = Math.min(0.05, (ts - lastFrame) / 1000);  // clamp tab-switch jumps
    lastFrame = ts;
    step(dt);
    draw();
    updateReadouts();
    requestAnimationFrame(frame);
  }

  // ── Boot ───────────────────────────────────────────────────────────────
  function init() {
    canvas = $('bob-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    ['title', 'body', 'hint', 'next', 'progress', 'challenge', 'result'].forEach(k => {
      el[k] = $('act-' + k);
    });
    el.rx = $('readout-x');
    el.rv = $('readout-v');
    el.rt = $('readout-t');
    el.vInput = $('v-input');
    el.vOut = $('v-value');

    resize();
    window.addEventListener('resize', resize);

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);

    el.next.addEventListener('click', () => advanceTo(act + 1));
    $('btn-launch').addEventListener('click', launch);
    $('btn-reset').addEventListener('click', () => { resetBob(); el.result.hidden = true; });
    el.vInput.addEventListener('input', () => {
      el.vOut.textContent = parseFloat(el.vInput.value).toFixed(2);
    });

    // Keyboard alternative to dragging, so the intro is not mouse-only.
    canvas.setAttribute('tabindex', '0');
    canvas.addEventListener('keydown', ev => {
      if (gate) return;
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
        world.v = (ev.key === 'ArrowRight' ? 1 : -1) * 3;
        world.running = true;
        world.t = 0;
        world.trail.length = 0;
        if (act <= 1) { advanceTo(2); setTimeout(() => advanceTo(3), 4000); }
        ev.preventDefault();
      }
      if (ev.key === ' ') { world.v = 0; world.running = false; ev.preventDefault(); }
    });

    renderAct();
    updateReadouts();
    requestAnimationFrame(frame);
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();
})();
