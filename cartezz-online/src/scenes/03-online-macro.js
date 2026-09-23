/*
 * 03 online-macro — "2 online"
 * Global T 4.000 – 5.333 (bar 2, beats 3–4), screen plate, hard cut from 02.
 *
 * A true magnification of G1 about (540, 895): x3.2 drifting to x3.3 (inOutSine), so the white `2`
 * square (G1 x 428–474, y 872–918) is ~147 px on screen and `online` runs off to the right. Nothing in
 * the picture moves except the one blink — tension by stillness.
 * Layers, back to front:
 *   1. G1 profile under the zoom (kit.profile; presence square blinks via o.blink at T 4.667, 30% for
 *      4 frames); the avatar's lower rim (the sleeping city) grazes the top of frame
 *   2. grading: the top of frame and the action tiles below sink into the dark; the tiles are also
 *      softened (blurred-dark hints)
 *   3. overlays, screen-fixed: corner brackets tight around the `2` (outBack pop, 3 frames, at T 4.0),
 *      a thin tick rail along the bottom (ash) with a marker under the `2`
 */
(function () {
  'use strict';
  const ID = 'online-macro';
  const FILM = window.FILM;
  const LIB = FILM.lib;
  const P = LIB.pal;
  const E = LIB.ease;
  const K = FILM.kit;
  const FR = 1 / 24;
  const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, u) => a + (b - a) * u;

  const B = K.B;
  const T_BLINK = B; // shot-local 0.667 = T 4.667 (beat 2)
  const BLINK_FRAMES = 4;
  const OX = 540, OY = 895; // zoom anchor (G1 and screen)
  const Z0 = 3.2, Z1 = 3.3;
  const SQ = { x0: 428, y0: 872, x1: 474, y1: 918 }; // G1 presence square
  const NO_BUBBLES = [0, 0, 0, 0, 0, 0];
  const RAIL_Y = 1680; // below the blurred tiles, in the dark

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const t = clamp(tIn, 0, info.dur);
      const T = info.shot.start + t;
      const f = Math.round(t * 24);
      const lastF = Math.round(info.dur * 24) - 1;
      const hit = (a, frames, e, lead = 1) =>
        t < a - 1e-6 ? 0 : (e || ((u) => u))(clamp((t - a) / (frames * FR) + lead / frames));

      // ---- camera: x3.2 -> x3.3 about (540, 895) ----
      const Z = lerp(Z0, Z1, E.inOutSine(clamp(f / lastF)));
      const g2s = (x, y) => [OX + (x - OX) * Z, OY + (y - OY) * Z];

      // the heartbeat blink: 30% for 4 frames from the beat frame
      const fb = Math.round(T_BLINK * 24);
      const blink = f >= fb && f < fb + BLINK_FRAMES ? 0.3 : 1;

      ctx.fillStyle = P.void;
      ctx.fillRect(0, 0, info.W, info.H);

      // 1. G1, magnified
      ctx.save();
      ctx.translate(OX, OY);
      ctx.scale(Z, Z);
      ctx.translate(-OX, -OY);
      K.profile(ctx, { T, bubbles: NO_BUBBLES, blink, avatarOpts: { pxBoost: Z } });
      ctx.restore();

      // 2. grading. The tiles below: softened, then sunk into the dark.
      const [, tileTop] = g2s(0, 975);
      const y0 = Math.floor(tileTop - 40);
      const m = ctx.getTransform();
      const S = m.a || 1;
      ctx.save();
      ctx.filter = 'blur(7px)';
      ctx.drawImage(ctx.canvas, 0, y0 * S, info.W * S, (info.H - y0) * S, 0, y0, info.W, info.H - y0);
      ctx.restore();
      const lg = ctx.createLinearGradient(0, tileTop - 60, 0, tileTop + 420);
      lg.addColorStop(0, K.css(P.void, 0));
      lg.addColorStop(0.35, K.css(P.void, 0.55));
      lg.addColorStop(1, K.css(P.void, 0.92));
      ctx.fillStyle = lg;
      ctx.fillRect(0, tileTop - 60, info.W, info.H);
      // the top of frame (the avatar's rim, the giant name) recedes a little
      const [, sqTop] = g2s(0, SQ.y0);
      const tg = ctx.createLinearGradient(0, 0, 0, sqTop - 20);
      tg.addColorStop(0, K.css(P.void, 0.85));
      tg.addColorStop(0.6, K.css(P.void, 0.68));
      tg.addColorStop(0.88, K.css(P.void, 0.5));
      tg.addColorStop(1, K.css(P.void, 0));
      ctx.fillStyle = tg;
      ctx.fillRect(0, 0, info.W, sqTop - 20);

      // 3a. brackets tight around the `2`: outBack pop over 3 frames on the cut (T 4.0)
      const [ax, ay] = g2s(SQ.x0, SQ.y0);
      const [bx, by] = g2s(SQ.x1, SQ.y1);
      const cx = (ax + bx) / 2, cy = (ay + by) / 2;
      const half = (bx - ax) / 2 + 26;
      const bp = hit(0, 3);
      const k = 0.72 + 0.28 * E.outBack(bp);
      const hb = half * (2 - k); // pops inward onto the square: starts wide, overshoots tight, settles
      ctx.save();
      ctx.globalAlpha = clamp(bp * 1.5);
      K.brackets(ctx, cx - hb, cy - hb, cx + hb, cy + hb, 26, K.css(P.mist, 0.75), 1.5);
      ctx.restore();

      // 3b. tick rail along the bottom, a marker under the `2`
      ctx.save();
      ctx.strokeStyle = K.css(P.ash, 0.7);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(90, RAIL_Y);
      ctx.lineTo(990, RAIL_Y);
      for (let i = 0; i <= 50; i++) {
        const x = 90 + i * 18;
        const len = i % 10 === 0 ? 16 : i % 5 === 0 ? 10 : 5;
        ctx.moveTo(x, RAIL_Y);
        ctx.lineTo(x, RAIL_Y - len);
      }
      ctx.stroke();
      ctx.strokeStyle = K.css(P.mist, 0.8);
      ctx.beginPath();
      ctx.moveTo(cx, RAIL_Y + 8);
      ctx.lineTo(cx, RAIL_Y - 24);
      ctx.stroke();
      ctx.restore();
    },
  });
})();
