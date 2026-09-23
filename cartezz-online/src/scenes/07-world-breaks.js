/*
 * 07 world-breaks : "The profile unfolds into a city".  T 10.667 – 13.333 (bar 5), transitionIn flash (hot, 2 frames).
 *
 * The flat G1 profile becomes the ground of the city. The camera starts straight above it (pitch −90°, the quad
 * fills the frame exactly like G1: 20 px per metre), then drops and tilts up to street level, ending on shot 08's
 * first camera. The avatar lands on the street at (0, 0, 34) — exactly where Cartezz will stand.
 *
 * World layout of the profile quad: 54 m × 96 m on y = 0, centre z = 13; image px (u, v) → (x, z) =
 * ((u − 540) / 20, 61 − v / 20). So the avatar centre (540, 540) sits at (0, 34); the action tiles at z 4–12;
 * the username card at z −9..−2 (both behind 08's camera, never seen again).
 *
 * Layers, back to front:
 *   1. kit.city (sky, ground, towers rising in a wave from the avatar point, floating gifts, searchlights, dots)
 *   2. the profile quad (offscreen layer: per-cell dissolve, towers and gifts cut out of it so they stand on it)
 *   3. the avatar ring: a shock ring on the flash, a second ring fronting the tower wave on beat 2
 *   4. the action tiles + username card extruded as the first dark towers (their UI on the roof)
 *   5. the 24 gifts sucked into the avatar in 06, blown back out of it on the flash
 *   6. Cartezz materializing at (0, 0, 34) on the 8th after beat 3
 *   7. the flash's violet burst from the avatar point
 *   8. end touches shared with 08 (haze band + wet-road reflection) faded in over the last beat
 */
