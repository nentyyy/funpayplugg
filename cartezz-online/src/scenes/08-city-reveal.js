/*
 * 08 city-reveal : "Cartezz in the city".  T 13.333 – 16.000 (bar 6), hard cut from 07's settle.
 *
 * The establishing shot. One-point perspective down the street from (0, 1.1, 18) pushing to (0, 1.1, 20.5),
 * yaw 0, pitch 0.2, f 1050 (storyboard G4), inOutSine. Cartezz stands on the centreline at (0, 0, 34), back to us,
 * a silhouette against the far ONLINE glow; from 15.333 he walks (a step on every beat). The kit brings the giant
 * bow tie at 14.667 by itself.
 *
 * Restraint: the kit city is the star. Scene touches are only light and air, identical at the end of 07 so the
 * cut matches: a low haze bank lying on the far street with slow drifting wisps, and the wet asphalt picking up the
 * lights (a faint, blurred, stretched mirror of the band above the horizon) plus Cartezz's own faint reflection.
 *
 * Layers, back to front:
 *   1. kit.city (sky, skyline, ground, towers, button, gifts, searchlights, online dots)
 *   2. haze bank + wisps
 *   3. wet-road reflection
 *   4. Cartezz's reflection, then Cartezz (kit.figure: contact shadow, rim light)
 */
(function () {
  'use strict';
  const ID = 'city-reveal';
  const LIB = FILM.lib;
  const K = FILM.kit;
  const P = LIB.pal;
  const E = LIB.ease;
  const B = K.B;
  const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
  const css = K.css, mix = K.mix;

  const T_WALK = 23 * B; // 15.333 beat 4: first step
  const CAM_A = { pos: [0, 1.1, 18], yaw: 0, pitch: 0.2, f: 1050 };
  const CAM_B = { pos: [0, 1.1, 20.5], yaw: 0, pitch: 0.2, f: 1050 };
  const MAN = { x: 0, z: 34 }; // storyboard G3, shot 08

  // ---------------------------------------------------------------------------
  // End touches shared with 08 (identical code in 08-city-reveal.js): the haze band and the wet-road reflection
  // ---------------------------------------------------------------------------
  function hazeBand(ctx, C, T, a) {
    if (a <= 0.004) return;
    const hy = C.horizonY();
    if (hy < -200 || hy > 2300) return;
    const Tc = K.cityTime(T);
    ctx.save();
    // a low bank of fog lying on the far street: softens the tower feet, deepens the vanishing point
    const g = ctx.createLinearGradient(0, hy - 150, 0, hy + 40);
    g.addColorStop(0, css(P.haze, 0));
    g.addColorStop(0.6, css(P.haze, 0.3 * a));
    g.addColorStop(0.9, css(mix(P.haze, P.hazeViolet, 0.5), 0.32 * a));
    g.addColorStop(1, css(P.haze, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, hy - 150, 1080, 190);
    // drifting wisps: long soft ellipses sliding slowly across (world-time driven, freeze-safe)
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const r = LIB.rng(LIB.hash('city-haze', i));
      const w = 380 + r() * 420;
      const x = ((r() * 1600 + Tc * (6 + r() * 8)) % 1600) - 260;
      const y = hy - 20 - r() * 110;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.1 + r() * 0.06);
      const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
      rg.addColorStop(0, css(P.hazeViolet, 0.22 * a));
      rg.addColorStop(1, css(P.hazeViolet, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(-w / 2, -w / 2, w, w);
      ctx.restore();
    }
    ctx.restore();
  }

  // Wet asphalt: the band just above the horizon mirrored and stretched down onto the road, blurred by a
  // quarter-resolution pass, added faintly. Drawn before Cartezz.
  function reflection(ctx, C, a) {
    if (a <= 0.004) return;
    const hy = C.horizonY();
    if (hy < 200 || hy > 1900) return;
    const cv = ctx.canvas;
    const S = cv.width / 1080;
    const q = 4;
    const w = Math.max(2, Math.round(cv.width / q)), h = Math.max(2, Math.round(cv.height / q));
    const R = LIB.cached(`city-refl:${w}x${h}`, () => {
      const c = FILM.makeCanvas(w, h);
      return { c, g: c.getContext('2d') };
    });
    const g = R.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, w, h);
    g.setTransform(w / 1080, 0, 0, h / 1920, 0, 0);
    const src = 560; // frame px of source above the horizon
    const stretch = 1.35;
    g.save();
    g.translate(0, hy);
    g.scale(1, -stretch);
    g.translate(0, -hy);
    g.drawImage(cv, 0, (hy - src) * S, cv.width, src * S, 0, hy - src, 1080, src);
    g.restore();
    // fade with distance below the horizon
    g.globalCompositeOperation = 'destination-in';
    const fg = g.createLinearGradient(0, hy, 0, hy + src * stretch);
    fg.addColorStop(0, 'rgba(0,0,0,1)');
    fg.addColorStop(0.35, 'rgba(0,0,0,0.45)');
    fg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fg;
    g.fillRect(0, hy, 1080, src * stretch);
    g.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1.0 * a;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(R.c, 0, Math.round(hy * S), cv.width, cv.height - Math.round(hy * S), 0, Math.round(hy * S) , cv.width, cv.height - Math.round(hy * S));
    ctx.restore();
  }

  // Cartezz's reflection on the wet road: the kit figure mirrored about his feet, faint.
  function figureReflection(ctx, C, x, z, pose, a) {
    if (a <= 0.004) return;
    const f = C.project(x, 0, z), hd = C.project(x, 1.85, z);
    if (!f || !hd) return;
    const h = Math.hypot(hd[0] - f[0], hd[1] - f[1]);
    if (h < 3) return;
    ctx.save();
    ctx.globalAlpha *= 0.2 * a;
    ctx.translate(f[0], f[1]);
    ctx.scale(1, -0.9);
    K.cartezz(ctx, 0, 0, h, Object.assign({ view: 'back', rim: 0.75 }, pose));
    ctx.restore();
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const t = clamp(tIn, 0, info.dur);
      const T = info.shot.start + t;
      const C = K.cam(K.lerpCam(CAM_A, CAM_B, E.inOutSine(t / info.dur)));
      // 1. the city
      K.city(ctx, C, T, {});
      // 2–3. air and wet asphalt
      hazeBand(ctx, C, T, 1);
      reflection(ctx, C, 1);
      // 4. Cartezz: standing, then walking from 15.333 (kit.cartezzAt agrees)
      const s = K.cartezzAt(T);
      const z = s ? s.z : MAN.z;
      const pose = { walk: T >= T_WALK ? (T - T_WALK) / (2 * B) : null };
      figureReflection(ctx, C, MAN.x, z, pose, 1);
      K.figure(ctx, C, MAN.x, z, pose);
    },
  });
})();
