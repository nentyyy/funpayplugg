/*
 * 14 freeze: Everything stops — T 26.667 to 28.0 (city plate, flash in (timeline), grain held).
 *
 * A locked wide from the side of the plaza: the pressed ONLINE button at full glow, Cartezz tiny at its
 * base with his palm on the face, every giant gift, notification pill, online dot and searchlight hanging
 * perfectly still. Nothing moves: every frame of this shot is the same picture (the world is drawn at
 * T_PRESS, the camera is locked, nothing here reads t). The only change is the timeline's press flash
 * clearing over the first two frames.
 *
 * Layers, back to front:
 *   1. kit.city at T_PRESS from the locked camera
 *   2. the wet plaza floor: a soft mirror of the pressed button and the wall behind it
 *   3. his reflection, then Cartezz (kit.figure, arm 1) with the white-hot point under his palm
 *   4. grade: dark closing in from the frame edges and the near floor
 */
(function () {
  'use strict';
  const ID = 'freeze';
  const FILM = window.FILM;
  const LIB = FILM.lib;
  const K = FILM.kit;
  const P = LIB.pal;
  const lerp = (a, b, t) => a + (b - a) * t;
  const sd = (...k) => LIB.hash(ID, ...k) & 0x7fffffff;

  // Storyboard G4 / shot 14 (locked)
  const CAM = { pos: [-16, 7.5, 186], yaw: 0.42, pitch: 0.02, f: 1050 };
  const HIM = { x: 0, z: 219.3 }; // G3: Cartezz at the button
  const TW = K.T_PRESS; // the frozen instant: the whole shot is drawn at the press

  let SCR = null;
  function scratch(w, h) {
    if (!SCR || SCR.width !== w || SCR.height !== h) SCR = FILM.makeCanvas(w, h);
    return SCR;
  }

  /**
   * Wet-floor mirror: everything above the projected base line of the button (screen line y = m·x + c)
   * is flipped under it, softened (quarter resolution), faded with distance and broken by seeded streaks.
   * (Same treatment as shot 12's plaza floor.)
   */
  function floorMirror(ctx, m, c, depth, alpha) {
    const src = ctx.canvas;
    const w = Math.max(2, Math.round(src.width * 0.25)), h = Math.max(2, Math.round(src.height * 0.25));
    const cv = scratch(w, h);
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, w, h);
    const k = w / 1080;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.save();
    g.transform(1, 2 * m, 0, -1, 0, 2 * c); // y' = 2(m x + c) − y
    g.drawImage(src, 0, 0, src.width, src.height, 0, 0, 1080, 1920);
    g.restore();
    g.save();
    g.globalCompositeOperation = 'destination-in';
    g.transform(1, m, 0, 1, 0, c); // (u, v) -> (u, m u + c + v)
    const fg = g.createLinearGradient(0, 0, 0, depth);
    fg.addColorStop(0, K.css(P.void, 1));
    fg.addColorStop(0.18, K.css(P.void, 0.55));
    fg.addColorStop(0.55, K.css(P.void, 0.16));
    fg.addColorStop(1, K.css(P.void, 0));
    g.fillStyle = fg;
    g.fillRect(-400, 0, 1880, depth);
    g.restore();
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.transform(1, m, 0, 1, 0, c);
    const r = LIB.rng(sd('streaks'));
    for (let i = 0; i < 70; i++) {
      const v = Math.pow(r(), 0.8) * depth;
      const x0 = -300 + r() * 1480, len = 80 + r() * 520;
      g.fillStyle = K.css(P.void, 0.25 + 0.5 * r());
      g.fillRect(x0, v, len, 1 + (v / depth) * 6 * r());
    }
    g.restore();
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(cv, 0, 0, w, h, 0, 0, 1080, 1920);
    ctx.restore();
  }

  function figureReflection(ctx, C, pose, a) {
    const f = C.project(HIM.x, 0, HIM.z), hd = C.project(HIM.x, 1.85, HIM.z);
    if (!f || !hd) return;
    const h = Math.hypot(hd[0] - f[0], hd[1] - f[1]);
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(f[0], f[1]);
    ctx.scale(1, -0.92);
    ctx.translate(-f[0], -f[1]);
    K.cartezz(ctx, f[0], f[1], h, Object.assign({ view: 'back', rim: 0.5 }, pose));
    ctx.restore();
  }

  FILM.scene({
    id: ID,
    draw(ctx) {
      // No time input on purpose: the frozen world, the locked camera. Every frame is identical.
      const pose = { walk: null, arm: 1 };
      K.city(ctx, CAM, TW, {
        extra: (c, C) => {
          // 2. wet floor under the bezel's base line (z 220, y 0)
          const bl = C.project(-13, 0, 220), br = C.project(13, 0, 220);
          if (bl && br) {
            const m = (br[1] - bl[1]) / (br[0] - bl[0]);
            floorMirror(c, m, bl[1] - m * bl[0], 520, 0.5);
          }
          // 3. his reflection, the figure, and the white-hot point where his palm meets the face
          figureReflection(c, C, pose, 0.35);
          const fr = K.figure(c, C, HIM.x, HIM.z, Object.assign({ rim: 1 }, pose));
          if (fr) {
            const hx = fr.x + 0.235 * fr.h, hy = fr.y - 0.788 * fr.h;
            K.glow(c, hx, hy, fr.h * 1.4, P.violetHot, 0.55);
            K.glow(c, hx, hy, fr.h * 0.35, P.hot, 0.9);
          }
        },
      });
      // 4. grade: the plaza's edges fall into dark; the button stays the only key light
      ctx.save();
      let g = ctx.createLinearGradient(0, 0, 0, 620);
      g.addColorStop(0, K.css(P.void, 0.55));
      g.addColorStop(1, K.css(P.void, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1080, 620);
      g = ctx.createLinearGradient(0, 1420, 0, 1920);
      g.addColorStop(0, K.css(P.void, 0));
      g.addColorStop(1, K.css(P.void, 0.75));
      ctx.fillStyle = g;
      ctx.fillRect(0, 1420, 1080, 500);
      g = ctx.createRadialGradient(560, 1060, 520, 560, 1060, lerp(1150, 1250, 0.5));
      g.addColorStop(0, K.css(P.void, 0));
      g.addColorStop(1, K.css(P.void, 0.7));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1080, 1920);
      ctx.restore();
    },
  });
})();
