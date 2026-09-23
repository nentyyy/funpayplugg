/*
 * 04 first-gift — "One notification. Then another"
 * Global T 5.333 – 8.000 (bar 3), screen plate, hard cut in from 03.
 *
 * G1 locked (FILM.kit.profile, no camera). Four notifications land under the status row; each carries a gift
 * and makes its gift bubble bloom on the profile; the count badge at (660, 410) counts 1 -> 4.
 *   notif 1  T 5.333  bow tie     -> bubble g2 (kit.G1.bubbles[1])   badge 1   THE moment (dim + ripple + sweep)
 *   notif 2  T 6.667  purple cap  -> bubble g3 ([2])                 badge 2
 *   notif 3  T 7.333  tamagotchi  -> bubble g4 ([3])                 badge 3
 *   notif 4  T 7.667  white cap   -> bubble g1 ([0])                 badge 4
 * A pill drops from behind the phone's top edge (y 150 -> 300, outBack over 4 frames) and, when it is superseded
 * (T 6.000 for the first, else on the next arrival), slides up and compresses into a thin line of the history
 * stack above the status row (y 204, 192, 180).
 * Layers, back to front (everything inside the 3 px, 2-frame arrival jolt):
 *   1. the G1 profile with blooming bubbles (count badge drawn separately, popped)
 *   2. the first-notification dim (the rest of the screen steps back for a beat)
 *   3. focus rings around newly bloomed bubbles
 *   4. the history stack lines, compressing pills, the live pill (clipped to the phone frame)
 *   5. arrival light: glow, capsule ripple, light sweep over the pill
 *   6. the count badge (outBack pop)
 * Exit: notif 4 at y 300, three stack lines, four bubbles, badge `4`.
 */
