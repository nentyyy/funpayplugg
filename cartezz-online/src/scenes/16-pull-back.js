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

  // Start: behind him on the axis of shot 15's background camera (G4: pos (−0.9, 1.62, 214.6), yaw 0.1), a step
  // closer: his head and shoulders against the glowing button face, the foot of the huge letters above him.
  const CAM_START = { pos: [-0.5, 1.72, 216.75], yaw: 0.13, pitch: 0.13, f: 1150 };
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

  const drawHim = (c, C) => K.figure(c, C, HIM.x, HIM.z, { arm: 1 });

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
      extra: drawHim,
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

      if (t < B0) {
        // A — the 3D pull through the frozen city (full frame)
        K.city(ctx, camAt(t), T, { px: S, extra: drawHim });
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
