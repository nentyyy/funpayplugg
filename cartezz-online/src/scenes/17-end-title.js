/*
 * Shot 17 — end-title: "CARTEZZ // @MURTHERED".
 * Global T 32.000 → 34.667 (local t 0 → 2.667), black, mode 'none' (no grain), hard cut in from the profile.
 *
 * Layers, back to front:
 *   1 void (pure black)
 *   2 the title, one line centred on x 540, baseline 968: `CARTEZZ` bone · ` // ` ash · `@MURTHERED` violetMid,
 *     50 px, weight 500, tracking 0.28 em (14 px). Fades in over 8 frames from T 32.667 with a 6 px rise (outExpo).
 *   3 a tiny online dot (kit.onlineDot, r 9) 30 px left of the title's left edge at y 953, popping (outBack,
 *     3 frames) on T 33.333 with the final ding. Hold to the end.
 */
(function () {
  'use strict';
  const ID = 'end-title';
  const FILM = window.FILM;
  const LIB = FILM.lib;
  const K = FILM.kit;
  const P = LIB.pal;
  const E = LIB.ease;
  const FR = 1 / 24;
  const B = K.B;
  const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);

  // timing (local seconds)
  const T_TITLE = 1 * B; // T 32.667  title fades in (8 frames)
  const T_DOT = 2 * B; //   T 33.333  online dot pops with the ding (3 frames)

  // type (art bible 9)
  const SIZE = 50;
  const WEIGHT = 500;
  const TRACK = 14; // 0.28 em
  const BASE = 968;
  const PIECES = [
    { s: 'CARTEZZ', c: P.bone },
    { s: ' // ', c: P.ash },
    { s: '@MURTHERED', c: P.violetMid },
  ];
  const DOT = { dx: -30, y: 953, r: 9 };
  // Shorts safe area: must-read content inside x 60–940. Centred on 540, the title may span at most 540 ± 400.
  // At the spec's 50 px / 14 px tracking the line measures ≈ 940 px in the render font, so it is scaled uniformly
  // (size and tracking together, about (540, baseline)) until it fits; with a narrower font it stays at 50 px.
  const MAX_W = 2 * (940 - 540);

  /** 0 → 1 over `frames` from local time a, visible ON the event frame (lead 1). */
  const hit = (t, a, frames, lead = 1) => (t < a - 1e-3 ? 0 : clamp((t - a) / (frames * FR) + lead / frames));

  let LAYOUT = null; // widths depend only on the font: measured once
  function layout(ctx) {
    if (LAYOUT) return LAYOUT;
    // letter-spacing adds its gap after every glyph, the last one included: that trailing gap is not ink
    const ws = PIECES.map((p) => K.textWidth(ctx, p.s, SIZE, WEIGHT, TRACK));
    const total = ws.reduce((a, b) => a + b, 0) - TRACK;
    const sc = Math.min(1, MAX_W / total);
    const x0 = 540 - total / 2; // in title space (scaled by sc about (540, BASE))
    const xs = [];
    let x = x0;
    for (const w of ws) {
      xs.push(x);
      x += w;
    }
    LAYOUT = { x0, xs, total, sc, left: 540 - (total * sc) / 2 };
    return LAYOUT;
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const t = clamp(tIn, 0, info.dur);
      // 1 — black
      ctx.fillStyle = P.void;
      ctx.fillRect(0, 0, 1080, 1920);

      // 2 — the title
      const u = hit(t, T_TITLE, 8);
      if (u <= 0) return;
      const L = layout(ctx);
      const a = E.outCubic(u);
      const rise = 6 * (1 - E.outExpo(u));
      ctx.save();
      ctx.translate(540, BASE + rise);
      ctx.scale(L.sc, L.sc);
      ctx.translate(-540, -BASE);
      PIECES.forEach((p, i) => {
        K.text(ctx, p.s, L.xs[i], BASE, { size: SIZE, weight: WEIGHT, tracking: TRACK, color: p.c, alpha: a });
      });
      ctx.restore();

      // 3 — the online dot, with the ding
      const d = hit(t, T_DOT, 3);
      if (d > 0) K.onlineDot(ctx, L.left + DOT.dx, DOT.y, DOT.r * Math.max(0, E.outBack(d)), clamp(d * 2));
    },
  });
})();
