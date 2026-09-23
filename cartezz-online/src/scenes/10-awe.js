/*
 * 10 awe : He sees himself.  T 18.667 – 21.333 (one bar), city plate, cut in from 09.
 *
 * The director's beat. Close-up in profile, facing screen right: Cartezz looks up at the hologram of his own
 * profile (off-frame, top right). Its cold violet-white light falls on the front of his face. Surprise on
 * beat 2, lips part on beat 3, a small admiring smile on beat 4. Dignified wonder, never comic.
 *
 * Layers, back to front:
 *   1. kit.city from his side (from storyboard G4, swung back: see BG_CAM0), rendered soft at 1/3 resolution,
 *      with the hologram's out-of-focus edge glowing in the top-right corner
 *   2. void dim over the street (≈ 50%) + a depth fade toward the lower left
 *   3. the hologram's light: cold violet-white spill from the top-right corner, soft beams, flickering twice
 *   4. online dots drifting up behind him (sharp, small)
 *   5. Cartezz: kit.head, painted on an offscreen layer and re-lit from it: the shadow side sinks (source-atop),
 *      then an additive pass masked to his shape — the hologram's key and a cold edge light on every contour
 *      that faces it (nose, lips, brow, brim, shoulder)
 *   6. online dots drifting up in front of him (large, out of focus) — one passes his face on beat 4
 *   7. vignette, lower frame falloff
 */
