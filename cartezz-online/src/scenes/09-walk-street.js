/*
 * 09 walk-street : He walks.  T 16.000 – 18.667 (one bar), city plate, cut in from 08.
 *
 * Tracking behind Cartezz at head height as he walks z = 60 + 1.45·(T − 16) (storyboard G3/G4):
 * the street runs up the middle to the button's glow, giant gifts drift overhead, the white cap
 * arrives on beat 3 (17.333, kit city data), and on beat 4 (18.0) his own profile flickers on as a
 * hologram high ahead (kit.city, HOLO (0, 40, 140)). Its cold light falls on him; he slows into the
 * stop that shot 10 holds (z 63.9).
 *
 * Layers, back to front:
 *   1. kit.city from the tracking camera (sky, towers, button, gifts, hologram, searchlights, dots)
 *   2. hologram light pool on the street ahead (flickers with kit.holoOn)
 *   3. Cartezz (kit.figure, back view, walking) inside the city's extra pass
 *   4. hologram top-light on his cap and shoulders
 *   5. soft frame vignette (screen-fixed)
 */
(function () {
  'use strict';
  const ID = 'walk-street';
  const FILM = window.FILM;
  const LIB = FILM.lib;
  const P = LIB.pal;
  const K = FILM.kit;
  const TAU = Math.PI * 2;
  const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => {
    const t = clamp((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const B = K.B;
  const T0 = 16.0;                 // shot start (bar 7 downbeat)
  const T_SLOW = T0 + 3 * B;       // T 18.0: beat 4, the hologram flickers on and he starts to slow
  const T_END = T0 + 4 * B;        // T 18.667
  const Z0 = 60, V = 1.45;         // storyboard G3
  const CAM_X = 0.42, CAM_YAW = 0.02;

  /** A soft, low-res copy of the hologram texture for its reflection in the wet road (cached, t-independent). */
  function holoSoft() {
    return LIB.cached('walk-street-holo-soft', () => {
      const src = K.holoTex();
      const c = FILM.makeCanvas(60, 106);
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = true;
      g.drawImage(src, 0, 0, 60, 106);
      return c;
    });
  }

  /**
   * His street position. Nominal z = 60 + 1.45·(T − 16) until beat 4; over the last beat the speed eases to
   * zero (g(s) = s + s² − s³: same speed at 18.0, zero at 18.667) and lands on the same z the shot-10/11 stop
   * uses (63.87 ≈ 63.9). The stride phase follows the distance, so the last step lands on 18.0 and then slows.
   */
  function travel(T) {
    const d = T - T0;
    const dSlow = T_SLOW - T0;
    if (T <= T_SLOW) return d;
    const s = clamp((T - T_SLOW) / B);
    return dSlow + B * (s + s * s - s * s * s);
  }

  /** Cold white-violet top light from the hologram at global T (0..1), following the kit's flicker. */
  const holo = (T) => K.holoOn(K.cityTime(T));

  function vignette(ctx) {
    const g = ctx.createRadialGradient(540, 900, 380, 540, 960, 1150);
    g.addColorStop(0, K.css(P.void, 0));
    g.addColorStop(1, K.css(P.void, 0.55));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1080, 1920);
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const t = clamp(tIn, 0, info.dur);
      const T = T0 + t;
      const dist = travel(T);
      const zH = Z0 + V * dist;
      const walk = dist / (2 * B);          // one stride pair per two beats: a step on every beat
      const hl = holo(T);

      // camera operator's sway: follows the stride (≤ 0.04 m lateral), a hair of vertical float
      const stride = TAU * walk;
      const settle = 1 - 0.6 * sstep(T_SLOW, T_END, T);
      // The storyboard camera sits on the centreline, which parks the far ONLINE pill exactly behind his head
      // (it reads as a hat). A 0.42 m over-the-shoulder offset (+0.02 yaw) clears it: he walks left of centre,
      // the button's glow burns just past his right shoulder, the vanishing point stays near x 568.
      const camSpec = {
        pos: [CAM_X + 0.04 * Math.sin(stride) * settle, 1.55 + 0.006 * Math.cos(2 * stride) * settle, zH - 4.2],
        yaw: CAM_YAW - 0.0035 * Math.sin(stride) * settle,
        pitch: 0.1 + 0.012 * sstep(T_SLOW, T_END, T), // the frame lifts a hair toward the light
        f: 1400,
      };

      // 1–4. the city with Cartezz inside its extra pass (depth order: he is the nearest thing)
      K.city(ctx, camSpec, T, {
        extra: (c, C) => {
          // 2. hologram light pool on the street ahead: a cool ellipse under HOLO, and a long sheen toward him
          if (hl > 0) {
            const pc = C.project(0, 0, K.HOLO.z - 20);
            if (pc) {
              c.save();
              c.globalCompositeOperation = 'lighter';
              const rx = 34 * pc[3], ry = 5 * pc[3];
              c.translate(pc[0], pc[1]);
              c.scale(1, ry / rx);
              const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
              g.addColorStop(0, K.css(P.violetHot, 0.16 * hl));
              g.addColorStop(0.4, K.css(P.violetMid, 0.07 * hl));
              g.addColorStop(1, K.css(P.violetMid, 0));
              c.fillStyle = g;
              c.fillRect(-rx, -rx, rx * 2, rx * 2);
              c.restore();
            }
            // glossy streak on the road running toward us (the wet-black road reflecting the hologram)
            const a = C.project(0, 0, K.HOLO.z - 30), b = C.project(0, 0, zH + 2.5);
            if (a && b) {
              c.save();
              c.globalCompositeOperation = 'lighter';
              const g = c.createLinearGradient(0, a[1], 0, b[1]);
              g.addColorStop(0, K.css(P.violetHot, 0.1 * hl));
              g.addColorStop(0.5, K.css(P.violetMid, 0.035 * hl));
              g.addColorStop(1, K.css(P.violetMid, 0));
              c.fillStyle = g;
              c.beginPath();
              c.moveTo(a[0] - 3 * a[3], a[1]);
              c.lineTo(a[0] + 3 * a[3], a[1]);
              c.lineTo(b[0] + 1.6 * b[3], b[1]);
              c.lineTo(b[0] - 1.6 * b[3], b[1]);
              c.closePath();
              c.fill();
              c.restore();
            }
          }

          // the hologram mirrored in the wet road: soft, streaked, clipped to the road surface
          if (hl > 0) {
            const H = K.HOLO;
            const road = K.projPoly(C, [[-9, 0, zH - 2], [9, 0, zH - 2], [9, 0, 196], [-9, 0, 196]]);
            if (road) {
              c.save();
              c.beginPath();
              c.moveTo(road[0][0], road[0][1]);
              for (let i = 1; i < road.length; i++) c.lineTo(road[i][0], road[i][1]);
              c.closePath();
              c.clip();
              K.planeImage(c, C, holoSoft(), [H.x - H.w / 2, -(H.y + H.h / 2), H.z], [H.x + H.w / 2, -(H.y + H.h / 2), H.z],
                [H.x - H.w / 2, -(H.y - H.h / 2), H.z], { composite: 'lighter', alpha: 0.4 * hl, strips: 16 });
              c.restore();
            }
          }

          // 3. Cartezz, back view, walking; the rim picks up the hologram as it comes on
          const fig = K.figure(c, C, 0, zH, { walk, rim: clamp(0.72 + 0.28 * hl) });

          // 4. hologram top-light on the cap and shoulders
          if (fig && hl > 0) {
            const hx = fig.x, hy = fig.y - fig.h * 0.94;
            c.save();
            c.globalCompositeOperation = 'lighter';
            K.glow(c, hx + fig.h * 0.01, hy - fig.h * 0.03, fig.h * 0.16, P.violetHot, 0.45 * hl);
            K.glow(c, hx, fig.y - fig.h * 0.8, fig.h * 0.26, P.violetMid, 0.22 * hl);
            c.restore();
          }
        },
      });

      // a cold breath of light from above as the hologram arrives (top of frame only, flickering)
      if (hl > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(0, 0, 0, 900);
        g.addColorStop(0, K.css(P.violetMid, 0.07 * hl));
        g.addColorStop(1, K.css(P.violetMid, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 1080, 900);
        ctx.restore();
      }

      // 5. vignette
      vignette(ctx);
    },
  });
})();