(function () {
  'use strict';
  const ID = 'first-gift';
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

  // Beats, shot-local (shot starts at T 5.333)
  const NOTIFS = [
    { a: 0, gift: 'bowtie', bubble: 1, count: '1' }, //           T 5.333  bar 3
    { a: 2 * B, gift: 'capPurple', bubble: 2, count: '2' }, //    T 6.667  beat 3
    { a: 3 * B, gift: 'tama', bubble: 3, count: '3' }, //         T 7.333  beat 4
    { a: 3.5 * B, gift: 'capWhite', bubble: 0, count: '4' }, //   T 7.667  8th
  ];
  // compress time: the first at T 6.000 (beat 2), the others when the next one lands
  NOTIFS.forEach((n, i) => {
    const next = NOTIFS[i + 1];
    n.c = Math.min(n.a + B, next ? next.a : 1e9);
  });

  const PILL_W = 620;
  const PILL_Y = 300;
  const PILL_Y0 = 150;
  const PILL_H = PILL_W * 0.168;
  const LINE_Y = 202, LINE_DY = 14, LINE_W = 540, LINE_DW = 64, LINE_H = 10;

  const lineY = (k) => LINE_Y - k * LINE_DY;
  const lineW = (k) => LINE_W - k * LINE_DW;

  function phoneClip(ctx) {
    ctx.beginPath();
    K.rrect(ctx, 30, 140, 1020, 1640, 72);
    ctx.clip();
  }

  // A compressed history line: the pill folded to a hairline capsule, its gift reduced to a coloured bead.
  function stackLine(ctx, cx, cy, w, a, gift) {
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.beginPath();
    K.rrect(ctx, cx - w / 2, cy - LINE_H / 2, w, LINE_H, LINE_H / 2);
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

  function focusRing(ctx, x, y, u, fade) {
    if (u <= 0 || fade <= 0.01) return;
    const r = 76 * (0.7 + 0.3 * E.outBack(u));
    ctx.save();
    ctx.globalAlpha *= fade;
    ctx.strokeStyle = K.css(P.violetMid, 0.9);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = K.css(P.bone, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r + 5, -Math.PI * 0.2, Math.PI * 0.35);
    ctx.stroke();
    ctx.restore();
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const t = clamp(tIn, 0, info.dur);
      const T = info.shot.start + t;
      const f = Math.round(t * 24);

      // visible ON the beat frame (lead 1)
      const hit = (a, frames, e, lead = 1) =>
        t < a - 1e-6 ? 0 : (e || ((u) => u))(clamp((t - a) / (frames * FR) + lead / frames));
      const since = (a) => (t < a - 1e-6 ? -1 : t - a);

      // ---- the 3 px, 2-frame jolt on each arrival ---------------------------------
      let jolt = 0;
      for (const n of NOTIFS) {
        const d = f - Math.round(n.a * 24);
        if (d === 0 || d === 1) jolt = 3;
      }

      // ---- bubbles and badge -------------------------------------------------------
      const bl = [0, 0, 0, 0, 0, 0];
      let count = null, countA = -1;
      for (const n of NOTIFS) {
        if (t >= n.a - 1e-6) {
          bl[n.bubble] = hit(n.a, 7, null);
          count = n.count;
          countA = n.a;
        }
      }

      ctx.save();
      ctx.translate(0, jolt);

      // 1. the profile, G1
      K.profile(ctx, { T, bubbles: bl });

      // 2. the first notification: the rest of the screen steps back for a beat
      const s1 = since(0);
      const dim = 0.34 * Math.exp(-Math.max(0, s1) / 0.32) * clamp(1 - s1 / (B * 1.4));
      if (dim > 0.005) {
        ctx.fillStyle = K.css(P.void, dim);
        ctx.fillRect(0, -10, 1080, 1940);
      }

      // 3. focus rings around the bubbles that just bloomed
      for (const n of NOTIFS) {
        const s = since(n.a);
        if (s < 0) continue;
        const b = K.G1.bubbles[n.bubble];
        const u = hit(n.a, 3, null);
        const fade = clamp(1 - (s - 6 * FR) / (10 * FR));
        focusRing(ctx, b.x, b.y, u, fade);
      }

      // 4. history stack + pills, clipped to the phone frame
      ctx.save();
      phoneClip(ctx);
      // stack index of each compressed notification (0 = most recent, lowest line), eased as it shifts
      const stackK = NOTIFS.map((n, i) => {
        let k = 0;
        for (let j = i + 1; j < NOTIFS.length; j++) k += hit(NOTIFS[j].c, 5, E.inOutCubic);
        return k;
      });
      for (let i = NOTIFS.length - 1; i >= 0; i--) {
        const n = NOTIFS[i];
        if (t < n.a - 1e-6) continue;
        const cu = hit(n.c, 5, E.inOutCubic);
        const k = stackK[i];
        if (cu >= 1) {
          stackLine(ctx, 540, lineY(k), lineW(k), clamp(1 - k * 0.24), n.gift);
          continue;
        }
        // live or compressing pill
        const au = hit(n.a, 4, E.outBack);
        const aA = clamp(hit(n.a, 4, null) * 2.2);
        const y = lerp(lerp(PILL_Y0, PILL_Y, au), lineY(k), cu);
        const sx = lerp(1, lineW(k) / PILL_W, cu);
        const sy = lerp(1, LINE_H / PILL_H, cu);
        const s = since(n.a);
        const glowAmt = 1 + (i === 0 ? 1.6 : 0.9) * Math.exp(-s / 0.3);
        ctx.save();
        ctx.translate(540, y);
        ctx.scale(sx, sy);
        K.notif(ctx, 0, 0, PILL_W, { gift: n.gift, alpha: aA * Math.pow(1 - cu, 1.4), glow: glowAmt, seed: 40 + i });
        ctx.restore();
        if (cu > 0) stackLine(ctx, 540, y, lineW(k) + (PILL_W - lineW(k)) * (1 - cu), cu * clamp(1 - k * 0.24), n.gift);

        // 5. arrival light on the live pill
        if (cu <= 0 && s >= 0) {
          const x0 = 540 - PILL_W / 2, y0 = y - PILL_H / 2;
          // violet bloom under the pill, a hot core for the first
          K.glow(ctx, 540, y + 10, (i === 0 ? 440 : 340), P.violetMid, (i === 0 ? 0.9 : 0.55) * Math.exp(-s / 0.28));
          if (i === 0) K.glow(ctx, 540, y, 260, P.violetHot, 0.35 * Math.exp(-s / 0.18));
          // capsule rim light
          const rim = Math.exp(-s / 0.22);
          ctx.save();
          ctx.strokeStyle = K.css(P.violetHot, 0.85 * rim * aA);
          ctx.lineWidth = 2;
          ctx.beginPath();
          K.rrect(ctx, x0, y0, PILL_W, PILL_H, PILL_H / 2);
          ctx.stroke();
          // ripple: a hairline capsule expanding away from the pill (first notification: two)
          const rips = i === 0 ? [0, 5] : [0];
          for (const rf of rips) {
            const ru = (s - rf * FR) / (14 * FR);
            if (ru < 0 || ru > 1) continue;
            const g = E.outCubic(ru) * (i === 0 ? 64 : 34);
            ctx.strokeStyle = K.css(P.violetMid, 0.55 * (1 - ru));
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            K.rrect(ctx, x0 - g, y0 - g * 0.55, PILL_W + 2 * g, PILL_H + 1.1 * g, (PILL_H + 1.1 * g) / 2);
            ctx.stroke();
          }
          // light sweep across the face, left to right over 6 frames
          const su = (s - FR) / (6 * FR);
          if (su > 0 && su < 1) {
            ctx.beginPath();
            K.rrect(ctx, x0, y0, PILL_W, PILL_H, PILL_H / 2);
            ctx.clip();
            const sxp = lerp(x0 - 120, x0 + PILL_W + 120, E.inOutSine(su));
            const g = ctx.createLinearGradient(sxp - 90, 0, sxp + 90, 0);
            g.addColorStop(0, K.css(P.bone, 0));
            g.addColorStop(0.5, K.css(P.bone, 0.16 * (i === 0 ? 1.4 : 1)));
            g.addColorStop(1, K.css(P.bone, 0));
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = g;
            ctx.fillRect(sxp - 90, y0, 180, PILL_H);
          }
          ctx.restore();
          // the unread dot on the newest pill is an online spark
          K.onlineDot(ctx, x0 + PILL_W - PILL_H * 0.45, y, 5, 0.35 + 0.65 * Math.exp(-s / 0.4));
        }
      }
      ctx.restore();

      // 6. the count badge, popped (outBack over 3 frames) on every change
      if (count) {
        const pu = hit(countA, 3, null);
        const sc = pu < 1 ? [0.72, 1.08, 1][Math.min(2, Math.round(pu * 3) - 1)] || 0.72 : 1;
        const bx = K.G1.badge.x, by = K.G1.badge.y;
        const s = since(countA);
        K.glow(ctx, bx, by, 120, P.violetMid, 0.6 * Math.exp(-s / 0.25));
        ctx.save();
        ctx.translate(bx, by);
        ctx.scale(sc, sc);
        ctx.translate(-bx, -by);
        K.badge(ctx, bx, by, count, 30, 1);
        ctx.restore();
      }

      ctx.restore();
      // the jolt exposes 3 px at the top: keep it void (the profile bg fill already covers it)
    },
  });
})();
