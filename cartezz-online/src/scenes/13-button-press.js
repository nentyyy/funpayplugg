/*
 * 13 button-press: The press — T 25.333 to 26.667 (city plate, cut in).
 *
 * Over his right shoulder, medium: his silhouette (≈ 1000 px) against the glowing face of the ONLINE
 * button, which fills the frame; the bottoms of the giant letters cropped at the top. His right arm rises
 * (kit arm 0 → 1 by 26.5, inOutCubic, on twos); the face brightens under the approaching hand; on the last
 * four frames the palm meets the surface and the light blooms around it. Cut on the action (the press
 * itself is the flash on 14's first frame).
 *
 * Layers, back to front:
 *   1. kit.city from the over-the-shoulder camera (the button face, its bezel, the plaza floor)
 *   2. face grade: the pill's light falls off into dark away from him (multiplied mask); hot spot under the hand
 *   3. light wrap behind his silhouette
 *   4. Cartezz (kit.figure, back view, arm from kit.cartezzAt)
 *   5. contact: bloom around the palm, a ring of light spreading on the face plane
 *   6. frame grade: vignette
 */
(function () {
  'use strict';
  const ID = 'button-press';
  const FILM = window.FILM;
  const LIB = FILM.lib;
  const K = FILM.kit;
  const P = LIB.pal;
  const E = LIB.ease;
  const TAU = Math.PI * 2;
  const FR = 1 / 24;
  const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => {
    const u = clamp((x - a) / (b - a));
    return u * u * (3 - 2 * u);
  };

  // Storyboard G4 / shot 13 (yaw adjusted so his shoulder sits left of centre and the hand reaches the middle)
  const CAM0 = { pos: [0.9, 0.5, 216.8], yaw: -0.3, pitch: 0.42, f: 1300 };
  const CAM1 = { pos: [0.9, 0.5, 216.8], yaw: -0.3, pitch: 0.42, f: 1345 };
  const T_REACH = 26.5; // arm fully out, palm at the surface
  const FACE_Z = K.BUTTON.z - 0.02;

  /** World point on the plane z = zp seen behind screen point (sx, sy) of camera C. */
  function unproject(C, sx, sy, zp) {
    const cY = Math.cos(C.yaw), sY = Math.sin(C.yaw), cP = Math.cos(C.pitch), sP = Math.sin(C.pitch);
    const xc = (sx - C.cx) / C.f, yc = -(sy - C.cy) / C.f, zc = 1;
    const dy = yc * cP + zc * sP;
    const zf = zc * cP - yc * sP;
    const dx = xc * cY + zf * sY;
    const dz = -xc * sY + zf * cY;
    const k = (zp - C.pos[2]) / dz;
    return [C.pos[0] + dx * k, C.pos[1] + dy * k, zp];
  }

  /** A ring of radius r (metres) on the face plane around world point W, as a projected closed path. */
  function faceRing(ctx, C, W, r) {
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * TAU;
      const p = C.project(W[0] + Math.cos(a) * r, W[1] + Math.sin(a) * r, W[2]);
      if (!p) {
        pen = false;
        continue;
      }
      pen ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
      pen = true;
    }
    ctx.closePath();
  }

  /**
   * Where kit.cartezz puts his hands (standing, back view), in figure units from the feet (y up):
   * the right hand lerps from its hanging place to (0.235, 0.8) with inOutSine(arm), the elbow likewise.
   * ang = screen rotation of the forearm (0 = pointing up).
   */
  function kitHands(arm) {
    const a = E.inOutSine(clamp(arm));
    const hx = lerp(0.15, 0.235, a), hy = lerp(0.469, 0.8, a);
    const ex = lerp(0.155, 0.2, a), ey = lerp(0.62, 0.71, a);
    return {
      r: { x: hx, y: hy - 0.012, ang: Math.atan2(hx - ex, hy - ey) },
      l: { x: -0.15, y: 0.469 - 0.012, ang: Math.atan2(-0.15 + 0.155, 0.469 - 0.62) },
    };
  }

  /**
   * The back of his hand as a silhouette (the kit's hand is a small disc, which reads as a ball at this size).
   * (x, y) = the kit's hand centre, h = figure height px, ang = forearm direction (0 up), open 0 relaxed … 1 pressed flat,
   * hotK 0..1 turns the rim from violet to the white-hot light of the face at contact.
   * Right hand seen from behind: the thumb is on the left.
   */
  function handSil(ctx, x, y, h, ang, open, side, hotK) {
    const u = h * 0.001; // 1 unit = 0.1% of his height
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(u * side, u);
    const sp = open * 0.16; // finger spread (rad)
    const path = new Path2D();
    // wrist (reaching back into the kit's forearm) and palm up to the knuckles (y −18)
    path.moveTo(-12, 58);
    path.lineTo(-15, 26);
    path.quadraticCurveTo(-21, 4, -19, -16);
    path.lineTo(19, -18);
    path.quadraticCurveTo(22, 4, 14, 26);
    path.lineTo(12, 58);
    path.closePath();
    // four fingers from the knuckles
    const fl = [34, 39, 37, 29];
    for (let i = 0; i < 4; i++) {
      const bx = -14 + i * 9.5, a = (i - 1.5) * sp;
      const L = fl[i] * (1 - 0.25 * (1 - open));
      const tx = bx + Math.sin(a) * L, ty = -16 - Math.cos(a) * L;
      const w = 4.3;
      const nx = Math.cos(a) * w, ny = Math.sin(a) * w;
      path.moveTo(bx - nx, -14 - ny);
      path.lineTo(tx - nx, ty - ny);
      path.quadraticCurveTo(tx + Math.sin(a) * 5, ty - Math.cos(a) * 5, tx + nx, ty + ny);
      path.lineTo(bx + nx, -14 + ny);
      path.closePath();
    }
    // thumb: out to the left, rising away from the palm as the hand opens
    const ta = -0.35 - 0.55 * open; // angle from the finger axis
    const tl = 24 + 6 * open;
    const bx = -15, by = 10;
    const tx = bx + Math.sin(ta) * tl, ty = by - Math.cos(ta) * tl;
    const nx = Math.cos(ta) * 5.5, ny = Math.sin(ta) * 5.5;
    path.moveTo(bx - nx, by + 8 - ny);
    path.lineTo(tx - nx, ty - ny);
    path.quadraticCurveTo(tx + Math.sin(ta) * 6, ty - Math.cos(ta) * 6, tx + nx, ty + ny);
    path.lineTo(bx + nx + 6, by - 6 + ny);
    path.closePath();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = K.css(K.mix(P.violetMid, P.hot, hotK), 0.55 + 0.4 * Math.max(open, hotK));
    ctx.lineWidth = Math.max(2 / u, 5 + 3 * hotK);
    ctx.stroke(path);
    ctx.fillStyle = K.css(K.mix(P.skinDeep, P.coat, 0.5));
    ctx.fill(path);
    ctx.restore();
  }

  /** The pill face's diffuser: a fine grid on the face plane, readable only from arm's length. */
  function faceGrid(ctx, C) {
    const z = FACE_Z, y0 = K.BUTTON.y0 + 0.05, y1 = 9.5, x0 = -4.5, x1 = 5, st = 0.16;
    ctx.save();
    ctx.strokeStyle = K.css(P.violetInk, 0.11);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = x0; x <= x1 + 1e-6; x += st) {
      const s = K.projSeg(C, [x, y0, z], [x, y1, z]);
      if (!s) continue;
      ctx.moveTo(s[0][0], s[0][1]);
      ctx.lineTo(s[1][0], s[1][1]);
    }
    for (let y = y0; y <= y1 + 1e-6; y += st) {
      const s = K.projSeg(C, [x0, y, z], [x1, y, z]);
      if (!s) continue;
      ctx.moveTo(s[0][0], s[0][1]);
      ctx.lineTo(s[1][0], s[1][1]);
    }
    ctx.stroke();
    ctx.restore();
  }

  let MASK = null;
  /**
   * Multiply mask over the button face: a dark base (the face reads as violet-black at the frame edges),
   * lit pools behind his head, around the hand (growing as the palm nears) and under the giant letters.
   * Drawn at 1/8 resolution (smooth gradients only), then multiplied up over the frame.
   */
  function faceFalloff(ctx, headX, headY, hx, hy, h, near, contact) {
    const q = 1 / 8, w = Math.round(1080 * q), ht = Math.round(1920 * q);
    if (!MASK) MASK = FILM.makeCanvas(w, ht);
    const g = MASK.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.fillStyle = K.css(K.mix(P.violetInk, P.void, 0.35));
    g.fillRect(0, 0, w, ht);
    g.setTransform(q, 0, 0, q, 0, 0);
    g.globalCompositeOperation = 'lighter';
    const pool = (x, y, r, a) => {
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, K.css(P.bone, a));
      rg.addColorStop(0.45, K.css(P.bone, a * 0.55));
      rg.addColorStop(1, K.css(P.bone, 0));
      g.fillStyle = rg;
      g.fillRect(x - r, y - r, 2 * r, 2 * r);
    };
    pool(headX, headY + 0.1 * h, 0.75 * h, 0.85);           // behind his head and shoulders
    pool(hx, hy, h * (0.45 + 0.2 * near + 0.2 * contact), 0.35 + 0.45 * near + 0.3 * contact); // where the palm goes
    pool(560, 170, 640, 0.75);                              // under the letters
    pool(headX, headY + 0.45 * h, 0.55 * h, 0.35);          // down his back (keeps the rim readable)
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(MASK, 0, 0, w, ht, 0, 0, 1080, 1920);
    ctx.restore();
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const t = clamp(tIn, 0, info.dur);
      const T = info.shot.start + t;
      const spec = K.lerpCam(CAM0, CAM1, E.inOutSine(t / info.dur));
      const s = K.cartezzAt(T);
      // the arm on twos (the kit value, held per drawing)
      const Td = info.shot.start + LIB.onTwos(t);
      const arm = K.cartezzAt(Td).arm;
      // contact: visible on the 26.5 frame, full on the last frame (26.625)
      const contact = T < T_REACH - 1e-6 ? 0 : clamp((T - T_REACH) / (3 * FR) + 1 / 4);
      const breath = K.beatPulse(K.cityTime(T), 0.5);
      K.city(ctx, spec, T, {
        extra: (c, C) => {
          const f = C.project(s.x, 0, s.z), hd = C.project(s.x, 1.85, s.z);
          if (!f || !hd) return;
          const h = Math.hypot(hd[0] - f[0], hd[1] - f[1]);
          const R = kitHands(arm);
          const hx = f[0] + R.r.x * h, hy = f[1] - R.r.y * h;
          const W = unproject(C, hx, hy, FACE_Z);
          // the face's diffuser grid, only visible this close (faint, on the face plane)
          faceGrid(c, C);
          // the face falls off into dark away from him: light only behind his silhouette, under the palm
          // and under the letters (multiplied over the face, before the figure and its rim are drawn)
          faceFalloff(c, f[0], f[1] - 0.93 * h, hx, hy, h, sstep(0.35, 1, arm), contact);
          // 2. the face brightens under the approaching palm
          const near = sstep(0.35, 1, arm);
          K.glow(c, hx, hy, h * (0.3 + 0.12 * near), P.violetHot, 0.3 * near + 0.5 * contact);
          K.glow(c, hx, hy, h * 0.2, P.hot, 0.3 * near + 0.6 * contact);
          // contact on the surface (behind him): small rings spreading from the palm on the face plane
          if (contact > 0) {
            c.save();
            c.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 2; i++) {
              const q = clamp(contact * 1.1 - i * 0.3);
              if (q <= 0) continue;
              faceRing(c, C, W, 0.08 + q * (0.22 + i * 0.2));
              c.strokeStyle = K.css(i ? P.violetHot : P.hot, (0.8 - i * 0.3) * (1 - 0.4 * q));
              c.lineWidth = Math.max(1.5, (3.5 - i) * (1 - 0.4 * q));
              c.stroke();
            }
            c.restore();
          }
          // the bloom around the palm, behind the hand: the light spilling past the fingers
          if (contact > 0) {
            K.glow(c, hx, hy - 0.03 * h, h * 0.32 * (0.6 + 0.4 * contact), P.hot, 0.75 * contact);
            K.glow(c, hx, hy, h * 0.9, P.violetMid, 0.4 * contact);
          }
          // 3. light wrap: a soft bright halo right behind his head and shoulders
          K.glow(c, f[0], f[1] - 0.86 * h, h * 0.42, P.violetHot, 0.35 + 0.1 * breath);
          // 4. the figure, rim from the face; then both hands redrawn as silhouettes at this size
          K.figure(c, C, s.x, s.z, { walk: null, arm, rim: 1 });
          handSil(c, f[0] + R.l.x * h, f[1] - R.l.y * h, h, R.l.ang, 0, 1, 0);
          handSil(c, hx, hy, h, R.r.ang, arm, 1, contact);
          // 5. light wrap over the pressing hand: the glow eats into the silhouette's edges
          if (contact > 0) K.glow(c, hx, hy - 0.03 * h, h * 0.16, P.hot, 0.35 * contact);
        },
      });
      // 6. frame grade: the light falls off into dark toward the floor and the frame sides (not the letters)
      ctx.save();
      let g = ctx.createLinearGradient(0, 1300, 0, 1920);
      g.addColorStop(0, K.css(P.void, 0));
      g.addColorStop(1, K.css(P.void, 0.8));
      ctx.fillStyle = g;
      ctx.fillRect(0, 1300, 1080, 620);
      for (const side of [0, 1]) {
        g = ctx.createLinearGradient(side ? 1080 : 0, 0, side ? 700 : 380, 0);
        g.addColorStop(0, K.css(P.void, (side ? 0.55 : 0.7) - 0.1 * contact));
        g.addColorStop(1, K.css(P.void, 0));
        ctx.fillStyle = g;
        ctx.fillRect(side ? 700 : 0, 0, 380, 1920);
      }
      ctx.restore();
      ctx.restore();
    },
  });
})();
