/*
 * Shot 16 — pull-back: "It was inside the avatar".
 * Global T 29.333 → 32.000 (local t 0 → 2.667), city → screen, cut in, grain held (post.hold).
 *
 * The payoff: one continuous pull from Cartezz's shoulders at the ONLINE button, back and up the frozen
 * street to CAM_AVATAR, and then the frame itself shrinks into the avatar circle of the profile (G2 → G1).
 *
 * Phases (local t):
 *   A  0.000 → 1.167  (T 29.333 → 30.500)  3D pull: start close behind him (head + shoulders against the glowing
 *                     button face), then rush back and up to CAM_AVATAR on a log-distance curve (inOutCubic).
 *   B  0.917 → 2.000  (T 30.250 → 31.333)  2D zoom Z 6.882 → 1 about the avatar centre (inOutCubic):
 *                     screen = c + Z · (p − (540, 540)), c = (540, 960) at the handoff → (540, 540) at Z = 1
 *                     (linear in Z), so it starts on the full frame and ends on G1 exactly. The avatar content keeps showing the 3D
 *                     camera of phase A (which lands on CAM_AVATAR at 30.5), so the two moves overlap without a
 *                     dead frame. At Z = HALF_DIAG / 160 the avatar content is exactly the full-frame render.
 *   C  2.000 → 2.667  (T 31.333 → 32.000)  hold on G1 exactly (kit.profile, six bubbles, `2 online`, `12:14`).
 *
 * Layers, back to front:
 *   A: 1 kit.city from the moving camera (frozen world, cityTime) · 2 Cartezz (kit.figure, arm 1) in the same pass.
 *   B: 1 kit.profile (avatar content off) under the zoom · 2 the avatar content (kit.city, kit.avatar's mapping)
 *      · 3 the profile's scanlines inside the disc · 4 the avatar ring (kit.profile, ring only).
 *   C: kit.profile, untouched.
 */
