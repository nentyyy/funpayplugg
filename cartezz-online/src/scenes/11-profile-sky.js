/*
 * 11 profile-sky : His profile over the city.  T 21.333 – 22.667 (two beats), city plate, cut in from 10.
 *
 * Low angle behind him: Cartezz stands small at the bottom of the frame (0, 0, 63.9), looking up; his own
 * profile hangs over the street as a monumental hologram (kit.city, HOLO (0, 40, 140)) and the kit's orbit of
 * giant gifts closes around it, new arrivals popping on the 8ths from 21.333; searchlights cross. Shot dead
 * serious — the humour is the scale.
 *
 * Camera. Storyboard G4 is pos (1.5, 0.6, 58.5), pitch 0.62, f 950. From 5.4 m behind him that frames his
 * head over the bottom of the hologram and the hologram small and low (≈ 320 px wide, below frame centre).
 * Pulled back to 12 m behind him with a longer lens (f 1450) and less tilt, the same low, looking-up angle
 * keeps him small at the bottom (≈ 225 px) and the hologram fills the upper middle, a clear gap between
 * his cap and its lower edge. The crane up (y 0.6 → 1.2) is kept, with a compensating tilt so he stays in
 * the safe area.
 *
 * Layers, back to front:
 *   1. kit.city from the craning camera (hologram on, orbit, searchlights, dots)
 *   2. the hologram's light on the street: a cool pool under it and a sheen on the road toward him
 *   3. Cartezz (kit.figure, standing, lookUp 1), back-lit by the hologram
 *   4. a cold halo of the hologram behind his head and shoulders
 *   5. vignette
 */
(function () {
  'use strict';
  const ID = 'profile-sky';
  const FILM = window.FILM;
  const LIB = FILM.lib;
  const P = LIB.pal;
  const E = LIB.ease;
  const K = FILM.kit;
  const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  const Z_HIM = 63.9; // storyboard G3: stopped
  const CAM0 = { pos: [1.5, 0.6, 51.9], yaw: -0.02, pitch: 0.33, f: 1450 };
  const CAM1 = { pos: [1.5, 1.2, 52.3], yaw: -0.02, pitch: 0.305, f: 1450 };

  function vignette(S) {
    const w = Math.round(1080 * S), h = Math.round(1920 * S);
    return LIB.cached(`profile-sky-vignette-${w}x${h}`, () => {
      const c = FILM.makeCanvas(w, h);
      const v = c.getContext('2d');
      v.scale(S, S);
      const g = v.createRadialGradient(540, 820, 420, 540, 960, 1200);
      g.addColorStop(0, K.css(P.void, 0));
      g.addColorStop(1, K.css(P.void, 0.5));
      v.fillStyle = g;
      v.fillRect(0, 0, 1080, 1920);
      const lg = v.createLinearGradient(0, 1580, 0, 1920);
      lg.addColorStop(0, K.css(P.void, 0));
      lg.addColorStop(1, K.css(P.void, 0.6));
      v.fillStyle = lg;
      v.fillRect(0, 1580, 1080, 340);
      return c;
    });
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const t = clamp(tIn, 0, info.dur);
      const T = info.shot.start + t;
      const p = E.inOutSine(t / info.dur);
      const S = FILM.S || 1;
      const H = K.HOLO;

      K.city(ctx, K.lerpCam(CAM0, CAM1, p), T, {
        extra: (c, C) => {
          // 2. the hologram's light on the street
          const pc = C.project(0, 0, H.z - 18);
          if (pc) {
            c.save();
            c.globalCompositeOperation = 'lighter';
            const rx = 36 * pc[3];
            c.translate(pc[0], pc[1]);
            c.scale(1, 0.14);
            const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
            g.addColorStop(0, K.css(P.violetHot, 0.2));
            g.addColorStop(0.4, K.css(P.violetMid, 0.08));
            g.addColorStop(1, K.css(P.violetMid, 0));
            c.fillStyle = g;
            c.fillRect(-rx, -rx, rx * 2, rx * 2);
            c.restore();
          }
          const a = C.project(0, 0, H.z - 30), b = C.project(0, 0, Z_HIM + 1);
          if (a && b) {
            c.save();
            c.globalCompositeOperation = 'lighter';
            const g = c.createLinearGradient(0, a[1], 0, b[1]);
            g.addColorStop(0, K.css(P.violetHot, 0.12));
            g.addColorStop(0.6, K.css(P.violetMid, 0.04));
            g.addColorStop(1, K.css(P.violetMid, 0));
            c.fillStyle = g;
            c.beginPath();
            c.moveTo(a[0] - 4 * a[3], a[1]);
            c.lineTo(a[0] + 4 * a[3], a[1]);
            c.lineTo(b[0] + 2.2 * b[3], b[1]);
            c.lineTo(b[0] - 2.2 * b[3], b[1]);
            c.closePath();
            c.fill();
            c.restore();
          }

          // 4 (behind him). a cold halo of the hologram around his head and shoulders
          const hd = C.project(0, 1.7, Z_HIM);
          if (hd) {
            K.glow(c, hd[0], hd[1], 0.9 * hd[3], P.violetHot, 0.35);
            K.glow(c, hd[0], hd[1] + 0.3 * hd[3], 1.8 * hd[3], P.violetMid, 0.25);
          }

          // 3. Cartezz, standing, looking up, rim-lit by the hologram above and ahead
          K.figure(c, C, 0, Z_HIM, { walk: null, lookUp: 1, rim: 1 });
        },
      });

      // 5. vignette
      const vc = vignette(S);
      ctx.drawImage(vc, 0, 0, vc.width, vc.height, 0, 0, 1080, 1920);
    },
  });
})();
