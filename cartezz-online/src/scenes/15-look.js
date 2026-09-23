/*
 * 15 look: He looks at us — T 28.0 to 29.333 (city plate, cut in, grain held).
 *
 * Close, from behind: his shoulders, the back of his cap and hair against the glowing face of the pressed
 * ONLINE button (the frozen world; the bottoms of its giant letters behind him). He turns his head over his
 * left shoulder into profile facing screen left, then his eye slides to the lens: a side-glance straight at
 * us. Calm, a little knowing. The world is frozen; he is not.
 *
 *   T 28.000  still, facing the button (turn 0)
 *   T 28.333  the head turns over the shoulder (turn 0 → 1, on twos, inOutCubic)
 *   T 28.833  the eye slides to the camera (gaze 0 → 1 over 3 drawings)
 *   T 29.083  a single blink (2 drawings). Hold.
 *
 * Layers, back to front:
 *   1. kit.city at T_PRESS from the background camera, rendered at a third of the resolution (the lens is
 *      focused on him: the button is soft behind), then graded so the frame keeps its darks: the light pools
 *      behind his head and under the letters, and falls to black at the edges and around his shoulders
 *   2. light wrap: the button's light bleeding around his silhouette
 *   3. kit.head (dir −1, body 'back', lit from behind, rim 1)
 *   4. vignette
 */
(function () {
  'use strict';
  const ID = 'look';
  const FILM = window.FILM;
  const LIB = FILM.lib;
  const K = FILM.kit;
  const P = LIB.pal;
  const E = LIB.ease;
  const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  // Storyboard G4 / shot 15 (16 starts its pull-back from exactly this camera)
  const BG_CAM = { pos: [-0.9, 1.62, 214.6], yaw: 0.1, pitch: 0.05, f: 1100 };
  const HEAD_X = 540, HEAD_Y = 820;
  const S0 = 500, S1 = 540;
  const B = K.B;
  const T_TURN = 42.5 * B, TURN_N = 6; // T 28.333 (8th); 0.5 s on twos = 6 drawings, landing by 28.833
  const T_GAZE = 43.25 * B, GAZE_N = 3; // T 28.833 (16th)
  const T_BLINK = 43.625 * B; // T 29.083
  const BLINK = [1, 0.45]; // closed, half open, then open
  const BG_Q = 1 / 3; // background resolution (soft focus)

  let SCR = null;
  function scratch(w, h) {
    if (!SCR || SCR.width !== w || SCR.height !== h) SCR = FILM.makeCanvas(w, h);
    return SCR;
  }

  /** The frozen city behind him, out of focus: rendered small, drawn back up with smoothing. */
  function background(ctx) {
    const S = ctx.canvas.width / 1080;
    const w = Math.max(2, Math.round(1080 * S * BG_Q)), h = Math.max(2, Math.round(1920 * S * BG_Q));
    const cv = scratch(w, h);
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.fillStyle = P.void;
    g.fillRect(0, 0, w, h);
    const k = w / 1080;
    g.setTransform(k, 0, 0, k, 0, 0);
    K.city(g, BG_CAM, K.T_PRESS, { px: k, lw: 1 / Math.max(0.2, k) * 0.6 });
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cv, 0, 0, w, h, 0, 0, 1080, 1920);
    ctx.restore();
  }

  /** Keep the darks: multiply the lavender face down everywhere but a pool behind his head and the letters. */
  function gradeBackground(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    let g = ctx.createRadialGradient(560, 520, 120, 560, 560, 960);
    g.addColorStop(0, P.bone);
    g.addColorStop(0.3, K.css(K.mix(P.bone, P.violetInk, 0.3)));
    g.addColorStop(0.58, K.css(K.mix(P.bone, P.violetInk, 0.85)));
    g.addColorStop(0.85, K.css(K.mix(P.violetInk, P.void, 0.5)));
    g.addColorStop(1, P.void);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1080, 1920);
    // the letters band stays lit across the top; the lower frame (behind his coat) sinks to black
    g = ctx.createLinearGradient(0, 0, 0, 1920);
    g.addColorStop(0, P.bone);
    g.addColorStop(0.42, P.bone);
    g.addColorStop(0.64, K.css(K.mix(P.bone, P.violetInk, 0.65)));
    g.addColorStop(1, P.void);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1080, 1920);
    ctx.restore();
    // the letters bloom a little through the soft focus
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    g = ctx.createLinearGradient(0, 0, 0, 640);
    g.addColorStop(0, K.css(P.violetHot, 0.0));
    g.addColorStop(0.5, K.css(P.violetHot, 0.07));
    g.addColorStop(1, K.css(P.violetHot, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1080, 640);
    ctx.restore();
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const t = clamp(tIn, 0, info.dur);
      const T = info.shot.start + t;
      // drawings since an event, with a one-drawing lead so the change shows on the event frame
      const drawn = (a) => (T < a - 1e-6 ? 0 : Math.floor((T - a) * 12 + 1e-6) + 1);
      const turn = E.inOutCubic(clamp(drawn(T_TURN) / TURN_N));
      const gaze = clamp(drawn(T_GAZE) / GAZE_N);
      const bk = drawn(T_BLINK);
      const blink = bk >= 1 && bk <= BLINK.length ? BLINK[bk - 1] : 0;
      // a trace of a smile once his eye has landed (knowing, not a grin)
      const smile = 0.14 * clamp((drawn(T_GAZE + 3 / 12)) / 3);
      const s = lerp(S0, S1, E.inOutSine(t / info.dur));
      const hy = HEAD_Y + (s - S0) * 0.25;

      // 1. background (soft), graded
      background(ctx);
      gradeBackground(ctx);
      // 2. light wrap: the button's light bleeding around his head and shoulders
      K.glow(ctx, HEAD_X + 20, hy - 0.1 * s, s * 1.1, P.violetMid, 0.55);
      K.glow(ctx, HEAD_X, hy + 0.7 * s, s * 1.6, P.violetMid, 0.25);
      // 3. Cartezz
      K.head(ctx, HEAD_X, hy, s, {
        dir: -1,
        body: 'back',
        turn,
        gaze,
        expr: { blink, smile },
        light: { front: -1, amt: 0.8 },
        rim: 1,
      });
      // 4. vignette
      ctx.save();
      let g = ctx.createRadialGradient(540, 820, 520, 540, 900, 1250);
      g.addColorStop(0, K.css(P.void, 0));
      g.addColorStop(1, K.css(P.void, 0.7));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1080, 1920);
      for (const side of [0, 1]) {
        g = ctx.createLinearGradient(side ? 1080 : 0, 0, side ? 780 : 300, 0);
        g.addColorStop(0, K.css(P.void, 0.75));
        g.addColorStop(1, K.css(P.void, 0));
        ctx.fillStyle = g;
        ctx.fillRect(side ? 780 : 0, 0, 300, 1920);
      }
      ctx.restore();
    },
  });
})();