(function () {
  'use strict';
  const ID = 'pull-back';
  const FILM = window.FILM;
  const LIB = FILM.lib;
  const K = FILM.kit;
  const P = LIB.pal;
  const E = LIB.ease;
  const FR = 1 / 24;
  const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------------------------------------------------------------------------
  // Timing (local seconds; global in comments)
  // ---------------------------------------------------------------------------
  const B = K.B;
  const A0 = 0; //            T 29.333  pull starts (from 15's glance)
  const A1 = 28 * FR; //      T 30.500  lands on CAM_AVATAR
  const B0 = 22 * FR; //      T 30.250  zoom-out starts (the handoff frame)
  const B1 = 3 * B; //        T 31.333  G1 reached
  // hold to the end of the shot (T 32.000)

  // ---------------------------------------------------------------------------
  // Geometry
  // ---------------------------------------------------------------------------
  const AV = K.G1.avatar; //            (540, 540) r 160
  const Z_HAND = K.HALF_DIAG / AV.r; // 6.882: the avatar's content lands on the full frame
  const K_AV = AV.r / K.HALF_DIAG; //   kit.avatar's frame → circle scale
  const LW_AV = (1 / Math.max(K_AV, 0.05)) * Math.min(1, 0.6 + K_AV); // kit.avatar's line multiplier
  // on-screen line width inside the avatar goes from 1 (full frame, Z_HAND) to kit.avatar's (Z = 1)
  const LW_EXP = Math.log(1 / (LW_AV * K_AV)) / Math.log(Z_HAND);

  const HIM = { x: 0, z: 219.3 }; // Cartezz at the button (G3), arm raised, pressed
  const HEAD = [0, 1.72, 219.3]; //   the anchor the log-distance is measured from

  // Start: exactly shot 15's background camera (storyboard G4), so the frozen city behind him is the one 15 ends on.
  const CAM_START = { pos: [-0.9, 1.62, 214.6], yaw: 0.1, pitch: 0.05, f: 1100 };
  const CAM_END = K.CAM_AVATAR;
  const D0 = Math.hypot(CAM_START.pos[0] - HEAD[0], CAM_START.pos[1] - HEAD[1], CAM_START.pos[2] - HEAD[2]);
  const D1 = Math.hypot(CAM_END.pos[0] - HEAD[0], CAM_END.pos[1] - HEAD[1], CAM_END.pos[2] - HEAD[2]);

  /** Camera of phase A at local t: log-distance travel, inOutCubic (slow start, rush, land). */
  function camAt(t) {
    const u = E.inOutCubic(clamp((t - A0) / (A1 - A0)));
    if (u >= 1) return { pos: CAM_END.pos.slice(), yaw: CAM_END.yaw, pitch: CAM_END.pitch, f: CAM_END.f };
    const d = D0 * Math.pow(D1 / D0, u);
    const s = (d - D0) / (D1 - D0); // path fraction: exponential in u
    // the lift runs a little ahead of the retreat, so the camera climbs off his shoulder as it pulls away
    const sy = Math.pow(s, 0.8);
    const sp = CAM_START.pos, ep = CAM_END.pos;
    // angles: tilt down onto the street while travelling (between the eased time and the path fraction)
    const w = lerp(s, u, 0.55);
    return {
      pos: [lerp(sp[0], ep[0], s), lerp(sp[1], ep[1], sy), lerp(sp[2], ep[2], s)],
      yaw: lerp(CAM_START.yaw, CAM_END.yaw, w),
      pitch: lerp(CAM_START.pitch, CAM_END.pitch, w),
      f: lerp(CAM_START.f, CAM_END.f, w),
    };
  }

  /** Zoom of phase B at local t. */
  function zoomAt(t) {
    return lerp(Z_HAND, 1, E.inOutCubic(clamp((t - B0) / (B1 - B0))));
  }

  // He lowered his arm to turn and look at us in 15; he is drawn arm-down while he is big enough to read, and
  // with the kit's pressed pose (arm 1, as kit.avatar draws him) once he is a few pixels tall on screen
  // (`scr` = screen px per drawing px: K_AV · Z inside the zooming avatar).
  function drawHim(c, C, rim, scr = 1) {
    const f = C.project(HIM.x, 0, HIM.z), hd = C.project(HIM.x, 1.85, HIM.z);
    const h = f && hd ? Math.hypot(hd[0] - f[0], hd[1] - f[1]) : 0;
    const pose = { arm: h * scr > 12 ? 0 : 1 };
    if (rim != null) pose.rim = rim;
    K.figure(c, C, HIM.x, HIM.z, pose);
  }

  // ---------------------------------------------------------------------------
  // The opening (T 29.333 → 30.0): the cut from 15. His head and shoulders fill the frame as 15 left them
  // (kit.head, s 540 at (540, 830), profile, eye on the lens), over 15's soft, hard-graded button face. The
  // figure is magnified about his head and relaxes to its true 3D projection by T_X (a dolly out: the near head
  // shrinks fast, the far city slowly); the focus pulls to the city and the grade lets go by GRADE_END.
  // ---------------------------------------------------------------------------
  const T_X = 12 * FR; //       T 29.833  the figure is at its true projection; the city in focus
  const GRADE_HOLD = 6 * FR; // T 29.583  15's grade starts to let go
  const GRADE_END = 16 * FR; // T 30.000  15's grade fully released
  const HEAD15 = { x: 540, y: 830, s: 540 }; // shot 15's last head (HEAD_X, HEAD_Y + push, S1)
  const HEAD_C = [HIM.x, 0.925 * 1.85, HIM.z]; // his head centre in the world (figure: crown 0.985 h, head 0.12 h)
  const HEAD_M = 0.12 * 1.85; //                  head height, metres
  const BUST = { dir: -1, body: 'back', turn: 1, gaze: 1, expr: { blink: 0, smile: 0.14 }, light: { front: -1, amt: 0.8 }, rim: 1 };
  const BUST_SEAM = 1.65; // the bust is cut below its shoulders (in head heights); the figure's coat carries on
  const BUST_NECK = [0.75, 0.5]; // above this (head heights below the head centre) the figure hides behind the
  //                                bust: at the neck on the cut (his long hair stays hidden), under the shoulder line as he shrinks
  const BG_Q0 = 1 / 3; //    shot 15's background resolution (soft focus)

  /** 15's grade strength: held through the first 6 frames (the cut), released by GRADE_END. */
  const gradeAt = (t) => 1 - E.inOutSine(clamp((t - GRADE_HOLD) / (GRADE_END - GRADE_HOLD)));

  /** Magnify-about-the-head wrapper of camera C: the figure lands on 15's head at v = 0, on the truth at v = 1. */
  function heldCam(C, v, hs0) {
    const pH = C.project(HEAD_C[0], HEAD_C[1], HEAD_C[2]);
    if (!pH) return { C, s: 0, x: 0, y: 0 };
    const m = Math.pow(HEAD15.s / hs0, 1 - v);
    const ax = lerp(HEAD15.x, pH[0], v), ay = lerp(HEAD15.y, pH[1], v);
    const W = Object.assign({}, C);
    W.project = (x, y, z) => {
      const p = C.project(x, y, z);
      return p ? [ax + m * (p[0] - pH[0]), ay + m * (p[1] - pH[1]), p[2], p[3] * m] : null;
    };
    return { C: W, s: pH[3] * HEAD_M * m, x: ax, y: ay, m };
  }

  let SCR = null;
  function scratch(w, h) {
    if (!SCR || SCR.width < w || SCR.height < h) SCR = FILM.makeCanvas(Math.max(w, SCR ? SCR.width : 0), Math.max(h, SCR ? SCR.height : 0));
    return SCR;
  }

  /** The frozen city at resolution q (1/3 = shot 15's soft focus … 1 = sharp), without him. */
  function softCity(ctx, spec, T, q, S) {
    if (q >= 0.999) {
      K.city(ctx, spec, T, { px: S });
      return;
    }
    const full = Math.round(1080 * S);
    const w = Math.max(2, Math.round(1080 * S * q)), h = Math.max(2, Math.round(1920 * S * q));
    const cv = scratch(full, Math.round(1920 * S));
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.fillStyle = P.void;
    g.fillRect(0, 0, w + 2, h + 2);
    const k = w / 1080;
    g.setTransform(k, 0, 0, k, 0, 0);
    // line weight eases from 15's soft-focus setting to the full-frame one
    K.city(g, spec, T, { px: k, lw: lerp((1 / Math.max(0.2, k)) * 0.6, 1, (q - BG_Q0) / (1 - BG_Q0)) });
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cv, 0, 0, w, h, 0, 0, 1080, 1920);
    ctx.restore();
  }

  /** Shot 15's grade of the button face (keeps the darks), at strength a (multiply layers mixed in by alpha). */
  function grade15(ctx, a) {
    if (a <= 0.001) return;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = a;
    let g = ctx.createRadialGradient(560, 520, 120, 560, 560, 960);
    g.addColorStop(0, P.bone);
    g.addColorStop(0.3, K.css(K.mix(P.bone, P.violetInk, 0.3)));
    g.addColorStop(0.58, K.css(K.mix(P.bone, P.violetInk, 0.85)));
    g.addColorStop(0.85, K.css(K.mix(P.violetInk, P.void, 0.5)));
    g.addColorStop(1, P.void);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1080, 1920);
    g = ctx.createLinearGradient(0, 0, 0, 1920);
    g.addColorStop(0, P.bone);
    g.addColorStop(0.42, P.bone);
    g.addColorStop(0.64, K.css(K.mix(P.bone, P.violetInk, 0.65)));
    g.addColorStop(1, P.void);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1080, 1920);
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    g = ctx.createLinearGradient(0, 0, 0, 640);
    g.addColorStop(0, K.css(P.violetHot, 0));
    g.addColorStop(0.5, K.css(P.violetHot, 0.07 * a));
    g.addColorStop(1, K.css(P.violetHot, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1080, 640);
    ctx.restore();
  }

  /** Shot 15's vignette (radial + side walls), at strength a. */
  function vignette15(ctx, a) {
    if (a <= 0.001) return;
    ctx.save();
    let g = ctx.createRadialGradient(540, 820, 520, 540, 900, 1250);
    g.addColorStop(0, K.css(P.void, 0));
    g.addColorStop(1, K.css(P.void, 0.7 * a));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1080, 1920);
    for (const side of [0, 1]) {
      g = ctx.createLinearGradient(side ? 1080 : 0, 0, side ? 780 : 300, 0);
      g.addColorStop(0, K.css(P.void, 0.75 * a));
      g.addColorStop(1, K.css(P.void, 0));
      ctx.fillStyle = g;
      ctx.fillRect(side ? 780 : 0, 0, 300, 1920);
    }
    ctx.restore();
  }

  /** Phase A before T_X: soft graded city, the magnified figure, 15's bust over it, the vignette. */
  function opening(ctx, t, T, S) {
    const spec = camAt(t);
    const v = E.inOutCubic(clamp(t / T_X));
    const ga = gradeAt(t);
    softCity(ctx, spec, T, lerp(BG_Q0, 1, E.inOutSine(clamp(t / T_X))), S);
    grade15(ctx, ga);
    const C = K.cam(spec);
    const C0 = K.cam(CAM_START);
    const p0 = C0.project(HEAD_C[0], HEAD_C[1], HEAD_C[2]);
    const hs0 = p0[3] * HEAD_M;
    const H = heldCam(C, v, hs0);
    const bustA = clamp((H.s - 70) / (150 - 70));
    // light wrap: the button's light bleeding around his head and shoulders (15's), shrinking with him
    K.glow(ctx, H.x + 20 * H.s / HEAD15.s, H.y - 0.1 * H.s, H.s * 1.1, P.violetMid, 0.55 * ga);
    K.glow(ctx, H.x, H.y + 0.7 * H.s, H.s * 1.6, P.violetMid, 0.25 * ga);
    // the magnified figure under 15's detailed bust: its rim thins as it is blown up (the kit's rim is a fixed
    // fraction of his height). Above the neck it stays hidden while the bust holds (its cap and hair would
    // peek around the profile head) and comes in as the bust lets go; below, his coat and arms carry on.
    const rim = H.m > 1.001 ? Math.pow(H.m, -0.75) : null;
    const neckY = H.y + lerp(BUST_NECK[0], BUST_NECK[1], clamp(v / 0.2)) * H.s;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-10, neckY, 1100, Math.max(0, 1940 - neckY));
    ctx.clip();
    drawHim(ctx, H.C, rim);
    ctx.restore();
    if (bustA < 1) {
      ctx.save();
      ctx.globalAlpha *= 1 - bustA;
      ctx.beginPath();
      ctx.rect(-10, -10, 1100, neckY + 10);
      ctx.clip();
      drawHim(ctx, H.C, rim);
      ctx.restore();
    }
    if (bustA > 0) {
      ctx.save();
      ctx.globalAlpha *= bustA;
      ctx.beginPath();
      ctx.rect(-10, -10, 1100, H.y + BUST_SEAM * H.s);
      ctx.clip();
      K.head(ctx, H.x, H.y, H.s, BUST);
      ctx.restore();
    }
    vignette15(ctx, ga);
  }

  // ring only, through the kit (drawn after the local avatar content, as kit.profile orders it)
  const RING_ONLY = {
    bg: false, fade: false, avatar: false, bubbles: [0, 0, 0, 0, 0, 0],
    show: {
      brackets: 0, frame: 0, header: 0, status: 0, back: 0, edit: 0, avatar: 0, ring: 1, name: 0,
      badgeGold: 0, presence: 0, tiles: 0, music: 0, username: 0, tabs: 0,
    },
  };
  const BUBBLES = [1, 1, 1, 1, 1, 1];
  const NO_RING = { ring: 0 };

  /**
   * The profile under the zoom Z, with the avatar content drawn from camera `camSpec` using kit.avatar's exact
   * mapping (k = r / HALF_DIAG, centre of frame → centre of circle, clipped). Local because kit.avatar has no
   * line-width override: its hairline multiplier (≈ 5.1 at r 160) would draw the city's edges 5× too thick once
   * magnified by Z, and the handoff would not be seamless. At Z = 1 and camSpec = CAM_AVATAR this is kit.avatar.
   */
  function zoomedProfile(ctx, T, Z, camSpec, S) {
    ctx.save();
    // the zoom centre rides from the frame centre (540, 960) at the handoff to the avatar centre (540, 540) at
    // Z = 1, so the zoom lands on G1 itself (a fixed centre at (540, 960) would leave the profile 420 px low)
    const cy = AV.y + (960 - AV.y) * ((Z - 1) / (Z_HAND - 1));
    ctx.translate(540, cy);
    ctx.scale(Z, Z);
    ctx.translate(-AV.x, -AV.y);
    // 1 — the screen, without the avatar content and its ring (the ring goes over the content, in 4)
    K.profile(ctx, { T, bubbles: BUBBLES, avatar: false, show: NO_RING });
    // 2 — the avatar content (kit.avatar's transform)
    ctx.save();
    ctx.beginPath();
    ctx.arc(AV.x, AV.y, AV.r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = P.void;
    ctx.fillRect(AV.x - AV.r, AV.y - AV.r, AV.r * 2, AV.r * 2);
    ctx.save();
    ctx.translate(AV.x, AV.y);
    ctx.scale(K_AV, K_AV);
    ctx.translate(-540, -960);
    K.city(ctx, camSpec, T, {
      px: K_AV * S * Z,
      lw: LW_AV * Math.pow(Z, LW_EXP - 1),
      extra: (c, C) => drawHim(c, C, null, K_AV * Z),
    });
    ctx.restore();
    // 3 — the profile's scanlines run over the avatar too (kit.profile draws them after it); they come in with
    //     the screen (absent on the handoff frame, where the avatar content *is* the full frame)
    const scan = (Z_HAND - Z) / (Z_HAND - 1);
    ctx.globalAlpha = 0.03 * scan;
    ctx.fillStyle = P.bone;
    for (let y = 142; y < 1450; y += 6) ctx.fillRect(32, y, 1016, 1);
    ctx.restore();
    // 4 — the ring, over the content
    K.profile(ctx, RING_ONLY);
    ctx.restore();
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const t = clamp(tIn, 0, info.dur);
      const T = info.T;
      const S = info.S || FILM.S || 1;
      ctx.fillStyle = P.void;
      ctx.fillRect(0, 0, 1080, 1920);

      if (t < T_X) {
        // A1 — the cut from 15: his head and shoulders, 15's grade, then the dolly out
        opening(ctx, t, T, S);
        return;
      }
      if (t < B0) {
        // A2 — the 3D pull through the frozen city (full frame); the last of 15's grade lets go by T 30.0
        const ga = gradeAt(t);
        if (ga > 0.001) {
          // while 15's grade is still on, he stays in front of it (as in the opening): no pop at T_X
          const C = K.city(ctx, camAt(t), T, { px: S });
          grade15(ctx, ga);
          drawHim(ctx, C);
          vignette15(ctx, ga);
        } else {
          K.city(ctx, camAt(t), T, { px: S, extra: (c, C) => drawHim(c, C) });
        }
        return;
      }
      if (t < B1) {
        // B — the frame shrinks into the avatar (the handoff frame B0 is Z = 6.882: identical to the full frame)
        zoomedProfile(ctx, T, zoomAt(t), camAt(t), S);
        return;
      }
      // C — G1, exactly. Stillness.
      K.profile(ctx, { T, bubbles: BUBBLES });
    },
  });
})();
