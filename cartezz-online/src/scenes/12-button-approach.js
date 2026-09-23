/*
 * 12 button-approach: ONLINE — T 22.667 to 25.333 (city plate, cut in).
 *
 * Behind him in the plaza: the gigantic ONLINE button fills the middle of the frame; he walks the last
 * metres to it (z = 216.9 + 1.8·(T − 22.667)), stops on the bar-10 downbeat (24.0) and the shot holds
 * its breath while the button breathes on 24.0 and 24.667.
 *
 * Layers, back to front:
 *   1. kit.city from the plaza dolly (sky, towers, the ONLINE button, gifts, searchlights, online dots)
 *   2. the wet plaza floor: a soft mirror of the button and the wall behind it (screen-space copy)
 *   3. his long soft shadow toward the camera (the button is the key light behind him)
 *   4. his reflection on the wet floor, then Cartezz himself (kit.figure, back view)
 *   5. grade: the dark closes in from the frame edges; it tightens during the pause (held breath)
 */
(function () {
  'use strict';
  const ID = 'button-approach';
  const FILM = window.FILM;
  const LIB = FILM.lib;
  const K = FILM.kit;
  const P = LIB.pal;
  const E = LIB.ease;
  const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => {
    const u = clamp((x - a) / (b - a));
    return u * u * (3 - 2 * u);
  };
  const sd = (...k) => LIB.hash(ID, ...k) & 0x7fffffff;

  // Storyboard G4 / shot 12
  const CAM_A = { pos: [0, 2.2, 190], yaw: 0, pitch: 0.12, f: 1150 };
  const CAM_B = { pos: [0, 2.0, 194], yaw: 0, pitch: 0.12, f: 1150 };
  const T_STOP = 24.0; // bar 10: he stops

  /** kit.cartezzAt compares with the literal 22.667; the shot starts at 22.6667, so clamp into the walk. */
  const at = (T) => K.cartezzAt(Math.max(T, 22.667));

  // ---------------------------------------------------------------------------
  // Scratch canvas for the floor reflection (fully redrawn every frame: stateless)
  // ---------------------------------------------------------------------------
  let SCR = null;
  function scratch(w, h) {
    if (!SCR || SCR.width !== w || SCR.height !== h) SCR = FILM.makeCanvas(w, h);
    return SCR;
  }

  /**
   * Wet-floor mirror: everything above the projected base line of the button (screen line y = m·x + c)
   * is flipped under it, softened (quarter resolution), faded with distance and broken by seeded streaks.
   */
  function floorMirror(ctx, m, c, depth, alpha) {
    const src = ctx.canvas;
    const q = 0.25;
    const w = Math.max(2, Math.round(src.width * q)), h = Math.max(2, Math.round(src.height * q));
    const S = src.width / 1080; // device px per frame px
    const cv = scratch(w, h);
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, w, h);
    // frame px -> scratch px
    const k = (w / 1080);
    g.setTransform(k, 0, 0, k, 0, 0);
    g.save();
    // mirror about y = m x + c (vertical flip per column): y' = 2(m x + c) − y
    g.transform(1, 2 * m, 0, -1, 0, 2 * c);
    g.drawImage(src, 0, 0, src.width, src.height, 0, 0, 1080, 1920);
    g.restore();
    // fade: sheared space (u, v) -> (u, m u + c + v), v = distance under the line
    g.save();
    g.globalCompositeOperation = 'destination-in';
    g.transform(1, m, 0, 1, 0, c);
    const fg = g.createLinearGradient(0, 0, 0, depth);
    fg.addColorStop(0, K.css(P.void, 1));
    fg.addColorStop(0.18, K.css(P.void, 0.55));
    fg.addColorStop(0.55, K.css(P.void, 0.16));
    fg.addColorStop(1, K.css(P.void, 0));
    g.fillStyle = fg;
    g.fillRect(-200, 0, 1480, depth);
    g.restore();
    // wet streaks: horizontal breaks in the mirror, denser toward the camera
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.transform(1, m, 0, 1, 0, c);
    const r = LIB.rng(sd('streaks'));
    for (let i = 0; i < 70; i++) {
      const v = Math.pow(r(), 0.8) * depth;
      const x0 = -100 + r() * 1180, len = 80 + r() * 520;
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
    return S;
  }

  /** His long soft shadow thrown toward the camera by the button behind him. */
  function longShadow(ctx, C, x, z, len, a) {
    const pts = [
      [x - 0.28, 0, z + 0.1], [x + 0.28, 0, z + 0.1],
      [x + 0.9, 0, z - len], [x - 0.9, 0, z - len],
    ];
    const sp = K.projPoly(C, pts);
    const f0 = C.project(x, 0, z), f1 = C.project(x, 0, z - len);
    if (!sp || !f0 || !f1) return;
    ctx.save();
    const g = ctx.createLinearGradient(f0[0], f0[1], f1[0], f1[1]);
    g.addColorStop(0, K.css(P.void, 0.7 * a));
    g.addColorStop(0.35, K.css(P.void, 0.32 * a));
    g.addColorStop(1, K.css(P.void, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sp[0][0], sp[0][1]);
    for (let i = 1; i < sp.length; i++) ctx.lineTo(sp[i][0], sp[i][1]);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** His mirror image in the wet floor: the kit figure flipped about his feet, faint and faded. */
  function figureReflection(ctx, C, s, pose, a) {
    const f = C.project(s.x, 0, s.z), hd = C.project(s.x, 1.85, s.z);
    if (!f || !hd) return;
    const h = Math.hypot(hd[0] - f[0], hd[1] - f[1]);
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(f[0], f[1]);
    ctx.scale(1, -0.92);
    ctx.translate(-f[0], -f[1]);
    K.cartezz(ctx, f[0], f[1], h, Object.assign({ view: 'back', rim: 0.5 }, pose));
    ctx.restore();
    // fade the reflection's far end into the floor
    ctx.save();
    const g = ctx.createLinearGradient(0, f[1], 0, f[1] + h * 0.95);
    g.addColorStop(0, K.css(P.voidLift, 0));
    g.addColorStop(1, K.css(P.voidLift, 0.75 * a));
    ctx.fillStyle = g;
    ctx.fillRect(f[0] - h * 0.3, f[1] + 1, h * 0.6, h * 0.95);
    ctx.restore();
  }

  function grade(ctx, pause, breath) {
    ctx.save();
    // the dark comes down from the tops of the towers
    let g = ctx.createLinearGradient(0, 0, 0, 760);
    g.addColorStop(0, K.css(P.void, 0.72 + 0.1 * pause));
    g.addColorStop(0.55, K.css(P.void, 0.3 + 0.1 * pause));
    g.addColorStop(1, K.css(P.void, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1080, 760);
    // and up from the near floor
    g = ctx.createLinearGradient(0, 1380, 0, 1920);
    g.addColorStop(0, K.css(P.void, 0));
    g.addColorStop(1, K.css(P.void, 0.8));
    ctx.fillStyle = g;
    ctx.fillRect(0, 1380, 1080, 540);
    // side vignette, tightening while he waits
    const r0 = lerp(560, 470, pause), r1 = lerp(1250, 1080, pause);
    g = ctx.createRadialGradient(540, 1010, r0, 540, 1010, r1);
    g.addColorStop(0, K.css(P.void, 0));
    g.addColorStop(1, K.css(P.void, 0.78 + 0.1 * pause));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1080, 1920);
    ctx.restore();
    // the button's breath spills over the plaza (additive, on each beat)
    K.glow(ctx, 540, 990, 760, P.violetMid, 0.1 + 0.12 * breath);
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const t = clamp(tIn, 0, info.dur);
      const T = info.shot.start + t;
      // dolly: most of the travel while he walks, then a near-still creep through the pause
      const u = 0.8 * E.outSine(clamp(t / 1.5)) + 0.2 * (t / info.dur);
      const spec = K.lerpCam(CAM_A, CAM_B, u);
      const s = at(T);
      const pose = { walk: s.walk, arm: s.arm };
      const pause = sstep(T_STOP, T_STOP + 1.0, T);
      const breath = K.beatPulse(K.cityTime(T), 0.5);
      K.city(ctx, spec, T, {
        extra: (c, C) => {
          // 2. wet floor mirror about the projected base of the bezel (z 220, y 0)
          const bl = C.project(-13, 0, 220), br = C.project(13, 0, 220);
          if (bl && br) {
            const m = (br[1] - bl[1]) / (br[0] - bl[0]);
            const cc = bl[1] - m * bl[0];
            floorMirror(c, m, cc, 620, 0.55);
          }
          // 3. shadow, 4. reflection + figure
          longShadow(c, C, s.x, s.z, 16, 1);
          figureReflection(c, C, s, pose, 0.3);
          K.figure(c, C, s.x, s.z, Object.assign({ rim: 1 }, pose));
        },
      });
      // 5. grade
      grade(ctx, pause, breath);
    },
  });
})();
