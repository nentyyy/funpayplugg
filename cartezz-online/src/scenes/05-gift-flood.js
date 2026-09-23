/*
 * 05 gift-flood — "Dozens"
 * Global T 8.000 – 9.333 (bar 4, beats 1–2), screen plate, hard cut in from 04.
 *
 * G1 under a flood. Notification pills pour in on every 16th (bursts growing 1, 2, 3, 4, 5, 6, 8, 10: 39 new
 * pills on top of 04's last one), each carrying one of the four profile gifts. They form a fanned, slightly
 * perspective cascade: the newest sits at y 300, full size; each older one is pushed further down, smaller,
 * rotated a little further out of line and darker, sinking into the black below the header.
 * The count badge escalates 4 -> 12 (8.333) -> 48 (8.667) -> 99+ (9.0) -> 999+ (9.167); bubbles g5 and g6 bloom at
 * 8.333 and 8.667. Camera: slow push x1.0 -> 1.06 about the avatar (540, 540), inOutSine.
 * Layers, back to front (all under the push):
 *   1. the G1 profile, all six bubbles
 *   2. 04's history lines, fading under the flood
 *   3. focus rings on g5 / g6
 *   4. the pill cascade, deepest first (void underlay + kit.notif at depth brightness), arrival rim light
 *   5. the light building over the header (violet glow, one per burst)
 *   6. the count badge, growing a little with every jump
 * The cascade layout (floodLayout) is copied verbatim into 06, which sweeps it away.
 */