(function () {
  'use strict';
  const ID = 'world-breaks';
  const LIB = FILM.lib;
  const K = FILM.kit;
  const P = LIB.pal;
  const E = LIB.ease;
  const TAU = Math.PI * 2;
  const FR = 1 / 24;
  const B = K.B;
  const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sd = (...k) => LIB.hash(ID, ...k) & 0x7fffffff;
  const css = K.css, mix = K.mix;

  // ---------------------------------------------------------------------------
  // Beats (global T)
  // ---------------------------------------------------------------------------
  const T0 = 16 * B; //              10.667  bar 5: the break (flash)
  const T_TILES = 17 * B; //         11.333  beat 2: tiles extrude, tower wave starts
  const T_DISSOLVE = 17 * B + 0.06; // the profile crumbles behind the wave, gone by 12.0
  const T_LIGHTS = 18 * B; //        12.000  beat 3: searchlights ignite (kit)
  const T_MAN = 18.5 * B; //         12.333  8th: Cartezz materializes
  const T_END = 20 * B; //           13.333

  // ---------------------------------------------------------------------------
  // The profile quad
  // ---------------------------------------------------------------------------
  const PXM = 20; // px per metre on the quad
  const ZC = 13; // quad centre z
  const QZ1 = ZC + 48; // z of the image top edge (v = 0)
  const wx = (u) => (u - 540) / PXM;
  const wz = (v) => QZ1 - v / PXM;
  const AV = [0, 0, wz(540)]; // the avatar point on the street: (0, 0, 34)
  const PROFILE_T = 10.625; // the avatar content as on 06's last frame

  // Cameras
  const CAM_TOP = { pos: [0, 1050 / PXM, ZC], yaw: 0, pitch: -Math.PI / 2, f: 1050 }; // 96 m ↔ 1920 px
  const CAM_08 = { pos: [0, 1.1, 18], yaw: 0, pitch: 0.2, f: 1050 };

  // Keyframes (t shot-local, camera height y, z, pitch). k0 = G1 seen from straight above; k1 = the profile has
  // "lain down" (the camera orbited back about the quad centre); k2 = gliding forward over the extruded tiles;
  // k3 = shot 08's first camera. Cubic Hermite (Catmull-Rom tangents, zero velocity at both ends).
  const KEYS = [
    { t: 0, y: CAM_TOP.pos[1], z: CAM_TOP.pos[2], p: CAM_TOP.pitch },
    { t: 1.0, y: 30, z: -20, p: -0.9 },
    { t: 1.85, y: 12.5, z: 9, p: -0.2 },
    { t: 20 * B - 16 * B, y: CAM_08.pos[1], z: CAM_08.pos[2], p: CAM_08.pitch },
  ];
  function hermite(t, key) {
    const n = KEYS.length;
    if (t <= KEYS[0].t) return KEYS[0][key];
    if (t >= KEYS[n - 1].t) return KEYS[n - 1][key];
    let i = 0;
    while (t > KEYS[i + 1].t) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const tan = (k) => (k === 0 || k === n - 1 ? 0 : (KEYS[k + 1][key] - KEYS[k - 1][key]) / (KEYS[k + 1].t - KEYS[k - 1].t));
    const h = b.t - a.t;
    const u = (t - a.t) / h;
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * a[key] + (u3 - 2 * u2 + u) * h * tan(i) + (-2 * u3 + 3 * u2) * b[key] + (u3 - u2) * h * tan(i + 1);
  }
  function camAt(t) {
    return { pos: [0, hermite(t, 'y'), hermite(t, 'z')], yaw: 0, pitch: hermite(t, 'p'), f: 1050 };
  }

  // The static profile as a texture (G1, no count, no bubbles: the gifts were pulled into the avatar in 06).
  function profileTex() {
    const S = FILM.S || 1;
    const key = `${ID}:profile:${S}:${PROFILE_T}`;
    return LIB.cached(key, () => {
      const c = FILM.makeCanvas(Math.round(1080 * S), Math.round(1920 * S));
      const g = c.getContext('2d');
      g.scale(S, S);
      K.profile(g, { T: PROFILE_T, bubbles: [0, 0, 0, 0, 0, 0] });
      return c;
    });
  }

  // Roof textures for the extruded tiles: the tile's own pixels, clipped to its rounded rect.
  const TILES = K.G1.tiles.map((t, i) => ({ x: t.x, y: t.y, w: t.w, h: t.h, r: 34, i }));
  const CARD = Object.assign({}, K.G1.username, { r: 56, i: 4 });
  const BLOCKS = [
    // order, start (global T), height (m)
    Object.assign({ start: T_TILES + B / 4, hgt: 7.5 }, TILES[0]),
    Object.assign({ start: T_TILES, hgt: 5.5 }, TILES[1]),
    Object.assign({ start: T_TILES, hgt: 6.2 }, TILES[2]),
    Object.assign({ start: T_TILES + B / 4, hgt: 8.2 }, TILES[3]),
    Object.assign({ start: T_TILES + B / 2, hgt: 3.2 }, CARD),
  ];
  function roofTex(b) {
    const S = FILM.S || 1;
    return LIB.cached(`${ID}:roof:${b.i}:${S}:${PROFILE_T}`, () => {
      const src = profileTex();
      const c = FILM.makeCanvas(Math.max(2, Math.round(b.w * S)), Math.max(2, Math.round(b.h * S)));
      const g = c.getContext('2d');
      g.scale(S, S);
      g.beginPath();
      K.rrect(g, 0, 0, b.w, b.h, b.r);
      g.clip();
      g.drawImage(src, b.x * S, b.y * S, b.w * S, b.h * S, 0, 0, b.w, b.h);
      return c;
    });
  }

  // Rounded footprint polygon of a block in world coordinates (counter-clockwise seen from above).
  const FOOT = new Map();
  function footprint(b) {
    if (FOOT.has(b.i)) return FOOT.get(b.i);
    const pts = [];
    const r = b.r, n = 5;
    const corners = [
      [b.x + b.w - r, b.y + r, -Math.PI / 2], // top-right (image), sweep to 0
      [b.x + b.w - r, b.y + b.h - r, 0],
      [b.x + r, b.y + b.h - r, Math.PI / 2],
      [b.x + r, b.y + r, Math.PI],
    ];
    for (const [cx, cy, a0] of corners) {
      for (let k = 0; k <= n; k++) {
        const a = a0 + (k / n) * (Math.PI / 2);
        pts.push([wx(cx + Math.cos(a) * r), wz(cy + Math.sin(a) * r)]);
      }
    }
    FOOT.set(b.i, pts);
    return pts;
  }

  // Kit towers standing where the extruded tiles are: replaced by them for this shot (all behind 08's camera).
  const ZONE = { x0: wx(70) - 1, x1: wx(1010) + 1, z0: wz(1405) - 1, z1: wz(975) + 1 };
  const inZone = (tw) => tw.x1 > ZONE.x0 && tw.x0 < ZONE.x1 && tw.z1 > ZONE.z0 && tw.z0 < ZONE.z1;

  // Tower rise: a wave from the avatar point outward (200 m/s), each tower 0.6 s outCubic.
  function riseStart(tw) {
    const cx = (tw.x0 + tw.x1) / 2, cz = (tw.z0 + tw.z1) / 2;
    const d = Math.hypot(cx - AV[0], cz - AV[2]);
    return T_TILES + 0.005 * d + 0.05 * LIB.h3(tw.seed & 1023, 7, 3);
  }
  function riseAt(tw, T) {
    if (inZone(tw)) return 0;
    const s = riseStart(tw);
    return E.outCubic(clamp((T - s) / 0.6));
  }

  // Gifts blown out of the avatar (the 6 profile gifts + the 18 that orbited in 06).
  let GIFTS = null;
  function giftData() {
    if (GIFTS) return GIFTS;
    const r = LIB.rng(sd('gifts'));
    const types = K.G1.bubbles.map((b) => b.type);
    GIFTS = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU + (r() - 0.5) * 0.22;
      GIFTS.push({
        type: i < 6 ? types[i] : K.GIFTS[i % 4],
        a,
        R: 16 + r() * 34,
        Y: 10 + r() * 30,
        size: 2.6 + r() * 4.8,
        delay: Math.floor(r() * 3) * FR,
        dur: 0.8 + r() * 0.55,
        spin: (r() * 2 - 1) * 2.4,
        yaw0: r() * TAU,
        rot0: (r() - 0.5) * 0.6,
        seed: 900 + i,
      });
    }
    return GIFTS;
  }

  // ---------------------------------------------------------------------------
  // Offscreen scratch layer (cleared every frame; pure)
  // ---------------------------------------------------------------------------
  function scratch(name) {
    const w = FILM.canvas.width, h = FILM.canvas.height;
    return LIB.cached(`${ID}:scratch:${name}:${w}x${h}`, () => {
      const c = FILM.makeCanvas(w, h);
      return { c, g: c.getContext('2d') };
    });
  }

  // ---------------------------------------------------------------------------
  // Drawing helpers
  // ---------------------------------------------------------------------------

  // An image on a world rectangle split into cells, each cell affine-mapped (exact for the top-down camera,
  // sub-pixel for small cells otherwise). alphaFn(i, j) -> 0..1 per cell.
  function quadCells(g, C, img, nx, nz, alphaFn) {
    const W = img.width, H = img.height;
    const sw = W / nx, sh = H / nz;
    const k = W / 1080; // texture px per frame px of the G1 layout
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const a = alphaFn(i, j);
        if (a <= 0.004) continue;
        const u0 = (i * sw) / k, v0 = (j * sh) / k; // G1 px
        const u1 = ((i + 1) * sw) / k, v1 = ((j + 1) * sh) / k;
        const pa = C.project(wx(u0), 0, wz(v0));
        const pb = C.project(wx(u1), 0, wz(v0));
        const pc = C.project(wx(u0), 0, wz(v1));
        if (!pa || !pb || !pc) continue;
        const ax = (pb[0] - pa[0]) / sw, ay = (pb[1] - pa[1]) / sw;
        const cx = (pc[0] - pa[0]) / sh, cy = (pc[1] - pa[1]) / sh;
        const x0 = i * sw, y0 = j * sh;
        g.save();
        g.globalAlpha = a;
        g.transform(ax, ay, cx, cy, pa[0] - ax * x0 - cx * y0, pa[1] - ay * x0 - cy * y0);
        const ex = 1.2; // overlap so the seams never show
        const sx = Math.max(0, x0 - ex), sy = Math.max(0, y0 - ex);
        const ww = Math.min(W - sx, sw + 2 * ex), hh = Math.min(H - sy, sh + 2 * ex);
        g.drawImage(img, sx, sy, ww, hh, sx, sy, ww, hh);
        g.restore();
      }
    }
  }

  // An image on a world parallelogram (TL, TR, BL), nu × nv affine cells: holds up under strong perspective.
  function rectCells(g, C, img, TL, TR, BL, nu, nv) {
    const W = img.width, H = img.height;
    const at = (u, v) => [TL[0] + (TR[0] - TL[0]) * u + (BL[0] - TL[0]) * v, TL[1] + (TR[1] - TL[1]) * u + (BL[1] - TL[1]) * v, TL[2] + (TR[2] - TL[2]) * u + (BL[2] - TL[2]) * v];
    const sw = W / nu, sh = H / nv;
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const A = at(i / nu, j / nv), Bp = at((i + 1) / nu, j / nv), Cp = at(i / nu, (j + 1) / nv);
        const pa = C.project(A[0], A[1], A[2]), pb = C.project(Bp[0], Bp[1], Bp[2]), pc = C.project(Cp[0], Cp[1], Cp[2]);
        if (!pa || !pb || !pc) continue;
        const ax = (pb[0] - pa[0]) / sw, ay = (pb[1] - pa[1]) / sw;
        const cx = (pc[0] - pa[0]) / sh, cy = (pc[1] - pa[1]) / sh;
        const x0 = i * sw, y0 = j * sh;
        g.save();
        g.transform(ax, ay, cx, cy, pa[0] - ax * x0 - cx * y0, pa[1] - ay * x0 - cy * y0);
        const ex = 0.8;
        const sx = Math.max(0, x0 - ex), sy = Math.max(0, y0 - ex);
        const ww = Math.min(W - sx, sw + 2 * ex), hh = Math.min(H - sy, sh + 2 * ex);
        g.drawImage(img, sx, sy, ww, hh, sx, sy, ww, hh);
        g.restore();
      }
    }
  }

  function poly(g, sp) {
    g.moveTo(sp[0][0], sp[0][1]);
    for (let i = 1; i < sp.length; i++) g.lineTo(sp[i][0], sp[i][1]);
    g.closePath();
  }

  // A world-space circle on the ground as a screen polyline.
  function groundRing(g, C, cx, cz, r, n = 72) {
    let pen = false;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const p = C.project(cx + Math.cos(a) * r, 0.02, cz + Math.sin(a) * r);
      if (!p) {
        pen = false;
        continue;
      }
      pen ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]);
      pen = true;
    }
  }

  const fogAmt = (d) => Math.min(0.9, 1 - Math.exp(-d / 150));

  // One extruded tile: rounded prism with the kit's steel faces, slab gaps, edge hairlines and the tile UI on its roof.
  function drawBlock(ctx, C, b, T) {
    const u = clamp((T - b.start) / 0.5 + 1 / 12);
    if (u <= 0) return;
    const h = b.hgt * E.outCubic(u);
    if (h < 0.05) return;
    const fp = footprint(b);
    const cp = C.pos;
    const n = fp.length;
    let cx = 0, cz = 0;
    for (const p of fp) {
      cx += p[0] / n;
      cz += p[1] / n;
    }
    const d = Math.hypot(cx - cp[0], h * 0.5 - cp[1], cz - cp[2]);
    const fog = fogAmt(d);
    // side faces (convex prism: only the camera-facing ones, no overlaps)
    const side = [];
    for (let k = 0; k < n; k++) {
      const a = fp[k], c = fp[(k + 1) % n];
      // outward normal of a CCW-from-above polygon in (x, z): the footprint winds clockwise in (x, z) because z = −v
      const ex = c[0] - a[0], ez = c[1] - a[1];
      let nx = ez, nz = -ex;
      const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
      if (nx * (mx - cx) + nz * (mz - cz) < 0) {
        nx = -nx;
        nz = -nz;
      }
      if (nx * (cp[0] - mx) + nz * (cp[2] - mz) <= 0) continue;
      const sp = K.projPoly(C, [[a[0], 0, a[1]], [c[0], 0, c[1]], [c[0], h, c[1]], [a[0], h, a[1]]]);
      if (!sp) continue;
      // light: faces toward +z (the button) are lit
      const lit = clamp(0.5 + 0.5 * nz);
      side.push({ sp, lit, a, c });
    }
    ctx.save();
    for (const f of side) {
      let miny = 1e9, maxy = -1e9;
      for (const p of f.sp) {
        if (p[1] < miny) miny = p[1];
        if (p[1] > maxy) maxy = p[1];
      }
      const base = mix(P.steel, P.steelLit, f.lit);
      const col = mix(base, P.haze, fog);
      const g = ctx.createLinearGradient(0, maxy, 0, miny);
      g.addColorStop(0, css(mix(col, P.void, 0.35)));
      g.addColorStop(1, css(mix(col, P.haze, 0.2)));
      ctx.fillStyle = g;
      ctx.beginPath();
      poly(ctx, f.sp);
      ctx.fill();
    }
    // slab gaps every ~4.6 m (the kit's tile slabs)
    ctx.strokeStyle = css(P.void, 0.75);
    ctx.lineWidth = Math.max(0.7, (0.6 * C.f) / Math.max(1, d));
    ctx.beginPath();
    for (let y = 4.4; y < h - 0.6; y += 4.6) {
      for (const f of side) {
        const s = K.projSeg(C, [f.a[0], y, f.a[1]], [f.c[0], y, f.c[1]]);
        if (!s) continue;
        ctx.moveTo(s[0][0], s[0][1]);
        ctx.lineTo(s[1][0], s[1][1]);
      }
    }
    ctx.stroke();
    // silhouette hairlines (vertical edges between lit and unlit sides are soft; outline the whole side band)
    ctx.strokeStyle = css(P.steelEdge, 0.8 * (1 - fog * 0.8));
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const f of side) {
      const s = K.projSeg(C, [f.a[0], h, f.a[1]], [f.c[0], h, f.c[1]]);
      if (!s) continue;
      ctx.moveTo(s[0][0], s[0][1]);
      ctx.lineTo(s[1][0], s[1][1]);
    }
    ctx.stroke();
    // roof: the tile's own UI, then a violet neon rim
    if (cp[1] > h) {
      const top = K.projPoly(C, fp.map((p) => [p[0], h, p[1]]));
      if (top) {
        ctx.fillStyle = P.voidLift;
        ctx.beginPath();
        poly(ctx, top);
        ctx.fill();
        const img = roofTex(b);
        const corners = [[wx(b.x), h, wz(b.y)], [wx(b.x + b.w), h, wz(b.y)], [wx(b.x), h, wz(b.y + b.h)], [wx(b.x + b.w), h, wz(b.y + b.h)]];
        let near = 1e9;
        for (const q of corners) near = Math.min(near, C.toCam(q[0], q[1], q[2])[2]);
        const texA = clamp((near - 2.5) / 4);
        if (texA > 0) {
        ctx.save();
        ctx.globalAlpha *= texA;
        ctx.beginPath();
        poly(ctx, top);
        ctx.clip();
        rectCells(ctx, C, img, corners[0], corners[1], corners[2], Math.max(2, Math.round(b.w / 60)), 3);
        ctx.restore();
        }
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineJoin = 'round';
        const on = clamp((T - b.start) / 0.25);
        ctx.strokeStyle = css(P.violetMid, 0.16 * on);
        ctx.lineWidth = 7;
        ctx.beginPath();
        poly(ctx, top);
        ctx.stroke();
        ctx.strokeStyle = css(P.violetMid, 0.75 * on);
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // Glitch slices (the kit's materialize language) across a screen box.
  function glitch(ctx, x, y, w, h, a, seed, T) {
    if (a <= 0.01) return;
    const rr = LIB.rng(LIB.hash(ID, 'glitch', seed, Math.floor(T * 24 + 1e-6)));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const yy = y + rr() * h;
      const ww = w * (0.5 + rr() * 1.1);
      ctx.fillStyle = css(i % 2 ? P.violetHot : P.violetMid, 0.5 * a);
      ctx.fillRect(x + (rr() - 0.5) * w * 0.6 - ww / 2, yy, ww, Math.max(1, h * 0.018));
    }
    ctx.restore();
  }

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
    g.addColorStop(0.55, css(P.haze, 0.55 * a));
    g.addColorStop(0.85, css(mix(P.haze, P.hazeViolet, 0.5), 0.6 * a));
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
    ctx.globalAlpha = 0.3 * a;
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

  // ---------------------------------------------------------------------------
  // Scene
  // ---------------------------------------------------------------------------
  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const t = clamp(tIn, 0, info.dur);
      const T = info.shot.start + t;
      const camSpec = camAt(t);
      const C = K.cam(camSpec);
      const D = K.cityData();
      const rise = (tw) => riseAt(tw, T);

      // 1. the city
      K.city(ctx, C, T, { rise });

      // 2. the profile quad, dissolving cell by cell behind the tower wave
      if (T < T_LIGHTS + 0.1) {
        const L = scratch('quad');
        const g = L.g;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
        g.clearRect(0, 0, L.c.width, L.c.height);
        FILM.baseTransform(g);
        const img = profileTex();
        const nx = 18, nz = 32; // 3 m cells
        const cellA = (i, j) => {
          const x = wx((i + 0.5) * 60), z = wz((j + 0.5) * 60);
          const dd = Math.hypot(x - AV[0], z - AV[2]);
          const s = T_DISSOLVE + 0.0042 * dd + 0.16 * LIB.h3(i, j, sd('cell') & 1023);
          return 1 - clamp((T - s) / (3 * FR));
        };
        quadCells(g, C, img, nx, nz, cellA);
        // cells lighting up just before they go: a UI spark outline
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.lineWidth = 1.2;
        for (let j = 0; j < nz; j++) {
          for (let i = 0; i < nx; i++) {
            const x = wx((i + 0.5) * 60), z = wz((j + 0.5) * 60);
            const dd = Math.hypot(x - AV[0], z - AV[2]);
            const s = T_DISSOLVE + 0.0042 * dd + 0.16 * LIB.h3(i, j, sd('cell') & 1023);
            const k = (T - (s - 3 * FR)) / (5 * FR);
            if (k <= 0 || k >= 1) continue;
            const sp = K.projPoly(C, [[wx(i * 60), 0, wz(j * 60)], [wx(i * 60 + 60), 0, wz(j * 60)], [wx(i * 60 + 60), 0, wz(j * 60 + 60)], [wx(i * 60), 0, wz(j * 60 + 60)]]);
            if (!sp) continue;
            g.strokeStyle = css(P.violetMid, 0.4 * Math.sin(Math.PI * k));
            g.beginPath();
            poly(g, sp);
            g.stroke();
          }
        }
        g.restore();
        // cut out everything that stands on the ground (risen towers, arrived gifts)
        g.globalCompositeOperation = 'destination-out';
        g.fillStyle = '#000';
        g.beginPath();
        for (const tw of D.towers) {
          const rf = riseAt(tw, T);
          if (rf <= 0.001) continue;
          const h = tw.h * rf;
          const faces = [
            [[tw.x0, 0, tw.z0], [tw.x1, 0, tw.z0], [tw.x1, h, tw.z0], [tw.x0, h, tw.z0]],
            [[tw.x0, 0, tw.z1], [tw.x1, 0, tw.z1], [tw.x1, h, tw.z1], [tw.x0, h, tw.z1]],
            [[tw.x0, 0, tw.z0], [tw.x0, 0, tw.z1], [tw.x0, h, tw.z1], [tw.x0, h, tw.z0]],
            [[tw.x1, 0, tw.z0], [tw.x1, 0, tw.z1], [tw.x1, h, tw.z1], [tw.x1, h, tw.z0]],
            [[tw.x0, h, tw.z0], [tw.x1, h, tw.z0], [tw.x1, h, tw.z1], [tw.x0, h, tw.z1]],
          ];
          for (const f of faces) {
            const sp = K.projPoly(C, f);
            if (sp) poly(g, sp);
          }
        }
        g.fill('nonzero');
        const Tc = K.cityTime(T);
        for (const ob of D.objects) {
          if (Tc < ob.arrive) continue;
          const pr = C.project(ob.x, ob.y + ob.bob * Math.sin(TAU * ob.freq * Tc + ob.ph), ob.z);
          if (!pr) continue;
          const s = ob.size * pr[3];
          g.globalAlpha = clamp((Tc - ob.arrive) / 0.1);
          g.beginPath();
          g.arc(pr[0], pr[1], s * 0.5, 0, TAU);
          g.fill();
        }
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(L.c, 0, 0);
        ctx.restore();
      }

      // 3. the avatar ring leaves the profile: a shock ring on the flash, a second one fronting the tower wave
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      {
        const u = clamp((T - T0) / (1.2 * B));
        if (u > 0 && u < 1) {
          const r = 8 + 42 * E.outCubic(u);
          const a = (1 - u) * (1 - u);
          ctx.beginPath();
          groundRing(ctx, C, AV[0], AV[2], r);
          ctx.strokeStyle = css(P.violetMid, 0.18 * a);
          ctx.lineWidth = 14;
          ctx.stroke();
          ctx.strokeStyle = css(P.violet, 0.95 * a);
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        const v = (T - T_TILES + FR) / 0.55;
        if (v > 0 && v < 1) {
          const r = 8 + 200 * (T - T_TILES + FR);
          const a = Math.pow(1 - v, 1.5);
          ctx.beginPath();
          groundRing(ctx, C, AV[0], AV[2], r, 120);
          ctx.strokeStyle = css(P.violetMid, 0.14 * a);
          ctx.lineWidth = 16;
          ctx.stroke();
          ctx.strokeStyle = css(P.violetHot, 0.7 * a);
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      ctx.restore();

      // 4. the action tiles and the username card rise as the first towers (far first)
      {
        const cp = C.pos;
        const order = BLOCKS.slice().sort((a, b) => {
          const da = Math.hypot(wx(a.x + a.w / 2) - cp[0], wz(a.y + a.h / 2) - cp[2]);
          const db = Math.hypot(wx(b.x + b.w / 2) - cp[0], wz(b.y + b.h / 2) - cp[2]);
          return db - da;
        });
        for (const b of order) drawBlock(ctx, C, b, T);
      }

      // 5. the gifts blown out of the avatar
      {
        const list = [];
        for (const gf of giftData()) {
          const u = clamp((T - T0 - gf.delay) / gf.dur + 1 / 24);
          const out = clamp((T - (T0 + gf.delay + gf.dur)) / 0.35);
          if (out >= 1) continue;
          const e = E.outCubic(u);
          const pos = [AV[0] + Math.cos(gf.a) * gf.R * e, 0.4 + gf.Y * E.outQuad(u), AV[2] + Math.sin(gf.a) * gf.R * e];
          const pr = C.project(pos[0], pos[1], pos[2]);
          if (!pr || pr[2] < 1.5) continue;
          list.push({ gf, pr, u, out });
        }
        list.sort((a, b) => b.pr[2] - a.pr[2]);
        for (const it of list) {
          const { gf, pr, u, out } = it;
          const sizeM = lerp(1.2, gf.size, E.outCubic(u));
          const s = sizeM * pr[3];
          if (s < 1.5 || s > 1400) continue;
          if (pr[0] < -s || pr[0] > 1080 + s || pr[1] < -s || pr[1] > 1920 + s) continue;
          const a = (1 - out) * clamp(1.4 - s / 1000);
          const warm = gf.type === 'bowtie' || gf.type === 'capPurple';
          K.glow(ctx, pr[0], pr[1], s * 1.1, warm ? P.glowPink : P.glowSlate, 0.7 * a * (1 - 0.6 * u));
          ctx.save();
          ctx.globalAlpha *= a;
          const Tt = T - T0;
          K.gift(ctx, gf.type, pr[0], pr[1], s, gf.rot0 + 0.3 * gf.spin * Tt * 0.2, gf.type === 'tama' ? 0 : gf.yaw0 + gf.spin * Tt, { seed: gf.seed, light: 0.85 });
          ctx.restore();
          // the bubble's sparkles, shed as it flies
          if (u < 0.6) {
            const rr = LIB.rng(sd('spark', gf.seed));
            for (let k = 0; k < 3; k++) {
              const ang = rr() * TAU, dd = s * (0.55 + rr() * 0.4) * (1 + u);
              K.sparkle(ctx, pr[0] + Math.cos(ang) * dd, pr[1] + Math.sin(ang) * dd, s * (0.08 + rr() * 0.05), (1 - u / 0.6) * a);
            }
          }
          if (out > 0) glitch(ctx, pr[0], pr[1] - s * 0.5, s, s, 1 - out, gf.seed, T);
        }
      }

      // 6. Cartezz appears where the avatar was
      {
        const m = clamp((T - T_MAN) / (6 * FR) + 1 / 6);
        const endA = E.inOutSine(clamp((T - (T_END - 2 * B)) / (2 * B)));
        hazeBand(ctx, C, T, endA);
        reflection(ctx, C, endA);
        if (m > 0) {
          figureReflection(ctx, C, 0, 34, { walk: null }, endA * clamp(m * 1.6));
          ctx.save();
          ctx.globalAlpha *= clamp(m * 1.6);
          const r = K.figure(ctx, C, 0, 34, { walk: null });
          ctx.restore();
          if (r && m < 1) glitch(ctx, r.x, r.y - r.h, r.h * 0.9, r.h, 1 - m, 34, T);
          if (m < 1 && r) K.glow(ctx, r.x, r.y - r.h * 0.5, r.h * 1.4, P.violetMid, 0.5 * (1 - m));
        }
      }

      // 7. the break: violet light bursting out of the avatar point
      {
        const k = (T - T0) / 0.5;
        if (k >= 0 && k < 1) {
          const pa = C.project(AV[0], 0.5, AV[2]);
          if (pa) {
            const a = Math.exp(-k * 3.2);
            K.glow(ctx, pa[0], pa[1], 520 + 380 * k, P.violetMid, 0.9 * a);
            K.glow(ctx, pa[0], pa[1], 160 + 60 * k, P.violetHot, 1.0 * a);
            K.onlineDot(ctx, pa[0], pa[1], 10 * (1 - k) + 3, a);
          }
        }
      }
    },
  });
})();