(function () {
  'use strict';
  const ID = 'awe';
  const FILM = window.FILM;
  const LIB = FILM.lib;
  const P = LIB.pal;
  const E = LIB.ease;
  const K = FILM.kit;
  const TAU = Math.PI * 2;
  const FR = 1 / 24;
  const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => {
    const t = clamp((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const sd = (...k) => LIB.hash(ID, ...k) & 0x7fffffff;
  const B = K.B;

  // beats, shot-local (global T in comments)
  const B1 = 0;          // T 18.667  bar 8 beat 1: neutral, looking up; the light flickers twice
  const B2 = B;          // T 19.333  beat 2: surprise
  const B3 = 2 * B;      // T 20.000  beat 3: lips part
  const B4 = 3 * B;      // T 20.667  beat 4: the admiring smile; an online dot drifts past his face

  const HEAD_X = 470, HEAD_Y = 820;
  const LIGHT = { x: 1010, y: -120 }; // where the hologram's light comes from (off-frame, top right)

  // Background camera. Storyboard G4 is (3.2, 1.9, 64.2), yaw −1.75, pitch 0.25, f 1100: straight across the
  // street, which puts a flat tower wall behind his head. Swung further back (yaw −2.4, pitch 0.3) the towers
  // recede behind him to a vanishing point at frame left, the street he walked stays in the frame, and the
  // sky opens above the hair. The camera drifts a little across the shot (parallax behind the push).
  const BG_CAM0 = { pos: [3.2, 1.9, 64.2], yaw: -2.4, pitch: 0.3, f: 1100 };
  const BG_CAM1 = { pos: [3.45, 1.98, 63.8], yaw: -2.36, pitch: 0.315, f: 1100 };
  const BG_Q = 0.34; // the street is rendered at a third of the resolution: a lens-soft background

  // ---------------------------------------------------------------------------
  // timing helpers (scene-anatomy)
  // ---------------------------------------------------------------------------
  const drawingOf = (t, a) => Math.floor((t - a) * 12 + 1e-6); // drawings (on twos) since shot-local time a
  /** A value that steps through `vals` on twos from shot-local time a (holds the last). Before a: `before`. */
  const onTwos = (t, a, vals, before) => (t < a ? before : vals[Math.min(vals.length - 1, drawingOf(t, a))]);

  /** The expression at shot-local t, on twos exactly per the storyboard. */
  function expression(t) {
    // surprise: brows and eyes 0 → 0.8 over three drawings
    let brows = onTwos(t, B2, [0.38, 0.68, 0.8], 0);
    let eyes = onTwos(t, B2, [0.4, 0.7, 0.8], 0);
    // lips part
    let mouth = onTwos(t, B3, [0.3, 0.5], 0);
    // the smile: smile 0 → 0.7, mouth → 0.15, brows settle 0.5 (four drawings, softly)
    let smile = 0;
    if (t >= B4) {
      const k = [0.3, 0.6, 0.85, 1][Math.min(3, drawingOf(t, B4))];
      smile = 0.7 * k;
      mouth = lerp(0.5, 0.15, k);
      brows = lerp(0.8, 0.5, k);
      eyes = lerp(0.8, 0.68, k);
    }
    // one slow blink between the look and the surprise (T 19.0, an 8th)
    const blink = onTwos(t, B / 2, [0.55, 1, 0.45, 0], 0);
    return { brows, eyes, mouth, smile, blink };
  }

  /** The hologram's light level: full at the cut, two flickers as it stabilises, then a slow living shimmer. */
  function holoLight(t) {
    const f = Math.round(t * 24);
    let k = 1;
    if (f === 2 || f === 3) k = 0.32;
    else if (f === 4) k = 0.8;
    else if (f === 7) k = 0.5;
    else if (f === 8) k = 0.9;
    return k * (0.94 + 0.06 * Math.sin(t * 5.3) * Math.sin(t * 2.1 + 1));
  }

  // ---------------------------------------------------------------------------
  // scratch layer for the head (full frame at render scale; cleared each frame, so draw-order independent)
  // ---------------------------------------------------------------------------
  function layer(name, S, q = 1) {
    const w = Math.round(1080 * S * q), h = Math.round(1920 * S * q);
    return LIB.cached(`awe-${name}-${w}x${h}`, () => FILM.makeCanvas(w, h));
  }
  /** Get a scratch canvas's context, cleared, with the frame transform at scale k. */
  function fresh(c, k) {
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.filter = 'none';
    g.clearRect(0, 0, c.width, c.height);
    g.setTransform(k, 0, 0, k, 0, 0);
    return g;
  }

  // online dots: behind (small, sharp) and in front (large, soft)
  const DOTS_BACK = [];
  const DOTS_FRONT = [];
  (function buildDots() {
    const r = LIB.rng(sd('dots'));
    for (let i = 0; i < 16; i++) {
      DOTS_BACK.push({ x: 40 + r() * 1000, y0: 300 + r() * 1700, v: 55 + r() * 70, r: 2.2 + r() * 3.5, ph: r() * TAU, sway: 6 + r() * 12 });
    }
    // front: three out-of-focus dots; the second is the one that passes his face on beat 4
    DOTS_FRONT.push({ x: 930, y0: 1500, v: 150, r: 26, ph: 0.4, sway: 14, t0: -1 });
    DOTS_FRONT.push({ x: 800, y0: 1230, v: 380, r: 15, ph: 1.3, sway: 10, t0: B4 - 0.6 });
    DOTS_FRONT.push({ x: 120, y0: 1760, v: 120, r: 34, ph: 2.1, sway: 18, t0: -1 });
  })();

  function softDot(ctx, x, y, r, a) {
    // an online dot out of focus: violet disc with a hot centre, soft rim
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, K.css(P.violetHot, 0.32 * a));
    g.addColorStop(0.55, K.css(P.violetMid, 0.2 * a));
    g.addColorStop(0.85, K.css(P.violet, 0.14 * a));
    g.addColorStop(1, K.css(P.violet, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.restore();
    K.glow(ctx, x, y, r * 3, P.violetMid, 0.25 * a);
  }


  /** The hologram's out-of-focus lower-left corner, just intruding at the top right (drawn into the soft layer). */
  function holoEdge(g, t, hl) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    // the frame of the hologram: two long bright edges meeting off-frame, very defocused
    g.translate(1180 + 30 * t / 2.667, -260 + 18 * t / 2.667);
    g.rotate(0.32);
    g.strokeStyle = K.css(P.violetHot, 0.55 * hl);
    g.lineWidth = 16;
    g.beginPath();
    g.moveTo(-560, 0);
    g.lineTo(-560, 520);
    g.lineTo(200, 520);
    g.stroke();
    // UI tiles of the profile inside it, as soft blocks
    const rows = [[-500, 390, 150, 70], [-320, 390, 150, 70], [-140, 390, 150, 70], [-500, 230, 520, 44], [-500, 120, 380, 60]];
    for (let i = 0; i < rows.length; i++) {
      const [x, y, w, h] = rows[i];
      g.fillStyle = K.css(i === 4 ? P.bone : P.violetMid, (i === 4 ? 0.22 : 0.3) * hl);
      g.beginPath();
      K.rrect(g, x, y, w, h, 18);
      g.fill();
    }
    g.fillStyle = K.css(P.violetInk, 0.5 * hl);
    g.fillRect(-560, 0, 760, 520);
    g.restore();
  }

  /** The hologram's light in the soft layer: the spill from the top-right corner and soft beams toward his face. */
  function spill(b, t, hl) {
    b.save();
    b.globalCompositeOperation = 'lighter';
    const g = b.createRadialGradient(LIGHT.x, LIGHT.y, 0, LIGHT.x, LIGHT.y, 1300);
    g.addColorStop(0, K.css(P.violetHot, 0.42 * hl));
    g.addColorStop(0.2, K.css(P.violetMid, 0.2 * hl));
    g.addColorStop(0.5, K.css(P.violet, 0.06 * hl));
    g.addColorStop(1, K.css(P.violet, 0));
    b.fillStyle = g;
    b.fillRect(0, 0, 1080, 1920);
    K.glow(b, LIGHT.x + 40, LIGHT.y - 40, 560, P.bone, 0.4 * hl);
    const target = [HEAD_X + 150, HEAD_Y - 20];
    const ang0 = Math.atan2(target[1] - LIGHT.y, target[0] - LIGHT.x);
    for (let i = 0; i < 6; i++) {
      const a = ang0 + (i - 2.5) * 0.075 + 0.01 * Math.sin(t * 0.9 + i * 1.7);
      const len = 1700, w0 = 14, w1 = 70 + 50 * ((i * 5) % 3);
      const cx = Math.cos(a), sy = Math.sin(a);
      const nx = -sy, ny = cx;
      const g2 = b.createLinearGradient(LIGHT.x, LIGHT.y, LIGHT.x + cx * len, LIGHT.y + sy * len);
      const amp = (0.045 + 0.03 * ((i * 7) % 3) / 2) * hl * (0.8 + 0.2 * Math.sin(t * 1.3 + i));
      g2.addColorStop(0, K.css(P.violetHot, amp));
      g2.addColorStop(0.6, K.css(P.violetMid, amp * 0.3));
      g2.addColorStop(1, K.css(P.violetMid, 0));
      b.fillStyle = g2;
      b.beginPath();
      b.moveTo(LIGHT.x + nx * w0, LIGHT.y + ny * w0);
      b.lineTo(LIGHT.x + cx * len + nx * w1, LIGHT.y + sy * len + ny * w1);
      b.lineTo(LIGHT.x + cx * len - nx * w1, LIGHT.y + sy * len - ny * w1);
      b.lineTo(LIGHT.x - nx * w0, LIGHT.y - ny * w0);
      b.closePath();
      b.fill();
    }
    b.restore();
  }

  /** Static vignette + lower falloff, cached per render scale (t-independent). */
  function vignette(S) {
    const w = Math.round(1080 * S), h = Math.round(1920 * S);
    return LIB.cached(`awe-vignette-${w}x${h}`, () => {
      const c = FILM.makeCanvas(w, h);
      const v = c.getContext('2d');
      v.scale(S, S);
      const vg = v.createRadialGradient(640, 760, 420, 540, 960, 1250);
      vg.addColorStop(0, K.css(P.void, 0));
      vg.addColorStop(1, K.css(P.void, 0.6));
      v.fillStyle = vg;
      v.fillRect(0, 0, 1080, 1920);
      const lg = v.createLinearGradient(0, 1480, 0, 1920);
      lg.addColorStop(0, K.css(P.void, 0));
      lg.addColorStop(1, K.css(P.void, 0.75));
      v.fillStyle = lg;
      v.fillRect(0, 1480, 1080, 440);
      return c;
    });
  }

  // ---------------------------------------------------------------------------
  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const t = clamp(tIn, 0, info.dur);
      const T = info.shot.start + t;
      const p = t / info.dur;
      const push = E.inOutSine(p);
      const hl = holoLight(t);
      const S = FILM.S || 1;

      // 1–3. the street behind him, soft (1/3 resolution, blurred, upscaled): city, dim, the hologram's edge and light
      {
        const bgc = layer('bg', S, BG_Q);
        const b = fresh(bgc, S * BG_Q);
        b.fillStyle = P.void;
        b.fillRect(0, 0, 1080, 1920);
        K.city(b, K.lerpCam(BG_CAM0, BG_CAM1, push), T, { skyGlow: 0.6, lw: 1.4 });
        b.fillStyle = K.css(P.void, 0.5);
        b.fillRect(0, 0, 1080, 1920);
        const dg = b.createLinearGradient(0, 1920, 760, 640);
        dg.addColorStop(0, K.css(P.void, 0.8));
        dg.addColorStop(1, K.css(P.void, 0));
        b.fillStyle = dg;
        b.fillRect(0, 0, 1080, 1920);
        holoEdge(b, t, hl);
        spill(b, t, hl);
        const blc = layer('bgblur', S, BG_Q);
        const bl = fresh(blc, 1);
        bl.filter = `blur(${(2.2 * S * BG_Q * 3).toFixed(2)}px)`;
        bl.drawImage(bgc, 0, 0);
        bl.filter = 'none';
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'low'; // already blurred: the cheap filter is enough
        ctx.drawImage(blc, 0, 0, blc.width, blc.height, 0, 0, 1080, 1920);
        ctx.restore();
      }

      // 4. online dots behind him, rising
      for (let i = 0; i < DOTS_BACK.length; i++) {
        const d = DOTS_BACK[i];
        const y = ((d.y0 - d.v * T) % 2100 + 2100) % 2100 - 90;
        const x = d.x + d.sway * Math.sin(T * 0.8 + d.ph);
        const a = 0.55 + 0.45 * Math.sin(T * 2 + d.ph);
        K.onlineDot(ctx, x, y, d.r, a * (0.5 + 0.5 * hl));
      }

      // 5. Cartezz on the scratch layer
      const s = lerp(540, 590, push);
      const surprise = onTwos(t, B2, [0.4, 0.8, 1], 0);
      const pitch = lerp(0.3, 0.36, push) + 0.012 * surprise - 0.004 * onTwos(t, B4, [0.5, 1], 0);
      const hx = HEAD_X - (s - 540) * 0.18; // the push grows the head about the face, not the crown
      const hy = HEAD_Y + (s - 540) * 0.1;
      const lay = layer('head', S);
      const g = fresh(lay, S);
      K.head(g, hx, hy, s, {
        dir: 1, turn: 1, body: 'side', pitch, expr: expression(t), gaze: 0,
        light: { front: 1, amt: clamp(0.55 + 0.45 * hl) },
        glint: true, wash: 0.6 + 0.4 * hl, rim: 0.35 + 0.25 * hl,
      });

      // light and shade masked to his shape: soft passes at reduced resolution (the rim at 1/2, shade and key at 1/4)
      const mk = layer('mask2', S, 0.5);
      fresh(mk, 1).drawImage(lay, 0, 0, mk.width, mk.height);
      const mq = layer('mask4', S, 0.25);
      fresh(mq, 1).drawImage(mk, 0, 0, mq.width, mq.height);
      const k4 = S * 0.25, k2 = S * 0.5;

      // shade: the back of the head sinks into the dark, the jaw shades the neck, the coat melts away
      const shc = layer('shade', S, 0.25);
      const sh = fresh(shc, k4);
      {
        const sg = sh.createLinearGradient(hx + s * 0.15, hy - s * 0.3, hx - s * 0.75, hy + s * 0.2);
        sg.addColorStop(0, K.css(P.void, 0));
        sg.addColorStop(1, K.css(P.void, 0.6));
        sh.fillStyle = sg;
        sh.fillRect(0, 0, 1080, 1920);
        const ca = Math.cos(pitch), sa = Math.sin(pitch);
        const jx = hx + s * 0.33, jy = hy + s * 0.285;
        const ng = sh.createLinearGradient(jx, jy, jx + sa * s * 0.2, jy + ca * s * 0.2);
        ng.addColorStop(0, K.css(P.void, 0));
        ng.addColorStop(0.35, K.css(P.void, 0.38));
        ng.addColorStop(1, K.css(P.void, 0.62));
        sh.fillStyle = ng;
        sh.beginPath();
        sh.moveTo(jx - s * 0.9 * ca, jy + s * 0.9 * sa - 2);
        sh.lineTo(jx + s * 0.5 * ca, jy - s * 0.5 * sa - 2);
        sh.lineTo(jx + s * 0.5 * ca + sa * s * 3, jy - s * 0.5 * sa + ca * s * 3);
        sh.lineTo(jx - s * 0.9 * ca + sa * s * 3, jy + s * 0.9 * sa + ca * s * 3);
        sh.closePath();
        sh.fill();
        const bgd = sh.createLinearGradient(0, hy + s * 0.75, 0, hy + s * 2.0);
        bgd.addColorStop(0, K.css(P.void, 0));
        bgd.addColorStop(1, K.css(P.void, 0.85));
        sh.fillStyle = bgd;
        sh.fillRect(0, hy + s * 0.75, 1080, 1920);
        sh.setTransform(1, 0, 0, 1, 0, 0);
        sh.globalCompositeOperation = 'destination-in';
        sh.drawImage(mq, 0, 0);
      }

      // light (additive, half resolution): the key — cold white-violet on the front of the face and the broad
      // spill from the top right on cap and shoulder — then an edge light on every contour facing the hologram
      const fxc = layer('fx', S, 0.5);
      const fx = fresh(fxc, k2);
      {
        const fxx = hx + s * 0.34, fyy = hy - s * 0.02;
        const kf = fx.createRadialGradient(fxx, fyy, 0, fxx, fyy, s * 0.62);
        kf.addColorStop(0, K.css(P.violetHot, 0.4 * hl));
        kf.addColorStop(0.5, K.css(P.violetHot, 0.15 * hl));
        kf.addColorStop(1, K.css(P.violetHot, 0));
        fx.fillStyle = kf;
        fx.fillRect(fxx - s, fyy - s, 2 * s, 2 * s);
        fx.globalCompositeOperation = 'lighter';
        const kg = fx.createRadialGradient(LIGHT.x - 80, LIGHT.y + 60, 200, LIGHT.x - 80, LIGHT.y + 60, 1250);
        kg.addColorStop(0, K.css(P.violetHot, 0.3 * hl));
        kg.addColorStop(0.55, K.css(P.violetMid, 0.1 * hl));
        kg.addColorStop(1, K.css(P.violetMid, 0));
        fx.fillStyle = kg;
        fx.fillRect(0, 0, 1080, 1920);
        fx.setTransform(1, 0, 0, 1, 0, 0);
        fx.globalCompositeOperation = 'destination-in';
        fx.drawImage(mk, 0, 0);
        // edge light: the mask minus itself shifted toward the light leaves the lit contours
        const rimc = layer('rim', S, 0.5);
        const Ld = [0.62, -0.785]; // screen direction toward the light
        const r = fresh(rimc, 1);
        r.drawImage(mk, 0, 0);
        r.globalCompositeOperation = 'destination-out';
        r.drawImage(mk, -Ld[0] * 6 * k2, -Ld[1] * 6 * k2);
        r.globalCompositeOperation = 'source-in';
        r.fillStyle = K.css(P.violetHot, 0.85 * hl);
        r.fillRect(0, 0, rimc.width, rimc.height);
        fx.globalCompositeOperation = 'lighter';
        fx.drawImage(rimc, 0, 0);
      }

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(lay, 0, 0, lay.width, lay.height, 0, 0, 1080, 1920);
      ctx.drawImage(shc, 0, 0, shc.width, shc.height, 0, 0, 1080, 1920);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(fxc, 0, 0, fxc.width, fxc.height, 0, 0, 1080, 1920);
      ctx.restore();

      // 6. online dots in front, out of focus; one rises past his face on beat 4
      for (let i = 0; i < DOTS_FRONT.length; i++) {
        const d = DOTS_FRONT[i];
        const tt = d.t0 < 0 ? T : t - d.t0;
        if (d.t0 >= 0 && tt < 0) continue;
        const y = d.t0 < 0 ? ((d.y0 - d.v * (T - 18)) % 2400 + 2400) % 2400 - 200 : d.y0 - d.v * tt;
        const x = d.x + d.sway * Math.sin(T * 0.7 + d.ph);
        const a = d.t0 >= 0 ? clamp(tt / 0.25) * clamp((y + 100) / 400) : 0.8;
        softDot(ctx, x, y, d.r, a * (0.7 + 0.3 * hl));
        if (d.t0 >= 0) K.onlineDot(ctx, x, y, d.r * 0.32, 0.8 * a);
      }

      // 7. vignette and lower falloff
      const vc = vignette(S);
      ctx.drawImage(vc, 0, 0, vc.width, vc.height, 0, 0, 1080, 1920);
    },
  });
})();