(function () {
  'use strict';
  const ID = 'gift-flood';
  const FILM = window.FILM;
  const LIB = FILM.lib;
  const P = LIB.pal;
  const E = LIB.ease;
  const K = FILM.kit;
  const FR = 1 / 24;
  const TAU = Math.PI * 2;
  const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const B = K.B;

  // ---------------------------------------------------------------------------------------------
  // The flood cascade (shared verbatim with 06 gifts-materialize). Shot-local time of 05.
  // ---------------------------------------------------------------------------------------------
  const FLOOD = 'gift-flood';
  const fsd = (...k) => LIB.hash(FLOOD, ...k) & 0x7fffffff;
  const BURSTS = [1, 2, 3, 4, 5, 6, 8, 10]; // one burst on every 16th, T 8.000 .. 9.167
  const GIFT_CYCLE = ['bowtie', 'capPurple', 'tama', 'capWhite'];
  const PILLS = (() => {
    const out = [{ a: -1, gift: 'capWhite', side: 0, seed: 43 }]; // 04's last notification
    const r = LIB.rng(fsd('pills'));
    BURSTS.forEach((n, bi) => {
      for (let j = 0; j < n; j++) {
        const g = GIFT_CYCLE[(Math.floor(r() * 4) + out.length) % 4];
        out.push({ a: bi * (B / 4), gift: g, side: r() * 2 - 1, seed: fsd('p', out.length) % 997, burst: bi, j, n });
      }
    });
    return out;
  })();
  const shiftU = (t, a) => (t < a - 1e-6 ? 0 : E.outCubic(clamp((t - a) / (4 * FR) + 1 / 4)));
  /** Pill placements at 05-local time t, deepest first: { x, y, rot, sc, sq, bright, glow, gift, seed, arrive, a }. */
  function floodLayout(t) {
    const out = [];
    const N = PILLS.length;
    // depth = how many pills have landed on top of this one (eased per burst)
    const burstU = BURSTS.map((n, bi) => shiftU(t, bi * (B / 4)));
    for (let i = 0; i < N; i++) {
      const p = PILLS[i];
      if (p.a > t + 1e-6) continue;
      let d = 0;
      for (let bi = 0; bi < BURSTS.length; bi++) {
        const a = bi * (B / 4);
        if (a <= p.a + 1e-6) continue;
        d += BURSTS[bi] * burstU[bi];
      }
      // within its own burst, later pills sit in front
      if (p.a >= 0) d += (p.n - 1 - p.j) * burstU[p.burst];
      const arrive = p.a < 0 ? 1 : burstU[p.burst];
      const depthK = 1 - Math.exp(-d / 14);
      let x = 540 + p.side * 52 * Math.sqrt(d);
      let y = 300 + 900 * depthK;
      const rot = p.side * 0.034 * Math.sqrt(d);
      const sc = 0.5 + 0.5 * Math.exp(-d / 11);
      const sq = 1 - 0.3 * (1 - Math.exp(-d / 9));
      const bright = Math.exp(-d / 7);
      // entering from above the frame
      if (arrive < 1) {
        const ey = -170 - (p.n - 1 - p.j) * 36;
        const ex = x + p.side * 90;
        x = lerp(ex, x, arrive);
        y = lerp(ey, y, arrive);
      }
      out.push({ x, y, rot, sc, sq, bright, d, glow: Math.exp(-d / 2.2), gift: p.gift, seed: p.seed, arrive, a: p.a });
    }
    out.sort((u, v) => v.d - u.d);
    return out;
  }
  const PILL_W = 620, PILL_H = PILL_W * 0.168;
  function drawPill(ctx, q, alphaMul = 1) {
    // the tail of the cascade fades out into the dark
    const a = clamp((40 - q.d) / 12) * alphaMul;
    if (a < 0.015) return;
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.rotate(q.rot);
    ctx.scale(q.sc, q.sc * q.sq);
    ctx.globalAlpha *= a;
    if (q.bright > 0.03) K.notif(ctx, 0, 0, PILL_W, { gift: q.gift, alpha: 1, glow: q.glow > 0.05 ? q.glow * 1.4 : 0, seed: q.seed });
    // older cards dim: their content sinks into the card's own dark tile
    ctx.beginPath();
    K.rrect(ctx, -PILL_W / 2, -PILL_H / 2, PILL_W, PILL_H, PILL_H / 2);
    if (q.bright <= 0.03) {
      ctx.fillStyle = P.tile;
      ctx.fill();
    } else if (q.bright < 1) {
      ctx.fillStyle = K.css(P.tile, 0.92 * (1 - q.bright));
      ctx.fill();
    }
    if (q.bright < 0.8) {
      ctx.strokeStyle = K.css(P.steelEdge, 0.35 + 0.5 * q.bright);
      ctx.lineWidth = 1.5 / q.sc;
      ctx.stroke();
    }
    ctx.restore();
  }
  /** The pool of darkness the old cards sink into (grows with the flood, 0..1). */
  function sinkDark(ctx, k) {
    if (k <= 0.01) return;
    ctx.save();
    ctx.translate(540, 960);
    ctx.scale(1, 0.8);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 640);
    g.addColorStop(0, K.css(P.void, 0.97 * k));
    g.addColorStop(0.55, K.css(P.void, 0.92 * k));
    g.addColorStop(0.8, K.css(P.void, 0.45 * k));
    g.addColorStop(1, K.css(P.void, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-640, -640, 1280, 1280);
    ctx.restore();
  }
  // ---------------------------------------------------------------------------------------------

  // 04's history lines (same geometry as 04's exit)
  function stackLine(ctx, cx, cy, w, a, gift) {
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.beginPath();
    K.rrect(ctx, cx - w / 2, cy - 5, w, 10, 5);
    ctx.fillStyle = K.css(P.steelEdge, 0.95);
    ctx.fill();
    ctx.strokeStyle = K.css(P.ash, 0.7);
    ctx.lineWidth = 1;
    ctx.stroke();
    const warm = gift === 'bowtie' || gift === 'capPurple';
    ctx.fillStyle = warm ? P.glowPink : P.glowSlate;
    ctx.beginPath();
    ctx.arc(cx - w / 2 + 12, cy, 3.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = P.violetMid;
    ctx.beginPath();
    ctx.arc(cx + w / 2 - 10, cy, 2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  const HISTORY = [['tama', 0], ['capPurple', 1], ['bowtie', 2]];

  const COUNTS = [
    { a: 0, s: '4', size: 30 }, //              T 8.000 (held from 04)
    { a: B / 2, s: '12', size: 32 }, //        T 8.333
    { a: B, s: '48', size: 35 }, //            T 8.667
    { a: 1.5 * B, s: '99+', size: 38 }, //     T 9.000
    { a: 1.75 * B, s: '999+', size: 42 }, //   T 9.167
  ];
  const BLOOMS = [
    { a: B / 2, i: 4 }, //  g5 bow tie, T 8.333
    { a: B, i: 5 }, //      g6 tamagotchi, T 8.667
  ];

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const t = clamp(tIn, 0, info.dur);
      const T = info.shot.start + t;
      const hit = (a, frames, e, lead = 1) =>
        t < a - 1e-6 ? 0 : (e || ((u) => u))(clamp((t - a) / (frames * FR) + lead / frames));
      const since = (a) => (t < a - 1e-6 ? -1 : t - a);

      // ---- camera: push x1.0 -> 1.06 about the avatar ---------------------------------
      const z = 1 + 0.06 * E.inOutSine(t / info.dur);
      ctx.save();
      ctx.translate(540, 540);
      ctx.scale(z, z);
      ctx.translate(-540, -540);

      // 1. profile
      const bl = [1, 1, 1, 1, 0, 0];
      for (const b of BLOOMS) bl[b.i] = hit(b.a, 7, null);
      K.profile(ctx, { T, bubbles: bl });

      // 2. history lines from 04, fading under the flood
      const hA = 1 - hit(0, 8, E.inOutSine);
      for (const [g, k] of HISTORY) stackLine(ctx, 540, 202 - k * 14, 540 - k * 64, hA * clamp(1 - k * 0.24), g);

      // 3. focus rings on the late bubbles
      for (const b of BLOOMS) {
        const s = since(b.a);
        if (s < 0) continue;
        const u = hit(b.a, 3, null);
        const fade = clamp(1 - (s - 6 * FR) / (10 * FR));
        if (fade <= 0.01) continue;
        const bb = K.G1.bubbles[b.i];
        ctx.save();
        ctx.globalAlpha *= fade;
        ctx.strokeStyle = K.css(P.violetMid, 0.9);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(bb.x, bb.y, 76 * (0.7 + 0.3 * E.outBack(u)), 0, TAU);
        ctx.stroke();
        ctx.restore();
      }

      // 5a. light gathering over the header, under the cards
      const build = t / info.dur;
      K.glow(ctx, 540, 330, 360 + 120 * build, P.violetMid, 0.25 + 0.45 * build);

      // 4. the cascade
      ctx.save();
      ctx.beginPath();
      K.rrect(ctx, 30, 140, 1020, 1640, 72);
      ctx.clip();
      const lay = floodLayout(t);
      const sinkK = E.inOutSine(clamp(t / info.dur * 1.4 - 0.12));
      let sunk = false;
      for (const q of lay) {
        // the darkness settles over the deep cards, under the near ones
        if (!sunk && q.d < 9) {
          sinkDark(ctx, sinkK);
          sunk = true;
        }
        drawPill(ctx, q);
      }
      if (!sunk) sinkDark(ctx, sinkK);
      // rim light on the pills that just landed
      for (const q of lay) {
        if (q.a < 0 || q.d > 12) continue;
        const s = since(q.a);
        const rim = Math.exp(-s / 0.12) * q.bright;
        if (rim < 0.03) continue;
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        ctx.scale(q.sc, q.sc * q.sq);
        ctx.strokeStyle = K.css(P.violetHot, 0.8 * rim);
        ctx.lineWidth = 2 / q.sc;
        ctx.beginPath();
        K.rrect(ctx, -PILL_W / 2, -PILL_H / 2, PILL_W, PILL_H, PILL_H / 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      // 5b. one flare per burst at the head of the cascade
      for (let bi = 0; bi < BURSTS.length; bi++) {
        const s = since(bi * (B / 4));
        if (s < 0 || s > 0.4) continue;
        K.glow(ctx, 540, 300, 300 + bi * 14, P.violetMid, (0.25 + bi * 0.05) * Math.exp(-s / 0.1));
      }

      // 6. the count badge
      let c = COUNTS[0];
      for (const cc of COUNTS) if (t >= cc.a - 1e-6) c = cc;
      const pu = c.a > 0 ? hit(c.a, 3, null) : 1;
      const sc = pu < 1 ? [0.72, 1.1, 1][Math.max(0, Math.min(2, Math.round(pu * 3) - 1))] : 1;
      const bx = K.G1.badge.x, by = K.G1.badge.y;
      if (c.a > 0) K.glow(ctx, bx, by, 140 + c.size * 2, P.violetMid, 0.7 * Math.exp(-since(c.a) / 0.2));
      ctx.save();
      ctx.translate(bx, by);
      ctx.scale(sc, sc);
      ctx.translate(-bx, -by);
      K.badge(ctx, bx, by, c.s, c.size, 1);
      ctx.restore();

      ctx.restore();
    },
  });
})();
