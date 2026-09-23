/*
 * 02 avatar-macro — "The avatar, too close"
 * Global T 2.667 – 4.000 (bar 2, beats 1–2), screen plate, hard cut from 01's G1.
 *
 * A true magnification of G1: FILM.kit.profile is drawn under a transform that carries the avatar
 * (G1 centre (540, 540), r 160) to (540, 900) with an on-screen radius pushing 490 -> 560 (inOutSine,
 * x1.14, so the ring arc crosses the frame edges by the end): the same pixels as 01's last frame, only
 * closer. The avatar is rendered with pxBoost = zoom so the sleeping city stays crisp.
 * Layers, back to front:
 *   1. G1 profile under the zoom (avatar = the dark city at city time T, asleep until 10.667);
 *      a lens vignette sinks the rest of the profile (the giant name below) into the dark
 *   2. inside the circle: a veil that sinks the edges of the city into black (keeps it unreadable)
 *   3. the heart: the violet glow at the end of the street, breathing once around T 3.333
 *   4. overlays, screen-fixed around the zoomed ring: the focus rail (48 ash ticks), the focus ring
 *      (1.5 px violetMid, outBack pop over 3 frames at T 3.333, then fades)
 */
(function () {
  'use strict';
  const ID = 'avatar-macro';
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
  const T_FOCUS = B; // shot-local 0.667 = T 3.333 (beat 2)
  const AV = { x: 540, y: 540, r: 160 }; // G1 avatar
  const CX = 540, CY = 900; // where the avatar centre lands on screen
  const R0 = 490, R1 = 560; // on-screen avatar radius, push (the ring crosses the frame edges by the end)
  const NO_BUBBLES = [0, 0, 0, 0, 0, 0];
  const PX = 1; // avatar detail follows the zoom (pxBoost = Z), so the magnified city stays crisp

  // Where the heart of the avatar is (the button's light at the end of the street), in G1 pixels.
  let HEART = null;
  function heart() {
    if (HEART) return HEART;
    const C = K.cam(K.CAM_AVATAR);
    const b = K.BUTTON;
    const p = C.project(0, (b.y0 + b.y1) / 2, b.z);
    const k = AV.r / K.HALF_DIAG;
    const hwPx = ((b.x1 - b.x0) / 2) * p[3] * k;
    HEART = { x: AV.x + (p[0] - 540) * k, y: AV.y + (p[1] - 960) * k, hw: hwPx };
    return HEART;
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const t = clamp(tIn, 0, info.dur);
      const T = info.shot.start + t;
      const f = Math.round(t * 24);
      const lastF = Math.round(info.dur * 24) - 1;
      const hit = (a, frames, e, lead = 1) =>
        t < a - 1e-6 ? 0 : (e || ((u) => u))(clamp((t - a) / (frames * FR) + lead / frames));

      // ---- camera: the zoom that puts G1's avatar at (540, 900), r 490 -> 560 ----
      const pe = clamp(f / lastF);
      const R = lerp(R0, R1, E.inOutSine(pe));
      const Z = R / AV.r;
      const g2s = (x, y) => [CX + (x - AV.x) * Z, CY + (y - AV.y) * Z];

      ctx.fillStyle = P.void;
      ctx.fillRect(0, 0, info.W, info.H);

      // 1. G1, magnified
      ctx.save();
      ctx.translate(CX, CY);
      ctx.scale(Z, Z);
      ctx.translate(-AV.x, -AV.y);
      K.profile(ctx, { T, bubbles: NO_BUBBLES, avatarOpts: { pxBoost: Z * PX } });
      ctx.restore();

      // 1b. lens vignette: the rest of the profile sinks into the dark around the ring
      const og = ctx.createRadialGradient(CX, CY, R + 20, CX, CY, R + 520);
      og.addColorStop(0, K.css(P.void, 0));
      og.addColorStop(0.35, K.css(P.void, 0.7));
      og.addColorStop(1, K.css(P.void, 0.94));
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, info.W, info.H);
      ctx.arc(CX, CY, R + 20, 0, TAU, true);
      ctx.fillStyle = og;
      ctx.fill('evenodd');
      ctx.restore();

      const H = heart();
      const [hx, hy] = g2s(H.x, H.y);
      const hw = H.hw * Z; // half-width of the light on screen

      // 2. the veil: the city's edges sink into black, only the heart reads
      ctx.save();
      ctx.beginPath();
      ctx.arc(CX, CY, R - 1.5, 0, TAU);
      ctx.clip();
      const vg = ctx.createRadialGradient(hx, hy, hw * 0.9, CX, CY, R * 1.02);
      vg.addColorStop(0, K.css(P.void, 0));
      vg.addColorStop(0.4, K.css(P.void, 0.5));
      vg.addColorStop(1, K.css(P.void, 0.9));
      ctx.fillStyle = vg;
      ctx.fillRect(CX - R, CY - R, 2 * R, 2 * R);

      // 3. the heart: the light at the end of the street, too bright to read, breathing once
      const br = Math.exp(-Math.pow((t - (T_FOCUS + 0.1)) / 0.3, 2));
      const bg = ctx.createRadialGradient(hx, hy, 0, hx, hy, hw * 1.45);
      bg.addColorStop(0, K.css(P.violetHot, 0.95));
      bg.addColorStop(0.42, K.css(P.violetMid, 0.88));
      bg.addColorStop(0.75, K.css(P.violet, 0.45));
      bg.addColorStop(1, K.css(P.violetInk, 0));
      ctx.save();
      ctx.translate(hx, hy);
      ctx.scale(1, 0.62);
      ctx.translate(-hx, -hy);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(hx, hy, hw * 1.45, 0, TAU);
      ctx.fill();
      ctx.restore();
      K.glow(ctx, hx, hy, hw * (2.6 + 0.9 * br), P.violetMid, 0.55 + 0.45 * br);
      K.glow(ctx, hx, hy, hw * (1.1 + 0.25 * br), P.violetHot, 0.35 + 0.35 * br);
      ctx.restore();

      // 4a. the focus rail: 48 ash ticks riding just outside the ring
      ctx.save();
      ctx.strokeStyle = K.css(P.ash, 0.7);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const rr = R + 26;
      for (let i = 0; i < 48; i++) {
        const a = -Math.PI / 2 + (i / 48) * TAU;
        const len = i % 12 === 0 ? 22 : i % 4 === 0 ? 14 : 8;
        const c = Math.cos(a), s = Math.sin(a);
        ctx.moveTo(CX + c * rr, CY + s * rr);
        ctx.lineTo(CX + c * (rr + len), CY + s * (rr + len));
      }
      ctx.stroke();
      ctx.restore();

      // 4b. the focus ring: pops (outBack, 3 frames) on the heart at T 3.333, then fades
      const fp = hit(T_FOCUS, 3);
      if (fp > 0) {
        const fade = 1 - clamp((t - (T_FOCUS + 0.25)) / 0.33);
        if (fade > 0) {
          const fr = hw * 1.9 * (0.72 + 0.28 * E.outBack(fp));
          ctx.save();
          ctx.globalAlpha = clamp(fp * 1.5) * fade;
          ctx.strokeStyle = P.violetMid;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(hx, hy, fr, 0, TAU);
          ctx.stroke();
          // four short cardinal ticks on the ring
          ctx.beginPath();
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * TAU;
            ctx.moveTo(hx + Math.cos(a) * (fr - 7), hy + Math.sin(a) * (fr - 7));
            ctx.lineTo(hx + Math.cos(a) * (fr + 9), hy + Math.sin(a) * (fr + 9));
          }
          ctx.stroke();
          ctx.restore();
        }
      }
    },
  });
})();
