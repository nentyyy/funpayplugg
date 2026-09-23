/*
 * kit.js : the shared world of "CARTEZZ // ONLINE".
 * Owner: director. Contract: docs/CONTRACT.md. Rules: docs/art-bible.md. Geometry: docs/storyboard.md (G1–G4).
 *
 * Loaded after lib.js and before timeline.js. Everything a scene needs to draw the film's recurring
 * elements lives here, so they are identical in every shot:
 *   - time:      T_PRESS, cityTime(T), B (beat)
 *   - glyphs:    bowtie, cap, tama, gift, giftBubble, sparkle, onlineDot, notif, badge, presence
 *   - screen:    profile(ctx, o)  — the Telegram profile on G1;  avatar(ctx, cx, cy, r, T, o) — G2
 *   - 3D:        cam(o), lerpCam(a, b, p), city(ctx, cam, T, o), button, hologram, planeImage
 *   - character: cartezz(ctx, x, y, h, pose), head(ctx, x, y, s, o)
 * All drawing is a pure function of its arguments. Caches are keyed by every input.
 */
(function () {
  'use strict';
  const FILM = window.FILM;
  const L = FILM.lib;
  const P = Object.assign({}, L.pal); // raw copy: fast reads in hot loops
  const TAU = Math.PI * 2;
  const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => {
    const t = clamp((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const E = L.ease;
  const kit = {};

  // ===========================================================================
  // Time
  // ===========================================================================

  const B = 60 / 90;
  const bt = (n) => Math.round(n * B * 24) / 24; // n beats, exact on the frame grid
  kit.bt = bt;
  const T_PRESS = bt(40); // 26.6667, bar 11 downbeat
  const T_BREAK = bt(16); // 10.6667, the world breaks
  kit.B = B;
  kit.T_PRESS = T_PRESS;
  /** World time: everything in the world stops at the press. */
  kit.cityTime = (T) => (T < T_PRESS ? T : T_PRESS);
  /** Beat pulse in 0..1: 1 on each beat, decaying over `len` seconds. */
  kit.beatPulse = (T, len = 0.35) => {
    const ph = ((T % B) + B) % B;
    return Math.exp(-ph / (len * 0.35));
  };

  // ===========================================================================
  // Colour helpers
  // ===========================================================================

  const rgbC = {};
  function rgb(c) {
    if (rgbC[c]) return rgbC[c];
    const v = L.rgb(c);
    return (rgbC[c] = [v[0], v[1], v[2]]);
  }
  function mixc(a, b, t) {
    const A = typeof a === 'string' ? rgb(a) : a;
    const Bc = typeof b === 'string' ? rgb(b) : b;
    return [A[0] + (Bc[0] - A[0]) * t, A[1] + (Bc[1] - A[1]) * t, A[2] + (Bc[2] - A[2]) * t];
  }
  function css(c, a = 1) {
    const v = typeof c === 'string' ? rgb(c) : c;
    return `rgba(${v[0] | 0},${v[1] | 0},${v[2] | 0},${a})`;
  }
  kit.rgb = rgb;
  kit.mix = mixc;
  kit.css = css;

  // ===========================================================================
  // 2D helpers
  // ===========================================================================

  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  kit.rrect = rrect;

  /** Additive radial glow. */
  function glow(ctx, x, y, r, color, a = 1, core = 0.0) {
    if (r <= 0.5 || a <= 0.002) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, r * core, x, y, r);
    g.addColorStop(0, css(color, 0.55 * a));
    g.addColorStop(0.25, css(color, 0.22 * a));
    g.addColorStop(0.6, css(color, 0.06 * a));
    g.addColorStop(1, css(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }
  kit.glow = glow;

  const FONT = '"SF Pro Display", "Helvetica Neue", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, "DejaVu Sans", Arial, sans-serif';
  kit.FONT = FONT;
  function text(ctx, s, x, y, o = {}) {
    ctx.save();
    ctx.font = `${o.weight || 400} ${o.size || 40}px ${FONT}`;
    ctx.fillStyle = typeof o.color === 'string' ? o.color : css(o.color || P.bone);
    ctx.globalAlpha *= o.alpha != null ? o.alpha : 1;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.baseline || 'alphabetic';
    if ('letterSpacing' in ctx) ctx.letterSpacing = o.tracking ? `${o.tracking}px` : '0px';
    ctx.fillText(s, x, y);
    ctx.restore();
  }
  kit.text = text;
  function textWidth(ctx, s, size, weight = 400, tracking = 0) {
    ctx.save();
    ctx.font = `${weight} ${size}px ${FONT}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = tracking ? `${tracking}px` : '0px';
    const w = ctx.measureText(s).width;
    ctx.restore();
    return w;
  }
  kit.textWidth = textWidth;

  function star5(ctx, x, y, r, rot = -Math.PI / 2) {
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.45 : r;
      const a = rot + (i / 10) * TAU;
      if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }

  /** The profile's four-point gift sparkle. */
  function sparkle(ctx, x, y, r, a = 1, color = P.bone) {
    if (a <= 0.01 || r <= 0.3) return;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = color;
    ctx.beginPath();
    const w = r * 0.18;
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x + w, y - w, x + r, y);
    ctx.quadraticCurveTo(x + w, y + w, x, y + r);
    ctx.quadraticCurveTo(x - w, y + w, x - r, y);
    ctx.quadraticCurveTo(x - w, y - w, x, y - r);
    ctx.fill();
    ctx.restore();
  }
  kit.sparkle = sparkle;

  // ===========================================================================
  // Gift glyphs (art bible 10.2–10.4). All take a centre (x, y) and a size s in px.
  // ===========================================================================

  /**
   * bowtie(ctx, x, y, s, rot, o): s = wing span. o.yaw (3D turn, squashes x), o.alpha, o.seed, o.light (0..1)
   */
  function bowtie(ctx, x, y, s, rot = 0, o = {}) {
    if (s < 1) return;
    const yaw = o.yaw || 0;
    const sx = Math.max(0.08, Math.abs(Math.cos(yaw)));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(s * sx, s);
    ctx.globalAlpha *= o.alpha != null ? o.alpha : 1;
    const lw = 1 / s;
    const light = o.light != null ? o.light : 1;
    const fab = mixc(P.bowtieDark, P.bowtie, 0.35 + 0.65 * light);
    for (const side of [-1, 1]) {
      // wing: pleated butterfly shape
      const wing = new Path2D();
      wing.moveTo(side * 0.08, -0.11);
      wing.bezierCurveTo(side * 0.2, -0.2, side * 0.36, -0.29, side * 0.47, -0.28);
      wing.quadraticCurveTo(side * 0.53, -0.26, side * 0.52, -0.16);
      wing.bezierCurveTo(side * 0.49, -0.05, side * 0.49, 0.05, side * 0.52, 0.16);
      wing.quadraticCurveTo(side * 0.53, 0.26, side * 0.47, 0.28);
      wing.bezierCurveTo(side * 0.36, 0.29, side * 0.2, 0.2, side * 0.08, 0.11);
      wing.closePath();
      const g = ctx.createLinearGradient(0, -0.3, 0, 0.3);
      g.addColorStop(0, css(mixc(fab, P.bowtieLight, 0.35)));
      g.addColorStop(0.45, css(fab));
      g.addColorStop(1, css(mixc(fab, P.bowtieDark, 0.55)));
      ctx.fillStyle = g;
      ctx.fill(wing);
      ctx.save();
      ctx.clip(wing);
      // paisley pattern: seeded commas in the lighter fabric
      if (s > 40) {
        const r = L.rng(L.hash('bowtie-pattern', side, o.seed || 0));
        ctx.fillStyle = css(P.bowtieLight, 0.42 * light);
        for (let i = 0; i < 16; i++) {
          const px = side * (0.12 + r() * 0.4), py = (r() - 0.5) * 0.52, pr = 0.02 + r() * 0.022;
          ctx.beginPath();
          ctx.ellipse(px, py, pr, pr * 1.6, r() * TAU, 0, TAU);
          ctx.fill();
        }
      }
      // pleats fanning out from the knot
      ctx.strokeStyle = css(P.bowtieDark, 0.8);
      ctx.lineWidth = Math.max(lw * 1.2, 0.012);
      ctx.beginPath();
      for (const k of [-0.1, 0.02, 0.13]) {
        ctx.moveTo(side * 0.1, k * 0.6);
        ctx.quadraticCurveTo(side * 0.3, k * 1.2, side * 0.5, k * 1.6);
      }
      ctx.stroke();
      // top-edge sheen
      ctx.strokeStyle = css(P.bowtieLight, 0.7 * light);
      ctx.lineWidth = Math.max(lw * 1.5, 0.018);
      ctx.beginPath();
      ctx.moveTo(side * 0.12, -0.13);
      ctx.bezierCurveTo(side * 0.22, -0.2, side * 0.36, -0.26, side * 0.46, -0.25);
      ctx.stroke();
      ctx.restore();
    }
    // knot
    ctx.beginPath();
    rrect(ctx, -0.1, -0.14, 0.2, 0.28, 0.05);
    const kg = ctx.createLinearGradient(-0.1, 0, 0.1, 0);
    kg.addColorStop(0, css(mixc(fab, P.bowtieDark, 0.4)));
    kg.addColorStop(0.5, css(mixc(fab, P.bowtieLight, 0.2)));
    kg.addColorStop(1, css(mixc(fab, P.bowtieDark, 0.5)));
    ctx.fillStyle = kg;
    ctx.fill();
    // gold star
    ctx.beginPath();
    star5(ctx, 0, 0.005, 0.075);
    ctx.fillStyle = css(mixc(P.gold, P.star, 0.5 + 0.5 * light));
    ctx.fill();
    ctx.strokeStyle = css(P.gold, 0.9);
    ctx.lineWidth = Math.max(lw, 0.008);
    ctx.stroke();
    ctx.restore();
  }
  kit.bowtie = bowtie;

  /** The white paper-plane logo, drawn in a unit box (width 1, centred). */
  function plane(ctx, color, a = 1) {
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0.5, -0.38);
    ctx.lineTo(-0.5, 0.02);
    ctx.lineTo(-0.12, 0.12);
    ctx.lineTo(0.02, 0.42);
    ctx.lineTo(0.12, 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.moveTo(0.5, -0.38);
    ctx.lineTo(-0.12, 0.12);
    ctx.lineTo(0.02, 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /**
   * cap(ctx, x, y, s, yaw, o): baseball cap, s = crown width. yaw 0: brim toward the viewer.
   * o.white (white colourway), o.tilt (view elevation, default 0.38), o.rot (2D), o.alpha, o.light
   */
  function cap(ctx, x, y, s, yaw = 0, o = {}) {
    if (s < 1) return;
    const white = !!o.white;
    const tilt = o.tilt != null ? o.tilt : 0.38;
    const light = o.light != null ? o.light : 1;
    const base = white ? P.capWhite : P.capPurple;
    const lit = white ? P.bone : P.capPurpleLit;
    const shade = white ? P.capWhiteShade : P.violetDeep;
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    // cap-local 3D (x right, y up, z toward viewer) -> screen (unit = s)
    const pr = (X, Y, Z) => {
      const xr = X * Math.cos(yaw) + Z * Math.sin(yaw);
      const zr = -X * Math.sin(yaw) + Z * Math.cos(yaw);
      return [xr, -(Y * ct) + zr * st, zr * ct + Y * st];
    };
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(s, s);
    ctx.globalAlpha *= o.alpha != null ? o.alpha : 1;
    const lw = 1 / s;
    // brim outline in the band plane (y = 0.02), front along local +z
    const brim = [];
    const N = 28;
    for (let i = 0; i <= N; i++) {
      const ph = -1.35 + (2.7 * i) / N;
      const R = 0.5 + 0.43 * Math.pow(Math.cos(ph * 1.05), 1.4);
      brim.push(pr(Math.sin(ph) * R, 0.02 - 0.04 * Math.cos(ph), Math.cos(ph) * R));
    }
    for (let i = N; i >= 0; i--) {
      const ph = -1.35 + (2.7 * i) / N;
      brim.push(pr(Math.sin(ph) * 0.5, 0.03, Math.cos(ph) * 0.5));
    }
    const brimFront = Math.cos(yaw) * ct > -0.05;
    const drawBrim = () => {
      ctx.beginPath();
      brim.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      // top of brim visible from above (tilt > 0); underside when seen from below
      ctx.fillStyle = css(mixc(shade, base, st > 0 ? 0.55 * light + 0.2 : 0.15));
      ctx.fill();
      ctx.strokeStyle = css(shade, 0.9);
      ctx.lineWidth = Math.max(lw, 0.012);
      ctx.stroke();
      // brim edge highlight
      ctx.beginPath();
      for (let i = 4; i <= N - 4; i++) (i === 4 ? ctx.moveTo : ctx.lineTo).call(ctx, brim[i][0], brim[i][1]);
      ctx.strokeStyle = css(lit, 0.5 * light);
      ctx.lineWidth = Math.max(lw * 1.3, 0.016);
      ctx.stroke();
    };
    const drawCrown = () => {
      // dome silhouette: sample the half-ellipsoid rim and top
      // silhouette: upper half-ellipse over the top, then the near half of the band ellipse
      const dome = [];
      const M = 36;
      const H = Math.hypot(0.62 * ct, 0.5 * st);
      for (let i = 0; i <= M; i++) {
        const a = Math.PI - (Math.PI * i) / M; // left -> top -> right
        dome.push([0.5 * Math.cos(a), 0.03 - Math.sin(a) * H]);
      }
      for (let i = 0; i <= M; i++) {
        const a = (Math.PI * i) / M; // right -> front -> left
        dome.push([0.5 * Math.cos(a), 0.03 + Math.sin(a) * 0.5 * st]);
      }
      ctx.beginPath();
      dome.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      const g = ctx.createLinearGradient(-0.5, -0.6, 0.45, 0.1);
      g.addColorStop(0, css(mixc(base, lit, 0.55 * light)));
      g.addColorStop(0.5, css(base));
      g.addColorStop(1, css(mixc(base, shade, 0.6)));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      ctx.clip();
      // panel seams: meridians on the visible front
      ctx.strokeStyle = css(shade, 0.55);
      ctx.lineWidth = Math.max(lw, 0.01);
      for (const m of [-1.05, 0, 1.05, Math.PI]) {
        const a = m + yaw;
        if (Math.cos(a) * ct + 0.2 < 0) continue;
        ctx.beginPath();
        for (let k = 0; k <= 12; k++) {
          const el = (k / 12) * (Math.PI / 2);
          const X = Math.sin(m) * 0.5 * Math.cos(el), Z = Math.cos(m) * 0.5 * Math.cos(el), Y = 0.62 * Math.sin(el);
          const p = pr(X, Y, Z);
          k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
        }
        ctx.stroke();
      }
      // front logo
      const fz = Math.cos(yaw);
      if (fz > 0.05) {
        const p = pr(0, 0.28, 0.45);
        ctx.save();
        ctx.translate(p[0], p[1]);
        ctx.scale(0.26 * fz, 0.26);
        plane(ctx, white ? P.steelEdge : P.bone, 0.95);
        ctx.restore();
      }
      ctx.restore();
      // top button
      const tb = pr(0, 0.62, 0);
      ctx.beginPath();
      ctx.ellipse(tb[0], tb[1] - 0.01, 0.05, 0.03, 0, 0, TAU);
      ctx.fillStyle = css(mixc(base, lit, 0.4));
      ctx.fill();
    };
    if (brimFront) {
      drawCrown();
      drawBrim();
    } else {
      drawBrim();
      drawCrown();
    }
    ctx.restore();
  }
  kit.cap = cap;

  // 3x5 pixel digits for the tamagotchi LCD
  const DIG = {
    2: ['111', '001', '111', '100', '111'],
    0: ['111', '101', '101', '101', '111'],
    5: ['111', '100', '111', '001', '111'],
  };
  /** tama(ctx, x, y, s, rot, o): tamagotchi "2025", s = shell height. */
  function tama(ctx, x, y, s, rot = 0, o = {}) {
    if (s < 1) return;
    const light = o.light != null ? o.light : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(s, s);
    ctx.globalAlpha *= o.alpha != null ? o.alpha : 1;
    const lw = 1 / s;
    // ball chain arc (top right)
    ctx.fillStyle = css(mixc(P.tamaShade, P.tama, 0.6 * light));
    for (let i = 0; i < 9; i++) {
      const a = -2.4 + i * 0.28;
      ctx.beginPath();
      ctx.arc(0.18 + Math.cos(a) * 0.26, -0.5 + Math.sin(a) * 0.2, 0.03, 0, TAU);
      ctx.fill();
    }
    // key ring
    ctx.strokeStyle = css(mixc(P.tamaShade, P.tama, 0.5 * light));
    ctx.lineWidth = 0.035;
    ctx.beginPath();
    ctx.ellipse(0.38, -0.36, 0.11, 0.09, 0.4, 0, TAU);
    ctx.stroke();
    // shell: egg
    const egg = new Path2D();
    egg.moveTo(0, -0.5);
    egg.bezierCurveTo(0.3, -0.5, 0.44, -0.18, 0.43, 0.08);
    egg.bezierCurveTo(0.42, 0.34, 0.24, 0.5, 0, 0.5);
    egg.bezierCurveTo(-0.24, 0.5, -0.42, 0.34, -0.43, 0.08);
    egg.bezierCurveTo(-0.44, -0.18, -0.3, -0.5, 0, -0.5);
    const g = ctx.createRadialGradient(-0.14, -0.2, 0.05, 0, 0, 0.62);
    g.addColorStop(0, css(mixc(P.tamaShade, P.bone, 0.3 + 0.7 * light)));
    g.addColorStop(0.55, css(mixc(P.tamaShade, P.tama, 0.25 + 0.75 * light)));
    g.addColorStop(1, css(mixc(P.tamaShade, P.steelEdge, 0.3)));
    ctx.fillStyle = g;
    ctx.fill(egg);
    ctx.strokeStyle = css(P.tamaShade, 0.8);
    ctx.lineWidth = Math.max(lw, 0.012);
    ctx.stroke(egg);
    // screen bezel + LCD
    ctx.beginPath();
    rrect(ctx, -0.25, -0.26, 0.5, 0.44, 0.07);
    ctx.fillStyle = css(mixc(P.tamaShade, P.steelEdge, 0.4));
    ctx.fill();
    ctx.beginPath();
    rrect(ctx, -0.2, -0.21, 0.4, 0.34, 0.04);
    ctx.fillStyle = css(mixc(P.tamaPixel, P.tamaScreen, 0.35 + 0.65 * light));
    ctx.fill();
    // digits: 20 over 25
    if (s > 14) {
      ctx.fillStyle = css(P.tamaPixel, 0.92);
      const px = 0.032;
      const drawNum = (str, ox, oy) => {
        for (let d = 0; d < 2; d++) {
          const rows = DIG[str[d]];
          for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (rows[r][c] === '1') ctx.fillRect(ox + d * 4.2 * px + c * px, oy + r * px, px * 0.86, px * 0.86);
        }
      };
      drawNum('20', -0.15, -0.18);
      drawNum('25', -0.07, -0.015);
    }
    // buttons: triangle, circle, triangle
    ctx.fillStyle = css(mixc(P.tamaShade, P.steelEdge, 0.2), 0.95);
    ctx.beginPath();
    ctx.moveTo(-0.2, 0.3);
    ctx.lineTo(-0.1, 0.25);
    ctx.lineTo(-0.1, 0.35);
    ctx.closePath();
    ctx.moveTo(0.2, 0.3);
    ctx.lineTo(0.1, 0.25);
    ctx.lineTo(0.1, 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 0.022;
    ctx.strokeStyle = css(mixc(P.tamaShade, P.steelEdge, 0.2), 0.95);
    ctx.beginPath();
    ctx.arc(0, 0.31, 0.045, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  kit.tama = tama;

  kit.GIFTS = ['bowtie', 'capPurple', 'capWhite', 'tama'];
  /** gift(ctx, type, x, y, s, rot, yaw, o): dispatch; s is the gift's overall size in px. */
  function gift(ctx, type, x, y, s, rot = 0, yaw = 0, o = {}) {
    if (type === 'bowtie') bowtie(ctx, x, y, s, rot, Object.assign({ yaw }, o));
    else if (type === 'capPurple') cap(ctx, x, y + s * 0.12, s * 0.8, yaw, Object.assign({ rot }, o));
    else if (type === 'capWhite') cap(ctx, x, y + s * 0.12, s * 0.8, yaw, Object.assign({ rot, white: true }, o));
    else if (type === 'tama') tama(ctx, x, y, s * 0.92, rot, o);
  }
  kit.gift = gift;

  /** giftBubble(ctx, x, y, r, type, o): the profile's glow disc + gift + sparkles. o.p (bloom 0..1), o.T, o.seed */
  function giftBubble(ctx, x, y, r, type, o = {}) {
    const p = o.p != null ? o.p : 1;
    if (p <= 0) return;
    const T = o.T || 0;
    const warm = type === 'bowtie' || type === 'capPurple';
    const col = warm ? P.glowPink : P.glowSlate;
    const sc = p < 1 ? E.outBack(p) : 1;
    ctx.save();
    ctx.globalAlpha *= clamp(p * 1.6);
    // soft disc, like the profile's blurred bubble
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.15 * sc);
    g.addColorStop(0, css(col, 0.95));
    g.addColorStop(0.45, css(col, 0.55));
    g.addColorStop(0.8, css(col, 0.12));
    g.addColorStop(1, css(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r * 1.2, y - r * 1.2, r * 2.4, r * 2.4);
    const bob = Math.sin(T * 1.3 + (o.seed || 0)) * r * 0.03;
    const yaw = o.yaw != null ? o.yaw : 0.35 * Math.sin(T * 0.6 + (o.seed || 0));
    gift(ctx, type, x, y + bob, r * 1.5 * sc, type === 'bowtie' ? -0.08 : 0, type === 'tama' ? 0 : yaw, { seed: o.seed });
    // sparkles
    const rr = L.rng(L.hash('bubble-sparkle', o.seed || 0));
    const n = 4;
    for (let i = 0; i < n; i++) {
      const a = rr() * TAU, d = r * (0.55 + rr() * 0.5);
      const tw = 0.55 + 0.45 * Math.sin(T * 3 + i * 1.7 + (o.seed || 0));
      sparkle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.1 + rr() * 0.08) * sc, tw);
    }
    ctx.restore();
  }
  kit.giftBubble = giftBubble;

  /** onlineDot(ctx, x, y, r, a): the presence dot (violet core, hot centre, ring, halo). */
  function onlineDot(ctx, x, y, r, a = 1) {
    if (a <= 0.01 || r <= 0.2) return;
    glow(ctx, x, y, r * 5, P.violetMid, 0.8 * a);
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = P.violet;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = P.violetHot;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.5, 0, TAU);
    ctx.fill();
    if (r > 2) {
      ctx.strokeStyle = css(P.violetMid, 0.55);
      ctx.lineWidth = Math.max(0.6, r * 0.12);
      ctx.beginPath();
      ctx.arc(x, y, r * 1.8, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
  kit.onlineDot = onlineDot;

  /** notif(ctx, cx, cy, w, o): notification pill centred at (cx, cy). o.gift, o.alpha, o.glow, o.seed */
  function notif(ctx, cx, cy, w, o = {}) {
    const h = w * 0.168;
    const a = o.alpha != null ? o.alpha : 1;
    if (a <= 0.01 || w < 2) return;
    const x = cx - w / 2, y = cy - h / 2;
    ctx.save();
    ctx.globalAlpha *= a;
    if (o.glow !== 0) glow(ctx, cx, cy + h * 0.2, w * 0.55, P.violetMid, 0.35 * (o.glow != null ? o.glow : 1));
    ctx.beginPath();
    rrect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = css(P.tile, 0.96);
    ctx.fill();
    ctx.strokeStyle = P.steelEdge;
    ctx.lineWidth = Math.max(0.6, w / 400);
    ctx.stroke();
    // gift icon bubble
    const ir = h * 0.36;
    const type = o.gift || 'bowtie';
    const warm = type === 'bowtie' || type === 'capPurple';
    ctx.beginPath();
    ctx.arc(x + h * 0.5, cy, ir, 0, TAU);
    ctx.fillStyle = css(warm ? P.glowPink : P.glowSlate, 0.55);
    ctx.fill();
    gift(ctx, type, x + h * 0.5, cy, ir * 1.35, type === 'bowtie' ? -0.1 : 0, 0.2, { seed: o.seed });
    // text bars
    ctx.fillStyle = css(P.bone, 0.85);
    ctx.beginPath();
    rrect(ctx, x + h * 1.0, cy - h * 0.2, w * 0.36, h * 0.13, h * 0.065);
    ctx.fill();
    ctx.fillStyle = css(P.ash, 0.9);
    ctx.beginPath();
    rrect(ctx, x + h * 1.0, cy + h * 0.08, w * 0.24, h * 0.11, h * 0.055);
    ctx.fill();
    // unread dot
    ctx.fillStyle = P.violetMid;
    ctx.beginPath();
    ctx.arc(x + w - h * 0.45, cy, h * 0.1, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  kit.notif = notif;

  /** badge(ctx, x, y, str, size): violet count pill centred at (x, y). */
  function badge(ctx, x, y, str, size = 30, a = 1) {
    if (a <= 0.01) return;
    const w = Math.max(size * 1.35, textWidth(ctx, str, size, 700) + size * 0.8);
    const h = size * 1.35;
    ctx.save();
    ctx.globalAlpha *= a;
    glow(ctx, x, y, w * 0.9, P.violetMid, 0.5);
    ctx.beginPath();
    rrect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
    ctx.fillStyle = P.violet;
    ctx.fill();
    ctx.strokeStyle = css(P.void, 0.9);
    ctx.lineWidth = size * 0.12;
    ctx.stroke();
    text(ctx, str, x, y + size * 0.36, { size, weight: 700, align: 'center', color: P.bone });
    ctx.restore();
  }
  kit.badge = badge;

  /** presence(ctx, o): "2 online" on G1 geometry. o.blink (square alpha), o.alpha, o.digit */
  function presence(ctx, o = {}) {
    const a = o.alpha != null ? o.alpha : 1;
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.save();
    ctx.globalAlpha *= o.blink != null ? o.blink : 1;
    ctx.beginPath();
    rrect(ctx, 428, 872, 46, 46, 10);
    ctx.fillStyle = P.bone;
    ctx.fill();
    text(ctx, o.digit || '2', 451, 907, { size: 34, weight: 700, align: 'center', color: P.void });
    ctx.restore();
    text(ctx, 'online', 490, 912, { size: 56, weight: 400, color: P.mist });
    ctx.restore();
  }
  kit.presence = presence;

  // leaf / tulip pattern tile of the profile header (cached, t-independent)
  function leafTile() {
    return L.cached('kit-leaf-tile', () => {
      const S = 1;
      const c = FILM.makeCanvas(240 * S, 240 * S);
      const g = c.getContext('2d');
      g.scale(S, S);
      g.fillStyle = '#ffffff';
      const r = L.rng(L.hash('leaf-tile'));
      for (let i = 0; i < 4; i++) {
        const x = (i % 2) * 120 + 40 + r() * 30, y = Math.floor(i / 2) * 120 + 40 + r() * 30, rot = r() * TAU;
        g.save();
        g.translate(x, y);
        g.rotate(rot);
        g.beginPath();
        g.moveTo(0, 16);
        g.bezierCurveTo(-12, 6, -12, -10, 0, -18);
        g.bezierCurveTo(12, -10, 12, 6, 0, 16);
        g.moveTo(0, 16);
        g.lineTo(0, 26);
        g.fill();
        g.fillRect(-1, 14, 2, 12);
        g.restore();
      }
      return c;
    });
  }

  // ===========================================================================
  // G1: the profile screen
  // ===========================================================================

  kit.G1 = {
    avatar: { x: 540, y: 540, r: 160 },
    bubbles: [
      { x: 315, y: 455, type: 'capWhite' },
      { x: 290, y: 640, type: 'bowtie' },
      { x: 148, y: 770, type: 'capPurple' },
      { x: 765, y: 455, type: 'tama' },
      { x: 888, y: 575, type: 'bowtie' },
      { x: 790, y: 650, type: 'tama' },
    ],
    bubbleR: 58,
    badge: { x: 660, y: 410 },
    tiles: [124, 336, 548, 760].map((x) => ({ x, y: 975, w: 196, h: 160 })),
    tileLabels: ['call', 'unmute', 'search', 'more'],
    username: { x: 70, y: 1255, w: 940, h: 150 },
  };

  function icon(ctx, kind, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s / 40, s / 40);
    ctx.fillStyle = P.bone;
    ctx.strokeStyle = P.bone;
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (kind === 'call') {
      ctx.beginPath();
      ctx.moveTo(-14, -16);
      ctx.quadraticCurveTo(-20, -8, -12, 4);
      ctx.quadraticCurveTo(-2, 16, 12, 18);
      ctx.quadraticCurveTo(18, 16, 18, 10);
      ctx.lineTo(10, 4);
      ctx.lineTo(4, 8);
      ctx.quadraticCurveTo(-4, 2, -8, -6);
      ctx.lineTo(-4, -12);
      ctx.lineTo(-10, -18);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'unmute') {
      ctx.beginPath();
      ctx.moveTo(-12, 8);
      ctx.quadraticCurveTo(-10, -14, 0, -14);
      ctx.quadraticCurveTo(10, -14, 12, 8);
      ctx.lineTo(15, 12);
      ctx.lineTo(-15, 12);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 16, 4, 0, Math.PI);
      ctx.fill();
      ctx.strokeStyle = P.voidLift;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-17, -17);
      ctx.lineTo(17, 17);
      ctx.stroke();
      ctx.strokeStyle = P.bone;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-17, -17);
      ctx.lineTo(17, 17);
      ctx.stroke();
    } else if (kind === 'search') {
      ctx.beginPath();
      ctx.arc(-3, -3, 12, 0, TAU);
      ctx.moveTo(6, 6);
      ctx.lineTo(16, 16);
      ctx.stroke();
    } else {
      for (const dx of [-12, 0, 12]) {
        ctx.beginPath();
        ctx.arc(dx, 0, 3.6, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /**
   * profile(ctx, o) draws the whole G1 screen. Every part has a reveal amount in o.show (0..1, default 1):
   *   brackets, frame, header, status, back, edit, avatar, ring, name (typewriter), badgeGold, presence,
   *   tiles, music, username, tabs.
   * o.bubbles: array of 6 bloom amounts (default all 1); o.T: global time (avatar city time, sparkle twinkle);
   * o.avatar: false to skip the avatar content (a scene draws its own); o.digit: presence digit ('2');
   * o.blink: presence square alpha; o.count: string for the notification count badge (omit for none);
   * o.bg: false to skip the void fill (compositing over something else).
   */
  function profile(ctx, o = {}) {
    const sh = o.show || {};
    const S = (k) => (sh[k] == null ? 1 : clamp(sh[k]));
    const T = o.T || 0;
    if (o.bg !== false) {
      ctx.fillStyle = P.void;
      ctx.fillRect(-2000, -2000, 5080, 5920);
    }
    // header gradient
    const hA = S('header');
    if (hA > 0) {
      ctx.save();
      ctx.globalAlpha *= hA;
      const g = ctx.createRadialGradient(540, 540, 0, 540, 540, 880);
      g.addColorStop(0, P.charcoal);
      g.addColorStop(0.48, P.charcoalLow);
      g.addColorStop(1, P.void);
      ctx.fillStyle = g;
      ctx.beginPath();
      rrect(ctx, 30, 140, 1020, 1640, 72);
      ctx.fill();
      // leaf pattern
      ctx.save();
      ctx.clip();
      ctx.globalAlpha *= 0.045;
      const pat = ctx.createPattern(leafTile(), 'repeat');
      ctx.fillStyle = pat;
      ctx.fillRect(30, 150, 1020, 1000);
      ctx.restore();
      // lower half of the screen is black (as on the profile)
      const lg = ctx.createLinearGradient(0, 1150, 0, 1250);
      lg.addColorStop(0, css(P.void, 0));
      lg.addColorStop(1, css(P.void, 1));
      ctx.fillStyle = lg;
      ctx.fillRect(30, 1150, 1020, 630);
      ctx.restore();
    }
    // phone frame hairline
    const fA = S('frame');
    if (fA > 0) {
      ctx.save();
      ctx.strokeStyle = css(P.steelEdge, 0.55);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      rrect(ctx, 30, 140, 1020, 1640, 72);
      if (fA < 1) {
        ctx.setLineDash([5200 * fA, 6000]);
      }
      ctx.stroke();
      ctx.restore();
    }
    // status row
    const st = S('status');
    if (st > 0) {
      ctx.save();
      ctx.globalAlpha *= st;
      text(ctx, '12:14', 96, 258, { size: 44, weight: 600 });
      // bed glyph (Sleep focus)
      ctx.fillStyle = P.bone;
      ctx.beginPath();
      rrect(ctx, 244, 244, 48, 12, 3);
      ctx.fill();
      ctx.fillRect(244, 232, 6, 26);
      ctx.fillRect(286, 240, 6, 18);
      ctx.beginPath();
      rrect(ctx, 254, 236, 14, 8, 3);
      ctx.fill();
      ctx.beginPath();
      rrect(ctx, 270, 236, 20, 8, 3);
      ctx.fill();
      // signal
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        rrect(ctx, 760 + i * 13, 258 - 8 - i * 6, 9, 8 + i * 6, 2);
        ctx.fill();
      }
      // wifi
      ctx.strokeStyle = P.bone;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(852, 262, 8 + i * 8, -Math.PI * 0.75, -Math.PI * 0.25);
        ctx.stroke();
      }
      // battery
      ctx.beginPath();
      rrect(ctx, 890, 234, 50, 28, 8);
      ctx.fillStyle = css(P.ash, 0.8);
      ctx.fill();
      ctx.beginPath();
      rrect(ctx, 890, 234, 20, 28, 8);
      ctx.fillStyle = P.bone;
      ctx.fill();
      text(ctx, '37', 915, 256, { size: 20, weight: 700, align: 'center', color: P.void });
      ctx.restore();
    }
    // back + edit
    const bk = S('back');
    if (bk > 0) {
      ctx.save();
      ctx.globalAlpha *= bk;
      ctx.fillStyle = P.tile;
      ctx.beginPath();
      ctx.arc(140, 372, 50, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = P.bone;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(150, 350);
      ctx.lineTo(128, 372);
      ctx.lineTo(150, 394);
      ctx.stroke();
      ctx.restore();
    }
    const ed = S('edit');
    if (ed > 0) {
      ctx.save();
      ctx.globalAlpha *= ed;
      ctx.fillStyle = P.tile;
      ctx.beginPath();
      rrect(ctx, 790, 324, 146, 96, 48);
      ctx.fill();
      text(ctx, 'Edit', 863, 386, { size: 40, weight: 500, align: 'center' });
      ctx.restore();
    }
    // avatar
    const av = kit.G1.avatar;
    const aA = S('avatar');
    if (aA > 0 && o.avatar !== false) {
      ctx.save();
      ctx.globalAlpha *= aA;
      avatar(ctx, av.x, av.y, av.r, o.avatarT != null ? o.avatarT : T, o.avatarOpts);
      ctx.restore();
    }
    const rg = S('ring');
    if (rg > 0) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = css(P.violet, 0.9);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(av.x, av.y, av.r, -Math.PI / 2, -Math.PI / 2 + TAU * rg);
      ctx.stroke();
      ctx.strokeStyle = css(P.violetMid, 0.35);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(av.x, av.y, av.r + 5, -Math.PI / 2, -Math.PI / 2 + TAU * rg);
      ctx.stroke();
      ctx.restore();
    }
    // gift bubbles
    const bl = o.bubbles || [1, 1, 1, 1, 1, 1];
    kit.G1.bubbles.forEach((b, i) => {
      if (bl[i] > 0) giftBubble(ctx, b.x, b.y, kit.G1.bubbleR, b.type, { p: bl[i], T, seed: i + 1 });
    });
    // name
    const nm = S('name');
    if (nm > 0) {
      const full = 'cartezz';
      const s = full.slice(0, Math.max(0, Math.min(full.length, Math.ceil(full.length * nm - 1e-6))));
      const w = textWidth(ctx, full, 100, 600);
      text(ctx, s, 520 - w / 2, 840, { size: 100, weight: 600 });
    }
    const gb = S('badgeGold');
    if (gb > 0) {
      // the badge follows the rendered name (fonts differ between machines)
      const bx = Math.max(745, 520 + textWidth(ctx, 'cartezz', 100, 600) / 2 + 36);
      goldBadge(ctx, bx, 805, 56 * (gb < 1 ? E.outBack(gb) : 1), gb, T);
    }
    const pr = S('presence');
    if (pr > 0) presence(ctx, { alpha: pr, blink: o.blink, digit: o.digit });
    // action tiles
    const tl = S('tiles');
    if (tl > 0) {
      kit.G1.tiles.forEach((t, i) => {
        const a = clamp(tl * 4 - i * 0.8);
        if (a <= 0) return;
        ctx.save();
        ctx.globalAlpha *= a;
        ctx.fillStyle = P.voidLift;
        ctx.beginPath();
        rrect(ctx, t.x, t.y, t.w, t.h, 34);
        ctx.fill();
        icon(ctx, kit.G1.tileLabels[i], t.x + t.w / 2, 1038, 46);
        text(ctx, kit.G1.tileLabels[i], t.x + t.w / 2, 1106, { size: 30, weight: 400, align: 'center' });
        ctx.restore();
      });
    }
    const mu = S('music');
    if (mu > 0) {
      ctx.save();
      ctx.globalAlpha *= mu;
      const a = textWidth(ctx, 'twerk', 34, 600), b = textWidth(ctx, ' - cartezz', 34, 400);
      const total = 40 + a + b + 30;
      let x = 540 - total / 2;
      // note glyph
      ctx.fillStyle = P.bone;
      ctx.strokeStyle = P.bone;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(x + 12, 1206);
      ctx.lineTo(x + 12, 1176);
      ctx.lineTo(x + 30, 1172);
      ctx.lineTo(x + 30, 1200);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x + 7, 1206, 6.5, 5, -0.3, 0, TAU);
      ctx.ellipse(x + 25, 1201, 6.5, 5, -0.3, 0, TAU);
      ctx.fill();
      x += 44;
      text(ctx, 'twerk', x, 1205, { size: 34, weight: 600 });
      text(ctx, ' - cartezz', x + a, 1205, { size: 34, color: P.mist });
      ctx.lineWidth = 3;
      ctx.strokeStyle = P.mist;
      ctx.beginPath();
      ctx.moveTo(x + a + b + 14, 1182);
      ctx.lineTo(x + a + b + 24, 1194);
      ctx.lineTo(x + a + b + 14, 1206);
      ctx.stroke();
      ctx.restore();
    }
    const un = S('username');
    if (un > 0) {
      ctx.save();
      ctx.globalAlpha *= un;
      ctx.fillStyle = P.tile;
      ctx.beginPath();
      rrect(ctx, 70, 1255, 940, 150, 56);
      ctx.fill();
      text(ctx, 'username', 120, 1318, { size: 34 });
      text(ctx, '@murthered', 120, 1378, { size: 46, color: P.link });
      // QR glyph
      ctx.strokeStyle = P.link;
      ctx.lineWidth = 4;
      for (const [qx, qy] of [[926, 1306], [956, 1306], [926, 1336]]) {
        ctx.beginPath();
        rrect(ctx, qx - 12, qy - 12, 22, 22, 5);
        ctx.stroke();
      }
      ctx.fillStyle = P.link;
      for (const [qx, qy] of [[950, 1330], [962, 1342], [950, 1342], [962, 1330]]) ctx.fillRect(qx - 3, qy - 3, 6, 6);
      ctx.restore();
    }
    const tb = S('tabs');
    if (tb > 0) {
      ctx.save();
      ctx.globalAlpha *= tb;
      ctx.fillStyle = P.charcoalLow;
      ctx.beginPath();
      rrect(ctx, 70, 1440, 940, 80, 40);
      ctx.fill();
      ctx.fillStyle = css(P.charcoal, 1);
      ctx.beginPath();
      rrect(ctx, 80, 1448, 280, 64, 32);
      ctx.fill();
      text(ctx, 'Gifts', 110, 1492, { size: 36, weight: 500 });
      gift(ctx, 'tama', 225, 1480, 30, 0, 0);
      gift(ctx, 'capWhite', 265, 1480, 32, 0, 0.3);
      gift(ctx, 'tama', 305, 1480, 30, 0, 0);
      text(ctx, 'Media', 440, 1492, { size: 36, alpha: 0.9 });
      text(ctx, 'Voice', 610, 1492, { size: 36, alpha: 0.9 });
      text(ctx, 'Links', 780, 1492, { size: 36, alpha: 0.9 });
      ctx.restore();
    }
    // the profile dissolves into darkness below
    if (o.fade !== false) {
      const fg = ctx.createLinearGradient(0, 1450, 0, 1640);
      fg.addColorStop(0, css(P.void, 0));
      fg.addColorStop(1, css(P.void, 1));
      ctx.fillStyle = fg;
      ctx.fillRect(0, 1450, 1080, 470);
    }
    // scanlines over the screen
    ctx.save();
    ctx.globalAlpha *= 0.03 * hA;
    ctx.fillStyle = P.bone;
    for (let y = 142; y < 1450; y += 6) ctx.fillRect(32, y, 1016, 1);
    ctx.restore();
    // count badge
    if (o.count) badge(ctx, kit.G1.badge.x, kit.G1.badge.y, o.count, 30, o.countAlpha != null ? o.countAlpha : 1);
    // classified-system brackets
    const br = S('brackets');
    if (br > 0) brackets(ctx, 60, 220, 940, 1540, 22 * br, css(P.ash, 0.7));
  }
  kit.profile = profile;

  function brackets(ctx, x0, y0, x1, y1, arm, color, lw = 1.5) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
      ctx.moveTo(x + dx * arm, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + dy * arm);
    }
    ctx.stroke();
    ctx.restore();
  }
  kit.brackets = brackets;

  /** The gold collectible badge next to the name: a small golden jackal-head statuette glyph with sparkles. */
  function goldBadge(ctx, x, y, s, a = 1, T = 0) {
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(x, y);
    ctx.scale(s / 56, s / 56);
    const g = ctx.createLinearGradient(-20, -26, 20, 26);
    g.addColorStop(0, P.star);
    g.addColorStop(0.5, P.gold);
    g.addColorStop(1, css(mixc(P.gold, P.void, 0.45)));
    ctx.fillStyle = g;
    ctx.beginPath();
    // seated jackal silhouette: ears, snout, body, base
    ctx.moveTo(-4, -26);
    ctx.lineTo(0, -14);
    ctx.lineTo(4, -26);
    ctx.lineTo(8, -12);
    ctx.lineTo(18, -8);
    ctx.lineTo(8, -4);
    ctx.quadraticCurveTo(14, 8, 12, 18);
    ctx.lineTo(-12, 18);
    ctx.quadraticCurveTo(-14, 4, -6, -6);
    ctx.lineTo(-8, -14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = css(P.violet, 0.9);
    ctx.fillRect(-16, 18, 32, 8);
    ctx.restore();
    sparkle(ctx, x - s * 0.45, y - s * 0.35, s * 0.12, 0.6 + 0.4 * Math.sin(T * 4));
    sparkle(ctx, x + s * 0.4, y + s * 0.3, s * 0.09, 0.6 + 0.4 * Math.sin(T * 3 + 2));
  }
  kit.goldBadge = goldBadge;

  // ===========================================================================
  // 3D camera (storyboard Conventions)
  // ===========================================================================

  /**
   * cam({ pos:[x,y,z], yaw, pitch, f, cx, cy }): yaw 0 looks down +z (positive turns toward +x),
   * pitch positive looks up, f focal length in px, principal point (cx, cy) default (540, 960).
   * Returns { toCam(x,y,z) -> [xc,yc,zc], proj(xc,yc,zc) -> [sx,sy], project(x,y,z) -> [sx,sy,depth,pxPerMetre] | null }.
   */
  function cam(o) {
    const pos = o.pos || [0, 1.6, 0];
    const px = pos[0], py = pos[1], pz = pos[2];
    const yaw = o.yaw || 0, pitch = o.pitch || 0, f = o.f || 1200;
    const cY = Math.cos(yaw), sY = Math.sin(yaw), cP = Math.cos(pitch), sP = Math.sin(pitch);
    const ox = o.cx != null ? o.cx : 540, oy = o.cy != null ? o.cy : 960;
    const near = o.near || 0.2;
    const C = { pos, yaw, pitch, f, cx: ox, cy: oy, near };
    C.toCam = (x, y, z) => {
      const dx = x - px, dy = y - py, dz = z - pz;
      const xc = dx * cY - dz * sY;
      const zf = dx * sY + dz * cY;
      return [xc, dy * cP - zf * sP, zf * cP + dy * sP];
    };
    C.proj = (xc, yc, zc) => [ox + (f * xc) / zc, oy - (f * yc) / zc];
    C.project = (x, y, z) => {
      const c = C.toCam(x, y, z);
      if (c[2] < near) return null;
      return [ox + (f * c[0]) / c[2], oy - (f * c[1]) / c[2], c[2], f / c[2]];
    };
    C.dist = (x, y, z) => Math.hypot(x - px, y - py, z - pz);
    C.horizonY = () => oy + f * Math.tan(pitch);
    return C;
  }
  kit.cam = cam;
  /** Interpolate two camera specs (plain objects) by p; positions linearly, angles and f too. */
  kit.lerpCam = (a, b, p) => ({
    pos: [lerp(a.pos[0], b.pos[0], p), lerp(a.pos[1], b.pos[1], p), lerp(a.pos[2], b.pos[2], p)],
    yaw: lerp(a.yaw || 0, b.yaw || 0, p),
    pitch: lerp(a.pitch || 0, b.pitch || 0, p),
    f: lerp(a.f || 1200, b.f || 1200, p),
  });

  kit.CAM_AVATAR = Object.freeze({ pos: Object.freeze([0, 34, 152]), yaw: 0, pitch: -0.39, f: 1300 });

  /** Near-plane clip of a world polygon, then projection. Returns screen points or null. */
  function projPoly(C, pts) {
    const n = pts.length;
    const cs = new Array(n);
    let anyIn = false, allIn = true;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      cs[i] = C.toCam(p[0], p[1], p[2]);
      if (cs[i][2] >= C.near) anyIn = true;
      else allIn = false;
    }
    if (!anyIn) return null;
    let poly = cs;
    if (!allIn) {
      poly = [];
      for (let i = 0; i < n; i++) {
        const a = cs[i], b = cs[(i + 1) % n];
        const ia = a[2] >= C.near, ib = b[2] >= C.near;
        if (ia) poly.push(a);
        if (ia !== ib) {
          const u = (C.near - a[2]) / (b[2] - a[2]);
          poly.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, C.near]);
        }
      }
      if (poly.length < 3) return null;
    }
    return poly.map((c) => C.proj(c[0], c[1], c[2]));
  }
  kit.projPoly = projPoly;
  function pathPoly(ctx, sp) {
    ctx.moveTo(sp[0][0], sp[0][1]);
    for (let i = 1; i < sp.length; i++) ctx.lineTo(sp[i][0], sp[i][1]);
    ctx.closePath();
  }
  function projSeg(C, a, b) {
    let ca = C.toCam(a[0], a[1], a[2]), cb = C.toCam(b[0], b[1], b[2]);
    const n = C.near;
    if (ca[2] < n && cb[2] < n) return null;
    if (ca[2] < n) {
      const u = (n - ca[2]) / (cb[2] - ca[2]);
      ca = [ca[0] + (cb[0] - ca[0]) * u, ca[1] + (cb[1] - ca[1]) * u, n];
    } else if (cb[2] < n) {
      const u = (n - cb[2]) / (ca[2] - cb[2]);
      cb = [cb[0] + (ca[0] - cb[0]) * u, cb[1] + (ca[1] - cb[1]) * u, n];
    }
    return [C.proj(ca[0], ca[1], ca[2]), C.proj(cb[0], cb[1], cb[2]), ca[2], cb[2]];
  }
  kit.projSeg = projSeg;

  /**
   * planeImage(ctx, C, img, TL, TR, BL, o): draw an image on a world-space parallelogram (TL, TR, BL corners)
   * with a strip warp (o.strips, default 48) — exact enough for any camera. o.alpha, o.composite.
   */
  function planeImage(ctx, C, img, TL, TR, BL, o = {}) {
    const N = o.strips || 48;
    const W = img.width, H = img.height;
    ctx.save();
    if (o.composite) ctx.globalCompositeOperation = o.composite;
    ctx.globalAlpha *= o.alpha != null ? o.alpha : 1;
    const ux = TR[0] - TL[0], uy = TR[1] - TL[1], uz = TR[2] - TL[2];
    for (let i = 0; i < N; i++) {
      const v0 = i / N, v1 = (i + 1) / N;
      const A = [TL[0] + (BL[0] - TL[0]) * v0, TL[1] + (BL[1] - TL[1]) * v0, TL[2] + (BL[2] - TL[2]) * v0];
      const Cw = [TL[0] + (BL[0] - TL[0]) * v1, TL[1] + (BL[1] - TL[1]) * v1, TL[2] + (BL[2] - TL[2]) * v1];
      const pa = C.project(A[0], A[1], A[2]);
      const pb = C.project(A[0] + ux, A[1] + uy, A[2] + uz);
      const pc = C.project(Cw[0], Cw[1], Cw[2]);
      if (!pa || !pb || !pc) continue;
      const sy0 = v0 * H, hs = (v1 - v0) * H;
      const a = (pb[0] - pa[0]) / W, b = (pb[1] - pa[1]) / W;
      const c = (pc[0] - pa[0]) / hs, d = (pc[1] - pa[1]) / hs;
      ctx.save();
      ctx.transform(a, b, c, d, pa[0] - c * sy0, pa[1] - d * sy0);
      ctx.drawImage(img, 0, sy0, W, hs * 1.04, 0, sy0, W, hs * 1.04);
      ctx.restore();
    }
    ctx.restore();
  }
  kit.planeImage = planeImage;

  // ===========================================================================
  // G3: the city data (built once, seeded, t-independent)
  // ===========================================================================

  const BUTTON = Object.freeze({ z: 220, x0: -12, x1: 12, y0: 0.6, y1: 10.6, bezel: { x0: -13, x1: 13, y0: 0, y1: 11.8, z0: 220, z1: 223 } });
  kit.BUTTON = BUTTON;
  const HOLO = Object.freeze({ x: 0, y: 40, z: 140, w: 30, h: 53.33 });
  kit.HOLO = HOLO;

  let CITY = null;
  function cityData() {
    if (CITY) return CITY;
    const r = L.rng(L.hash('cartezz-city', 1));
    const towers = [];
    const rows = [
      { xn: 13, d: [12, 24], h: [22, 78] },
      { xn: 36, d: [10, 20], h: [55, 125] },
      { xn: 58, d: [10, 22], h: [85, 160] },
    ];
    for (const side of [-1, 1]) {
      rows.forEach((row, ri) => {
        let z = -90 + r() * 6;
        while (z < 250) {
          const w = 9 + r() * 14;
          const inPlaza = ri === 0 && z + w > 194 && z < 240;
          if (!inPlaza) {
            const d = row.d[0] + r() * (row.d[1] - row.d[0]);
            const xn = row.xn + (ri === 0 ? r() * 1.5 : r() * 4);
            const h = row.h[0] + Math.pow(r(), 1.3) * (row.h[1] - row.h[0]);
            towers.push(makeTower(side > 0 ? xn : -(xn + d), side > 0 ? xn + d : -xn, z, z + w, h, ri, r));
          } else if (z + w > 240) {
            z = 240;
            continue;
          }
          z += w + 1.5 + r() * 4;
        }
      });
    }
    // the plaza's back wall, behind the button
    for (let x = -46; x < 46; ) {
      const w = 8 + r() * 10;
      towers.push(makeTower(x, x + w, 246 + r() * 6, 262 + r() * 10, 50 + r() * 100, 1, r));
      x += w + 1 + r() * 2;
    }
    // far skyline (flat haze silhouettes)
    const skyline = [];
    for (let x = -420; x < 420; ) {
      const w = 14 + r() * 30;
      skyline.push({ x0: x, x1: x + w, z: 330 + r() * 120, h: 60 + r() * 190 });
      x += w + r() * 8;
    }
    // floating gifts
    const objects = [];
    const types = ['bowtie', 'bowtie', 'bowtie', 'capPurple', 'capPurple', 'capWhite', 'capWhite', 'tama', 'tama', 'notif'];
    for (let i = 0; i < 64; i++) {
      const u = i / 64;
      const arrive = 10.95 + 13.2 * Math.pow(u, 0.85) + r() * 0.3;
      const grow = Math.pow(clamp((arrive - 10.9) / 13.3), 1.35);
      const size = lerp(4, 26, grow) * (0.75 + 0.5 * r());
      let x = (r() * 2 - 1) * 46;
      if (Math.abs(x) < 6 && r() < 0.6) x *= 3;
      objects.push({
        type: types[Math.floor(r() * types.length)],
        x, y: 14 + r() * 70 + size * 0.4, z: -25 + r() * 240,
        size, arrive, seed: i,
        spin: (r() * 2 - 1) * 0.3, yaw0: r() * TAU, rot0: (r() - 0.5) * 0.5,
        bob: 0.3 + r() * 0.6, freq: 0.15 + r() * 0.25, ph: r() * TAU,
      });
    }
    // story objects (storyboard: 08 bow tie at 14.667, 09 white cap at 17.333, the plaza giants)
    const add = (type, x, y, z, size, arrive, spin) =>
      objects.push({ type, x, y, z, size, arrive, seed: objects.length, spin, yaw0: 0.3, rot0: -0.1, bob: 0.5, freq: 0.2, ph: objects.length });
    add('bowtie', -3, 24, 82, 17, 14.667, 0.08);
    add('capWhite', 7, 15, 100, 16, 17.333, 0.25);
    add('bowtie', -24, 30, 204, 20, 20.5, 0.06);
    add('tama', 22, 21, 198, 12, 19.8, 0.1);
    add('capPurple', 13, 36, 214, 17, 21.0, -0.2);
    add('notif', -15, 44, 222, 26, 21.5, 0);
    add('capWhite', -9, 52, 230, 15, 22.0, 0.15);
    add('tama', 6, 26, 206, 9, 22.4, -0.12);
    // the orbit around the hologram (shot 11): arrivals on the 8ths from 21.333
    const orbit = [];
    for (let i = 0; i < 22; i++) {
      const slot = i < 8 ? -1 : Math.floor((i - 8) / 3.5);
      orbit.push({
        type: types[i % types.length === 9 ? 0 : i % 9],
        a0: (i / 22) * TAU + r() * 0.2,
        rad: 24 + r() * 16,
        dz: -4 - r() * 10,
        size: 5 + r() * 7,
        arrive: slot < 0 ? 20.2 + r() * 0.6 : 21.333 + Math.min(3, slot) * (B / 2),
        seed: 500 + i,
        spin: (r() * 2 - 1) * 0.3,
      });
    }
    // online-dot particles
    const dots = [];
    for (let i = 0; i < 150; i++) dots.push({ x: (r() * 2 - 1) * 42, z: -30 + r() * 265, y0: r() * 100, v: 0.5 + r() * 1.1, rad: 0.18 + r() * 0.4, ph: r() * TAU });
    // searchlights
    const beams = [
      { o: [-40, 118, 176], az: 0.35, el: 1.0, k: 0 },
      { o: [44, 132, 150], az: -0.4, el: 1.05, k: 1.7 },
      { o: [-52, 150, 96], az: 0.55, el: 0.95, k: 3.1 },
      { o: [50, 140, 60], az: -0.6, el: 1.0, k: 4.4 },
    ];
    CITY = { towers, skyline, objects, orbit, dots, beams };
    return CITY;
  }
  kit.cityData = cityData;

  function makeTower(x0, x1, z0, z1, h, row, r) {
    const slabs = [];
    let y = 0;
    while (y < h - 2) {
      const sh = Math.min(h - y, 4 + r() * 5);
      slabs.push([y, y + sh]);
      y += sh + 0.8;
    }
    const top = slabs.length ? slabs[slabs.length - 1][1] : h;
    return {
      x0, x1, z0, z1, h: top, row, slabs,
      seed: Math.floor(r() * 1e9),
      trim: r() < 0.28,
      antenna: r() < 0.35 ? 6 + r() * 14 : 0,
      tint: r(),
      feedPitch: 2.6,
      outgoing: r(),
    };
  }

  // ===========================================================================
  // G3: drawing the city
  // ===========================================================================

  const fogAmt = (d) => Math.min(0.9, 1 - Math.exp(-d / 150));
  const prox = (z) => Math.exp(-Math.abs(z - BUTTON.z) / 55); // closeness to the button's light
  function shade(base, d, z, lightK = 1) {
    let c = mixc(base, P.hazeViolet, 0.55 * prox(z) * lightK);
    const f = fogAmt(d);
    return mixc(c, mixc(P.haze, P.hazeViolet, prox(z)), f);
  }

  /** Face helper: a planar rectangle O + u·U + v·V (u, v in metres), precomputed in camera space. */
  function faceCam(C, O, U, V) {
    const o = C.toCam(O[0], O[1], O[2]);
    const a = C.toCam(O[0] + U[0], O[1] + U[1], O[2] + U[2]);
    const b = C.toCam(O[0] + V[0], O[1] + V[1], O[2] + V[2]);
    const cu = [a[0] - o[0], a[1] - o[1], a[2] - o[2]];
    const cv = [b[0] - o[0], b[1] - o[1], b[2] - o[2]];
    return (u, v) => {
      const zc = o[2] + cu[2] * u + cv[2] * v;
      if (zc < C.near) return null;
      return [C.cx + (C.f * (o[0] + cu[0] * u + cv[0] * v)) / zc, C.cy - (C.f * (o[1] + cu[1] * u + cv[1] * v)) / zc, zc];
    };
  }

  function sky(ctx, C, Tc, o) {
    const hy = C.horizonY();
    const g = ctx.createLinearGradient(0, hy - 1400, 0, hy + 10);
    g.addColorStop(0, P.void);
    g.addColorStop(0.7, P.voidLift);
    g.addColorStop(1, css(mixc(P.haze, P.hazeViolet, 0.4)));
    ctx.fillStyle = g;
    ctx.fillRect(-4000, -4000, 9080, 9920);
    // the button's light in the sky
    const pb = C.project(0, 20, BUTTON.z + 30);
    if (pb) glow(ctx, pb[0], pb[1], Math.min(3000, 200 * pb[3] + 500), P.hazeViolet, 0.5 * (o.skyGlow != null ? o.skyGlow : 1));
    // the enormous ring: the avatar's edge, seen from inside
    ctx.save();
    ctx.strokeStyle = css(P.violetMid, 0.05);
    ctx.lineWidth = 2 * (o.lw || 1);
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * TAU;
      const p = C.project(Math.cos(a) * 760, 90 + Math.sin(a) * 760, 950);
      if (!p) {
        pen = false;
        continue;
      }
      pen ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
      pen = true;
    }
    ctx.stroke();
    ctx.restore();
  }

  function skylineDraw(ctx, C, D) {
    ctx.save();
    for (const s of D.skyline) {
      const sp = projPoly(C, [[s.x0, 0, s.z], [s.x1, 0, s.z], [s.x1, s.h, s.z], [s.x0, s.h, s.z]]);
      if (!sp) continue;
      ctx.fillStyle = css(mixc(P.voidLift, P.haze, 0.55));
      ctx.beginPath();
      pathPoly(ctx, sp);
      ctx.fill();
    }
    ctx.restore();
  }

  function ground(ctx, C, Tc, o, intensity) {
    const hy = C.horizonY();
    const lw = o.lw || 1;
    if (hy < 1920 + 4000) {
      const g = ctx.createLinearGradient(0, Math.max(-4000, hy), 0, Math.max(hy + 10, 1920));
      g.addColorStop(0, css(mixc(P.haze, P.hazeViolet, 0.3)));
      g.addColorStop(0.08, P.voidLift);
      g.addColorStop(1, P.void);
      ctx.fillStyle = g;
      ctx.fillRect(-4000, Math.max(-4000, hy), 9080, 9920);
    }
    const cz = C.pos[2];
    // road (slightly darker, glossy)
    const road = projPoly(C, [[-9, 0, Math.max(-90, cz - 40)], [9, 0, Math.max(-90, cz - 40)], [9, 0, 196], [-9, 0, 196]]);
    if (road) {
      ctx.fillStyle = css(P.void, 0.55);
      ctx.beginPath();
      pathPoly(ctx, road);
      ctx.fill();
    }
    // the button's reflection on the wet road
    const refl = projPoly(C, [[-7, 0, BUTTON.z - 1], [7, 0, BUTTON.z - 1], [1.2, 0, Math.max(cz + 2, 40)], [-1.2, 0, Math.max(cz + 2, 40)]]);
    if (refl) {
      const a = C.project(0, 0, BUTTON.z - 1), b = C.project(0, 0, Math.max(cz + 2, 40));
      if (a && b) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
        g.addColorStop(0, css(P.violetMid, 0.13 * intensity));
        g.addColorStop(0.25, css(P.violet, 0.04 * intensity));
        g.addColorStop(1, css(P.violet, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        pathPoly(ctx, refl);
        ctx.fill();
        ctx.restore();
      }
    }
    // pool of light in the plaza
    const pl = C.project(0, 0, BUTTON.z - 10);
    if (pl) {
      const q = C.project(0, 0, BUTTON.z - 40);
      const sq = q ? clamp(Math.abs(q[1] - pl[1]) / (30 * pl[3]), 0.06, 1) : 0.2;
      ctx.save();
      ctx.translate(pl[0], pl[1]);
      ctx.scale(1, sq);
      glow(ctx, 0, 0, 24 * pl[3], P.violetMid, 0.2 * intensity);
      ctx.restore();
    }
    // grid: lines along z every 4 m, across every 6 m; curbs and the dotted centre line
    ctx.save();
    ctx.lineWidth = lw;
    const zs = [Math.max(-90, cz - 30), cz + 8, cz + 30, cz + 80, 262];
    for (let x = -60; x <= 60; x += 4) {
      if (Math.abs(x) < 0.1) continue;
      const curb = Math.abs(x) === 12;
      for (let k = 0; k < zs.length - 1; k++) {
        const s = projSeg(C, [x, 0, zs[k]], [x, 0, zs[k + 1]]);
        if (!s) continue;
        const d = Math.hypot(x - C.pos[0], C.pos[1], (zs[k] + zs[k + 1]) / 2 - cz);
        ctx.strokeStyle = curb ? css(mixc(P.steelEdge, P.violetMid, 0.45), 0.7 * (1 - fogAmt(d))) : css(P.steelEdge, 0.42 * (1 - fogAmt(d)));
        ctx.beginPath();
        ctx.moveTo(s[0][0], s[0][1]);
        ctx.lineTo(s[1][0], s[1][1]);
        ctx.stroke();
      }
    }
    for (const x of [-9, 9]) {
      for (let k = 0; k < zs.length - 1; k++) {
        const s = projSeg(C, [x, 0, zs[k]], [x, 0, Math.min(zs[k + 1], 196)]);
        if (!s) continue;
        const d = Math.hypot(x - C.pos[0], C.pos[1], (zs[k] + zs[k + 1]) / 2 - cz);
        ctx.strokeStyle = css(mixc(P.steelEdge, P.violetMid, 0.3), 0.6 * (1 - fogAmt(d)));
        ctx.beginPath();
        ctx.moveTo(s[0][0], s[0][1]);
        ctx.lineTo(s[1][0], s[1][1]);
        ctx.stroke();
      }
    }
    for (let z = -90; z <= 262; z += 6) {
      const d = Math.abs(z - cz);
      if (z < cz - 30) continue;
      const s = projSeg(C, [-60, 0, z], [60, 0, z]);
      if (!s) continue;
      ctx.strokeStyle = css(P.steelEdge, 0.3 * (1 - fogAmt(d)));
      ctx.beginPath();
      ctx.moveTo(s[0][0], s[0][1]);
      ctx.lineTo(s[1][0], s[1][1]);
      ctx.stroke();
    }
    ctx.restore();
    // centre line: small UI dashes
    ctx.save();
    for (let z = Math.ceil((cz + 3) / 3) * 3; z < 196; z += 3) {
      if (z < -90) continue;
      const sp = projPoly(C, [[-0.12, 0, z], [0.12, 0, z], [0.12, 0, z + 0.9], [-0.12, 0, z + 0.9]]);
      if (!sp) continue;
      const d = Math.abs(z - cz);
      ctx.fillStyle = css(mixc(P.ash, P.violetMid, prox(z)), 0.4 * (1 - fogAmt(d)) * clamp((d - 3) / 8));
      ctx.beginPath();
      pathPoly(ctx, sp);
      ctx.fill();
    }
    ctx.restore();
  }

  /** The city is asleep (lights off) until the world breaks at 10.667. */
  const awake = (Tc) => (Tc < T_BREAK ? 0.12 : 1);
  kit.awake = awake;
  function drawTower(ctx, C, t, Tc, o, riseF) {
    const h = t.h * riseF;
    const aw = awake(Tc);
    if (h < 0.3) return;
    const cp = C.pos;
    const lw = o.lw || 1;
    const lod = o.px || 1;
    const cx = (t.x0 + t.x1) / 2, cz = (t.z0 + t.z1) / 2;
    const d = Math.hypot(cx - cp[0], h * 0.4 - cp[1], cz - cp[2]);
    const faces = [];
    if (cp[2] < t.z0) faces.push({ k: 'front', O: [t.x0, 0, t.z0], U: [t.x1 - t.x0, 0, 0], V: [0, h, 0], w: t.x1 - t.x0, base: P.steel, feed: true });
    if (cp[2] > t.z1) faces.push({ k: 'back', O: [t.x1, 0, t.z1], U: [t.x0 - t.x1, 0, 0], V: [0, h, 0], w: t.x1 - t.x0, base: P.steelLit, feed: false });
    if (cp[0] < t.x0) faces.push({ k: 'left', O: [t.x0, 0, t.z1], U: [0, 0, t.z0 - t.z1], V: [0, h, 0], w: t.z1 - t.z0, base: mixc(P.steel, P.steelLit, 0.5), feed: t.x0 > 0 });
    if (cp[0] > t.x1) faces.push({ k: 'right', O: [t.x1, 0, t.z0], U: [0, 0, t.z1 - t.z0], V: [0, h, 0], w: t.z1 - t.z0, base: mixc(P.steel, P.steelLit, 0.5), feed: t.x1 < 0 });
    for (const F of faces) {
      const fp = faceCam(C, F.O, F.U, F.V);
      const sp = projPoly(C, [F.O, [F.O[0] + F.U[0], 0, F.O[2] + F.U[2]], [F.O[0] + F.U[0], h, F.O[2] + F.U[2]], [F.O[0], h, F.O[2]]]);
      if (!sp) continue;
      let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
      for (const p of sp) {
        if (p[0] < minx) minx = p[0];
        if (p[0] > maxx) maxx = p[0];
        if (p[1] < miny) miny = p[1];
        if (p[1] > maxy) maxy = p[1];
      }
      if (maxx < -200 || minx > 1280 || maxy < -300 || miny > 2220) continue;
      const faceZ = F.k === 'front' ? t.z0 : F.k === 'back' ? t.z1 : cz;
      const col = shade(F.base, d, faceZ, F.k === 'back' ? 1.4 : 1);
      // face: a vertical gradient (darker at the foot, a little haze up high)
      ctx.beginPath();
      pathPoly(ctx, sp);
      const g = ctx.createLinearGradient(0, maxy, 0, miny);
      g.addColorStop(0, css(mixc(col, P.void, 0.35)));
      g.addColorStop(1, css(mixc(col, P.haze, 0.25)));
      ctx.fillStyle = g;
      ctx.fill();
      const fog = fogAmt(d);
      // slab gaps
      ctx.save();
      ctx.beginPath();
      for (let i = 1; i < t.slabs.length; i++) {
        const yv = t.slabs[i][0] - 0.4;
        if (yv > h) break;
        const a = fp(0, yv / h), b = fp(1, yv / h);
        if (!a || !b) continue;
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
      }
      const gapPx = Math.max(0.6 * lw, (0.8 * C.f) / Math.max(1, d));
      ctx.lineWidth = gapPx;
      ctx.strokeStyle = css(P.void, 0.75);
      ctx.stroke();
      ctx.restore();
      // chat-feed windows
      const rowPx = ((0.8 * C.f) / Math.max(1, d)) * lod;
      if (F.feed && rowPx > 0.9 && h > 6) {
        const r = L.rng(t.seed + (F.k === 'front' ? 7 : 3));
        const dim = new Path2D(), lit = new Path2D(), out = new Path2D(), dots = new Path2D();
        const blinkK = Math.floor(Tc * 2);
        const quad = (path, u0, u1, v0, v1) => {
          const a = fp(u0, v0), b = fp(u1, v0), c = fp(u1, v1), e = fp(u0, v1);
          if (!a || !b || !c || !e) return;
          path.moveTo(a[0], a[1]);
          path.lineTo(b[0], b[1]);
          path.lineTo(c[0], c[1]);
          path.lineTo(e[0], e[1]);
          path.closePath();
        };
        const W = F.w;
        const riseTop = h;
        let row = 0;
        for (let y = 1.6; y < riseTop - 1.4; y += t.feedPitch, row++) {
          const v0 = y / h, v1 = (y + 0.75) / h;
          const outgoing = r() < 0.32;
          const len = Math.min(W - 3, 2.5 + r() * (W * 0.55));
          const litRow = r() < 0.2;
          const blinker = r() < 0.08 && L.h3(blinkK, row, t.seed) > 0.5;
          const target = outgoing ? out : litRow || blinker ? lit : dim;
          if (outgoing) {
            const u1 = (W - 1) / W, u0 = (W - 1 - len) / W;
            quad(target, u0, u1, v0, v1);
          } else {
            quad(dots, 0.8 / W, 1.5 / W, v0 + 0.05 / h, v1 - 0.05 / h);
            quad(target, 2.1 / W, (2.1 + len) / W, v0, v1);
          }
        }
        const fa = (1 - fog * 0.85) * (0.35 + 0.65 * aw);
        ctx.fillStyle = css(P.ash, 0.2 * fa);
        ctx.fill(dim);
        ctx.fillStyle = css(P.ash, 0.35 * fa);
        ctx.fill(dots);
        ctx.fillStyle = css(mixc(P.bone, P.violetHot, 0.3), 0.42 * fa * aw);
        ctx.fill(lit);
        ctx.fillStyle = css(P.violetMid, 0.32 * fa * aw);
        ctx.fill(out);
      }
      // edges
      ctx.strokeStyle = css(P.steelEdge, 0.8 * (1 - fog * 0.8));
      ctx.lineWidth = Math.max(0.6, Math.min(2, (C.f * 0.05) / Math.max(1, d) + 0.6)) * lw;
      ctx.beginPath();
      pathPoly(ctx, sp);
      ctx.stroke();
    }
    // top
    if (cp[1] > h) {
      const sp = projPoly(C, [[t.x0, h, t.z0], [t.x1, h, t.z0], [t.x1, h, t.z1], [t.x0, h, t.z1]]);
      if (sp) {
        ctx.fillStyle = css(shade(mixc(P.steel, P.void, 0.3), d, cz));
        ctx.beginPath();
        pathPoly(ctx, sp);
        ctx.fill();
        ctx.strokeStyle = css(P.steelEdge, 0.6 * (1 - fogAmt(d)));
        ctx.lineWidth = lw;
        ctx.stroke();
      }
    }
    // neon trim along the street-facing top edge
    if (t.trim && riseF > 0.98 && aw > 0.5) {
      const xe = t.x0 > 0 ? t.x0 : t.x1;
      const s = projSeg(C, [xe, h, t.z0], [xe, h, t.z1]);
      if (s) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.globalCompositeOperation = 'lighter';
        const a = 1 - fogAmt(d) * 0.8;
        ctx.strokeStyle = css(P.violetMid, 0.18 * a);
        ctx.lineWidth = 9 * lw;
        ctx.beginPath();
        ctx.moveTo(s[0][0], s[0][1]);
        ctx.lineTo(s[1][0], s[1][1]);
        ctx.stroke();
        ctx.strokeStyle = css(P.violetMid, 0.9 * a);
        ctx.lineWidth = 2 * lw;
        ctx.stroke();
        ctx.restore();
      }
    }
    // antenna with an online dot
    if (t.antenna && riseF > 0.98) {
      const s = projSeg(C, [cx, h, cz], [cx, h + t.antenna, cz]);
      if (s) {
        ctx.strokeStyle = css(P.steelEdge, 0.8 * (1 - fogAmt(d) * 0.7));
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(s[0][0], s[0][1]);
        ctx.lineTo(s[1][0], s[1][1]);
        ctx.stroke();
        const bl = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(Tc * 2.2 + t.seed));
        const pr = C.project(cx, h + t.antenna, cz);
        if (pr) onlineDot(ctx, pr[0], pr[1], Math.max(1.2 * lw, 0.45 * pr[3]), bl * (1 - fogAmt(d) * 0.6) * aw);
      }
    }
  }

  /** The ONLINE button (art bible 10.6). Returns nothing; draws bezel, face, word, dot and glow. */
  function drawButton(ctx, C, Tc, o) {
    const pressed = Tc >= T_PRESS - 1e-6;
    const lw = o.lw || 1;
    const quiet = Tc < T_BREAK ? 0.3 : 1;
    const inten = pressed ? 1.3 : quiet * (0.74 + 0.26 * kit.beatPulse(Tc, 0.5));
    const bz = BUTTON.bezel;
    // bezel box
    const bez = { x0: bz.x0, x1: bz.x1, z0: bz.z0, z1: bz.z1, h: bz.y1, slabs: [[0, bz.y1]], seed: 77, trim: false, antenna: 0, feedPitch: 99 };
    drawTower(ctx, C, bez, Tc, Object.assign({}, o, { px: 0 }), 1);
    const fz = BUTTON.z - 0.02 + (pressed ? 0.5 : 0);
    // face outline: a stadium on the plane z = fz
    const cyw = (BUTTON.y0 + BUTTON.y1) / 2, hh = (BUTTON.y1 - BUTTON.y0) / 2, hw = (BUTTON.x1 - BUTTON.x0) / 2;
    const pts = [];
    const rr = hh;
    for (let i = 0; i <= 24; i++) {
      const a = -Math.PI / 2 + (Math.PI * i) / 24;
      pts.push([hw - rr + Math.cos(a) * rr, cyw - Math.sin(a) * rr, fz]);
    }
    for (let i = 0; i <= 24; i++) {
      const a = Math.PI / 2 + (Math.PI * i) / 24;
      pts.push([-hw + rr + Math.cos(a) * rr, cyw - Math.sin(a) * rr, fz]);
    }
    const sp = projPoly(C, pts);
    const pc = C.project(0, cyw, fz);
    if (!sp || !pc) return;
    const hwPx = hw * pc[3];
    // outer halo
    glow(ctx, pc[0], pc[1], Math.min(4200, hwPx * 2.3), P.violetMid, 0.5 * inten);
    // recess shadow ring when pressed
    ctx.beginPath();
    pathPoly(ctx, sp);
    const g = ctx.createRadialGradient(pc[0], pc[1] - hwPx * 0.1, 0, pc[0], pc[1], hwPx * 1.05);
    g.addColorStop(0, css(mixc(P.violetHot, P.hot, pressed ? 0.6 : 0.2), Math.min(1, 0.95 * inten)));
    g.addColorStop(0.35, css(P.violetMid, Math.min(1, 0.95 * inten)));
    g.addColorStop(0.8, css(P.violet, 0.95));
    g.addColorStop(1, css(P.violetDeep, 1));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = css(P.violetHot, 0.7);
    ctx.lineWidth = 2 * lw;
    ctx.stroke();
    // the word and the dot: affine basis at the face centre
    const px = C.project(1, cyw, fz), py = C.project(0, cyw - 1, fz);
    if (px && py) {
      ctx.save();
      const exx = (px[0] - pc[0]) / 100, exy = (px[1] - pc[1]) / 100, eyx = (py[0] - pc[0]) / 100, eyy = (py[1] - pc[1]) / 100;
      ctx.transform(exx, exy, eyx, eyy, pc[0], pc[1]);
      const w = textWidth(ctx, 'ONLINE', 420, 800, 20);
      const sc = Math.min(1, 1650 / w);
      ctx.save();
      ctx.translate(140, 0);
      ctx.scale(sc, sc);
      ctx.globalCompositeOperation = 'lighter';
      text(ctx, 'ONLINE', 0, 150, { size: 420, weight: 800, align: 'center', color: P.violetHot, alpha: 0.35 * inten, tracking: 20 });
      ctx.globalCompositeOperation = 'source-over';
      text(ctx, 'ONLINE', 0, 150, { size: 420, weight: 800, align: 'center', color: pressed ? P.hot : P.bone, tracking: 20, alpha: clamp((inten - 0.35) * 2.2) });
      ctx.restore();
      // dot
      ctx.globalAlpha *= clamp((inten - 0.35) * 2.2);
      ctx.fillStyle = P.bone;
      ctx.beginPath();
      ctx.arc(-900, 0, 80, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = css(P.bone, 0.6);
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(-900, 0, 140, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    // top sheen
    glow(ctx, pc[0], pc[1], hwPx * 0.6, P.hot, 0.18 * inten);
  }

  function holoTex() {
    return L.cached('kit-holo-tex', () => {
      const c = FILM.makeCanvas(540, 960);
      const g = c.getContext('2d');
      g.scale(0.5, 0.5);
      profile(g, { T: 18.667, avatarT: 18.667, avatarOpts: { noHolo: true }, count: '999+' });
      return c;
    });
  }
  kit.holoTex = holoTex;

  /** Hologram flicker 0..1 at city time Tc (on from 18.0, steady from 18.667). */
  kit.holoOn = (Tc) => {
    if (Tc < bt(27)) return 0;
    if (Tc >= bt(28)) return 1;
    const k = Math.floor((Tc - bt(27)) * 24 / 2 + 1e-6);
    const pat = [1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0.4, 1, 1, 0.6, 1, 1, 1];
    return pat[Math.min(k, pat.length - 1)] * (0.5 + 0.5 * (Tc - bt(27)) / B);
  };

  function drawHologram(ctx, C, Tc, o) {
    const on = kit.holoOn(Tc);
    if (on <= 0) return;
    const H = HOLO;
    const TL = [H.x - H.w / 2, H.y + H.h / 2, H.z], TR = [H.x + H.w / 2, H.y + H.h / 2, H.z], BL = [H.x - H.w / 2, H.y - H.h / 2, H.z];
    const BR = [H.x + H.w / 2, H.y - H.h / 2, H.z];
    const sp = projPoly(C, [TL, TR, BR, BL]);
    if (!sp) return;
    const pc = C.project(H.x, H.y, H.z);
    // light cone beneath / halo
    if (pc) glow(ctx, pc[0], pc[1], H.h * pc[3] * 0.9, P.violetMid, 0.35 * on);
    ctx.save();
    ctx.beginPath();
    pathPoly(ctx, sp);
    ctx.fillStyle = css(P.violetInk, 0.35 * on);
    ctx.fill();
    ctx.restore();
    planeImage(ctx, C, holoTex(), TL, TR, BL, { composite: 'lighter', alpha: 0.95 * on, strips: 40 });
    // scanlines drifting down the hologram
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = css(P.violetHot, 0.12 * on);
    ctx.lineWidth = (o.lw || 1) * 1.2;
    ctx.beginPath();
    for (let i = 0; i < 26; i++) {
      const v = ((i / 26 + Tc * 0.05) % 1);
      const yv = H.y + H.h / 2 - v * H.h;
      const s = projSeg(C, [H.x - H.w / 2, yv, H.z - 0.05], [H.x + H.w / 2, yv, H.z - 0.05]);
      if (!s) continue;
      ctx.moveTo(s[0][0], s[0][1]);
      ctx.lineTo(s[1][0], s[1][1]);
    }
    ctx.stroke();
    // frame
    ctx.strokeStyle = css(P.violetMid, 0.8 * on);
    ctx.lineWidth = (o.lw || 1) * 2;
    ctx.beginPath();
    pathPoly(ctx, sp);
    ctx.stroke();
    ctx.restore();
  }

  function drawObject(ctx, C, ob, Tc, o, pos) {
    const pr = C.project(pos[0], pos[1], pos[2]);
    if (!pr) return;
    const s = ob.size * pr[3];
    if (s * (o.px || 1) < 1.2) return;
    if (pr[0] < -s * 2 || pr[0] > 1080 + s * 2 || pr[1] < -s * 2 || pr[1] > 1920 + s * 2) return;
    const p = clamp((Tc - ob.arrive) / 0.3);
    const fog = fogAmt(pr[2]);
    const pk = prox(pos[2]);
    const light = clamp((0.5 + 0.5 * pk) * (1 - fog * 0.6));
    const alpha = 1 - fog * 0.75;
    const sc = p < 1 ? E.outBack(p) : 1;
    const yaw = (ob.yaw0 || 0) + ob.spin * Tc;
    const rot = (ob.rot0 || 0) + 0.08 * Math.sin(Tc * 0.5 + ob.seed);
    ctx.save();
    ctx.globalAlpha *= alpha * clamp(p * 3);
    if (pk > 0.2) glow(ctx, pr[0], pr[1], s * 0.9, P.violetMid, 0.25 * pk);
    if (ob.type === 'notif') notif(ctx, pr[0], pr[1], s * sc, { gift: kit.GIFTS[ob.seed % 4], glow: 0.7, seed: ob.seed });
    else gift(ctx, ob.type, pr[0], pr[1], s * sc, rot, ob.type === 'tama' ? 0 : yaw, { light, seed: ob.seed, tilt: ob.type.startsWith('cap') ? 0.2 + 0.3 * Math.sin(yaw * 0.5) : undefined });
    ctx.restore();
    // materialize: glitch slices of violet light across the object's extent
    if (p < 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const rr = L.rng(L.hash('mat', ob.seed, Math.floor(Tc * 24)));
      for (let i = 0; i < 5; i++) {
        const yy = pr[1] + (rr() - 0.5) * s * 0.9;
        const w = s * (0.6 + rr() * 0.9);
        ctx.fillStyle = css(i % 2 ? P.violetHot : P.violetMid, 0.45 * (1 - p) * (1 - p));
        ctx.fillRect(pr[0] - w / 2 + (rr() - 0.5) * s * 0.4, yy, w * 0.8, Math.max(1, s * 0.012));
      }
      ctx.restore();
    }
  }

  /**
   * city(ctx, cam, T, o): draws the whole world from a camera (spec object or kit.cam result) at global time T.
   * o.rise(tower) -> 0..1 height factor (shot 07); o.px device px per frame px (LOD, e.g. inside the avatar);
   * o.lw line-width multiplier (1/scale when drawn scaled down); o.noHolo; o.objects (false to hide gifts);
   * o.extra(ctx, C, Tc) called last, inside the same transform (draw Cartezz there to keep depth order sane);
   * o.skyGlow multiplier; o.lights (false: no searchlights/particles).
   */
  function city(ctx, camSpec, T, o = {}) {
    const C = camSpec.project ? camSpec : cam(camSpec);
    const Tc = kit.cityTime(T);
    const D = cityData();
    sky(ctx, C, Tc, o);
    skylineDraw(ctx, C, D);
    const inten = Tc >= T_PRESS ? 1.3 : Tc < T_BREAK ? 0.3 : 0.74 + 0.26 * kit.beatPulse(Tc, 0.5);
    ground(ctx, C, Tc, o, inten);
    const items = [];
    const cp = C.pos;
    for (const t of D.towers) {
      const rf = o.rise ? clamp(o.rise(t)) : 1;
      if (rf <= 0) continue;
      const cx = (t.x0 + t.x1) / 2, cz = (t.z0 + t.z1) / 2;
      const c = C.toCam(cx, t.h * rf * 0.5, cz);
      const rad = Math.hypot(t.x1 - t.x0, t.z1 - t.z0, t.h * rf) * 0.5;
      if (c[2] < -rad) continue;
      items.push({ d: Math.hypot(cx - cp[0], cz - cp[2]), f: () => drawTower(ctx, C, t, Tc, o, rf) });
    }
    items.push({ d: Math.hypot(cp[0], BUTTON.z + 1.5 - cp[2]), f: () => drawButton(ctx, C, Tc, o) });
    if (!o.noHolo && Tc >= bt(27)) items.push({ d: Math.hypot(cp[0] - HOLO.x, cp[1] - HOLO.y, cp[2] - HOLO.z), f: () => drawHologram(ctx, C, Tc, o) });
    if (o.objects !== false) {
      for (const ob of D.objects) {
        if (Tc < ob.arrive) continue;
        const pos = [ob.x, ob.y + ob.bob * Math.sin(TAU * ob.freq * Tc + ob.ph), ob.z];
        items.push({ d: Math.hypot(pos[0] - cp[0], pos[1] - cp[1], pos[2] - cp[2]), f: () => drawObject(ctx, C, ob, Tc, o, pos) });
      }
      for (const ob of D.orbit) {
        if (Tc < ob.arrive) continue;
        const a = ob.a0 + 0.16 * Tc;
        const pos = [HOLO.x + Math.cos(a) * ob.rad * 1.1, HOLO.y + Math.sin(a) * ob.rad * 0.95, HOLO.z + ob.dz];
        const obx = Object.assign({}, ob, { yaw0: ob.a0, rot0: 0, bob: 0 });
        items.push({ d: Math.hypot(pos[0] - cp[0], pos[1] - cp[1], pos[2] - cp[2]), f: () => drawObject(ctx, C, obx, Tc, o, pos) });
      }
    }
    items.sort((a, b) => b.d - a.d);
    for (const it of items) it.f();
    if (o.lights !== false) {
      searchlights(ctx, C, Tc, D, o);
      particles(ctx, C, Tc, D, o);
    }
    if (o.extra) o.extra(ctx, C, Tc);
    return C;
  }
  kit.city = city;

  function searchlights(ctx, C, Tc, D, o) {
    if (Tc < bt(18)) return;
    const ramp = clamp((Tc - bt(18)) / 0.4);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of D.beams) {
      const az = b.az + 0.45 * Math.sin(Tc * 0.33 + b.k);
      const el = b.el + 0.2 * Math.sin(Tc * 0.21 + b.k * 1.3);
      const dir = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
      const Lb = 420;
      const F = [b.o[0] + dir[0] * Lb, b.o[1] + dir[1] * Lb, b.o[2] + dir[2] * Lb];
      const s = projSeg(C, b.o, F);
      if (!s) continue;
      const [a, e, za, ze] = s;
      const dx = e[0] - a[0], dy = e[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const w0 = Math.max(1.5, (1.2 * C.f) / za), w1 = Math.min(900, Math.max(6, (26 * C.f) / ze));
      const g = ctx.createLinearGradient(a[0], a[1], e[0], e[1]);
      g.addColorStop(0, css(P.violetHot, 0.14 * ramp));
      g.addColorStop(0.5, css(P.violetMid, 0.05 * ramp));
      g.addColorStop(1, css(P.violetMid, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(a[0] + nx * w0, a[1] + ny * w0);
      ctx.lineTo(e[0] + nx * w1, e[1] + ny * w1);
      ctx.lineTo(e[0] - nx * w1, e[1] - ny * w1);
      ctx.lineTo(a[0] - nx * w0, a[1] - ny * w0);
      ctx.closePath();
      ctx.fill();
      const pa = C.project(b.o[0], b.o[1], b.o[2]);
      if (pa) glow(ctx, pa[0], pa[1], Math.max(8, 5 * pa[3]), P.violetHot, 0.6 * ramp);
    }
    ctx.restore();
  }

  function particles(ctx, C, Tc, D, o) {
    if (Tc < T_BREAK) return;
    const age = Tc - T_BREAK;
    const lod = o.px || 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of D.dots) {
      const y = 2 + ((p.y0 + p.v * age) % 100);
      const pr = C.project(p.x, y, p.z);
      if (!pr) continue;
      if (pr[0] < -20 || pr[0] > 1100 || pr[1] < -20 || pr[1] > 1940) continue;
      const r = p.rad * pr[3];
      if (r * lod < 0.35) continue;
      const a = (1 - fogAmt(pr[2]) * 0.8) * clamp((100 - y) / 12) * clamp(age / 0.6) * (0.6 + 0.4 * Math.sin(Tc * 2 + p.ph));
      if (r > 3) onlineDot(ctx, pr[0], pr[1], r, a);
      else {
        ctx.fillStyle = css(P.violetHot, 0.9 * a);
        ctx.beginPath();
        ctx.arc(pr[0], pr[1], Math.max(0.5, r), 0, TAU);
        ctx.fill();
        ctx.fillStyle = css(P.violetMid, 0.18 * a);
        ctx.beginPath();
        ctx.arc(pr[0], pr[1], Math.max(1.5, r * 4), 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ===========================================================================
  // G2: the avatar
  // ===========================================================================

  /**
   * avatar(ctx, cx, cy, r, T, o): the city from CAM_AVATAR at city time T, the frame inscribed in the circle
   * (k = r / 1101.2), clipped to it. o.noHolo, o.figure (default true: Cartezz where the story puts him).
   */
  const HALF_DIAG = Math.hypot(540, 960);
  kit.HALF_DIAG = HALF_DIAG;
  function avatar(ctx, cx, cy, r, T, o = {}) {
    const k = r / HALF_DIAG;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.clip();
    ctx.fillStyle = P.void;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.translate(cx, cy);
    ctx.scale(k, k);
    ctx.translate(-540, -960);
    const S = FILM.S || 1;
    city(ctx, kit.CAM_AVATAR, T, {
      px: k * S * (o.pxBoost || 1),
      lw: 1 / Math.max(k, 0.05) * Math.min(1, 0.6 + k),
      noHolo: o.noHolo,
      extra: o.figure === false ? null : (c, C) => figureAt(c, C, T),
    });
    ctx.restore();
  }
  kit.avatar = avatar;

  /** Where the story has Cartezz at global time T (storyboard G3). Returns { x, z, walk, arm, heading } or null. */
  kit.cartezzAt = (T) => {
    if (T < T_BREAK) return null;
    if (T < bt(23)) return { x: 0, z: 34, walk: null, arm: 0 };
    if (T < bt(24)) return { x: 0, z: 34 + 1.45 * (T - bt(23)), walk: (T - bt(23)) / (2 * B), arm: 0 };
    if (T < bt(28)) return { x: 0, z: 60 + 1.45 * (T - bt(24)), walk: (T - bt(24)) / (2 * B), arm: 0 };
    if (T < bt(34)) return { x: 0, z: 63.9, walk: null, arm: 0, lookUp: 1 };
    if (T < bt(36)) return { x: 0, z: 216.9 + 1.8 * (T - bt(34)), walk: (T - bt(34)) / (2 * B), arm: 0 };
    const arm = E.inOutCubic(clamp((T - bt(38)) / (26.5 - bt(38))));
    return { x: 0, z: 219.3, walk: null, arm: T >= T_PRESS ? 1 : arm };
  };

  function figureAt(ctx, C, T) {
    const s = kit.cartezzAt(T);
    if (!s) return;
    figure(ctx, C, s.x, s.z, { walk: s.walk, arm: s.arm, lookUp: s.lookUp });
  }

  /**
   * figure(ctx, C, x, z, pose): Cartezz standing / walking on the street at world (x, 0, z), seen from camera C,
   * with a contact shadow and rim light from the button. Returns the screen feet point and height, or null.
   */
  function figure(ctx, C, x, z, pose = {}) {
    const f = C.project(x, 0, z), hd = C.project(x, 1.85, z);
    if (!f || !hd) return null;
    const h = Math.hypot(hd[0] - f[0], hd[1] - f[1]);
    if (h < 1.5) {
      if (h > 0.4) {
        ctx.fillStyle = P.coat;
        ctx.fillRect(f[0] - h * 0.12, f[1] - h, h * 0.24, h);
      }
      return { x: f[0], y: f[1], h };
    }
    // contact shadow + the long shadow away from the button
    const sh1 = C.project(x, 0, z - 3.5);
    ctx.save();
    ctx.fillStyle = css(P.void, 0.65);
    ctx.beginPath();
    ctx.ellipse(f[0], f[1], h * 0.2, Math.max(1, h * 0.035), 0, 0, TAU);
    ctx.fill();
    if (sh1) {
      ctx.globalAlpha *= 0.45;
      ctx.beginPath();
      ctx.moveTo(f[0] - h * 0.08, f[1]);
      ctx.lineTo(sh1[0] - h * 0.12, sh1[1]);
      ctx.lineTo(sh1[0] + h * 0.12, sh1[1]);
      ctx.lineTo(f[0] + h * 0.08, f[1]);
      ctx.fill();
    }
    ctx.restore();
    const light = clamp(0.5 + 0.5 * prox(z) + (pose.light || 0));
    cartezz(ctx, f[0], f[1], h, Object.assign({ view: 'back', rim: light }, pose));
    return { x: f[0], y: f[1], h };
  }
  kit.figure = figure;

  // ===========================================================================
  // Cartezz, full figure (art bible 10.1)
  // ===========================================================================

  /**
   * cartezz(ctx, x, y, h, pose): (x, y) = screen point between the feet, h = figure height in px.
   * pose.view 'back' (the film only needs the back view at full length);
   * pose.walk = stride-pair cycles (null = standing), quantised to drawings on twos (16 per cycle);
   * pose.arm 0..1 (right arm reaches out to press); pose.lookUp 0..1; pose.rim 0..1 rim-light strength;
   * pose.light -1..1 side the light favours (0 = straight behind him, the button).
   */
  function cartezz(ctx, x, y, h, pose = {}) {
    if (h < 2) return;
    let ph = 0, walking = pose.walk != null;
    if (walking) {
      ph = pose.walk - Math.floor(pose.walk);
      ph = Math.floor(ph * 16 + 1e-6) / 16;
    }
    const bob = walking ? 0.007 * Math.cos(4 * Math.PI * (ph - 0.25)) : 0;
    const sway = walking ? 0.008 * Math.cos(TAU * (ph - 0.25)) : 0;
    const arm = clamp(pose.arm || 0);
    const up = clamp(pose.lookUp || 0);
    const rimK = pose.rim != null ? pose.rim : 1;
    const side = pose.light || 0;
    const Y = (v) => -v; // y up in figure units

    // --- build parts as Path2D in figure units
    const legs = [];
    const soles = [];
    for (const s of [1, -1]) {
      const off = s > 0 ? 0 : 0.5;
      const psi = walking ? (ph + off) % 1 : 0.25;
      let fy = 0, lift = 0, sole = 0;
      if (walking) {
        if (psi < 0.5) fy = lerp(-0.012, 0.012, psi / 0.5);
        else {
          const u = (psi - 0.5) / 0.5;
          lift = Math.sin(u * Math.PI) * 0.05;
          fy = lerp(0.012, -0.012, u);
          sole = u < 0.6 ? Math.sin((u / 0.6) * Math.PI) : 0;
        }
      }
      const hx = s * 0.05 + sway, hy = 0.47 + bob;
      const fx = s * 0.046 + sway * 0.3, fyU = -fy + lift;
      const kx = (hx + fx) / 2 + s * 0.004, ky = (hy + fyU) / 2 + 0.01;
      const p = new Path2D();
      const wh = 0.042, wk = 0.032, wa = 0.025;
      p.moveTo(hx - wh, Y(hy));
      p.lineTo(kx - wk, Y(ky));
      p.lineTo(fx - wa, Y(fyU + 0.035));
      p.lineTo(fx + wa, Y(fyU + 0.035));
      p.lineTo(kx + wk, Y(ky));
      p.lineTo(hx + wh, Y(hy));
      p.closePath();
      // shoe (heel toward us)
      p.moveTo(fx - 0.029, Y(fyU + 0.036));
      p.lineTo(fx + 0.029, Y(fyU + 0.036));
      p.quadraticCurveTo(fx + 0.031, Y(fyU), fx + 0.02, Y(fyU));
      p.lineTo(fx - 0.02, Y(fyU));
      p.quadraticCurveTo(fx - 0.031, Y(fyU), fx - 0.029, Y(fyU + 0.036));
      p.closePath();
      legs.push(p);
      if (sole > 0.05) soles.push({ x: fx, y: fyU, a: sole });
    }
    // coat
    const hemShift = -0.6 * sway;
    const flare = walking ? 0.01 * Math.abs(Math.sin(TAU * ph)) : 0;
    const hemLift = walking ? 0.008 * Math.sin(TAU * ph) : 0;
    const coat = new Path2D();
    coat.moveTo(-0.05 + sway * 0.3, Y(0.868));
    coat.lineTo(0.05 + sway * 0.3, Y(0.868));
    coat.quadraticCurveTo(0.11, Y(0.845), 0.138, Y(0.81));
    coat.quadraticCurveTo(0.148, Y(0.77), 0.14, Y(0.72));
    coat.lineTo(0.128 + sway * 0.5, Y(0.56));
    coat.lineTo(0.14 + flare + hemShift, Y(0.3 + hemLift));
    coat.quadraticCurveTo(0 + hemShift, Y(0.285), -0.14 - flare + hemShift, Y(0.3 - hemLift));
    coat.lineTo(-0.128 + sway * 0.5, Y(0.56));
    coat.lineTo(-0.14, Y(0.72));
    coat.quadraticCurveTo(-0.148, Y(0.77), -0.138, Y(0.81));
    coat.quadraticCurveTo(-0.11, Y(0.845), -0.05 + sway * 0.3, Y(0.868));
    coat.closePath();
    // arms
    const arms = [];
    const hands = [];
    for (const s of [1, -1]) {
      const swing = walking ? -Math.cos(TAU * ph) * (s > 0 ? 1 : -1) : 0; // +1 forward
      let hx = s * (0.15 - 0.01 * swing) + sway * 0.4;
      let hy = 0.455 + 0.028 * (swing + 1) / 2;
      let ex = s * 0.155, ey = 0.62;
      if (s > 0 && arm > 0) {
        const a = E.inOutSine(arm);
        hx = lerp(hx, 0.235, a);
        hy = lerp(hy, 0.8, a);
        ex = lerp(ex, 0.2, a);
        ey = lerp(ey, 0.71, a);
      }
      const sx = s * 0.126, sy = 0.795;
      const p = new Path2D();
      const w0 = 0.03, w1 = 0.024, w2 = 0.02;
      const n1 = norm2(ex - sx, ey - sy), n2 = norm2(hx - ex, hy - ey);
      p.moveTo(sx + n1[1] * w0, Y(sy - n1[0] * w0));
      p.lineTo(ex + n1[1] * w1, Y(ey - n1[0] * w1));
      p.lineTo(hx + n2[1] * w2, Y(hy - n2[0] * w2));
      p.lineTo(hx - n2[1] * w2, Y(hy + n2[0] * w2));
      p.lineTo(ex - n1[1] * w1, Y(ey + n1[0] * w1));
      p.lineTo(sx - n1[1] * w0, Y(sy + n1[0] * w0));
      p.closePath();
      arms.push(p);
      hands.push({ x: hx, y: hy, open: s > 0 ? arm : 0, dir: n2 });
    }
    // hair (long, over the collar) and the cap
    const hs = -0.4 * sway;
    const hair = new Path2D();
    hair.moveTo(-0.047, Y(0.935));
    hair.quadraticCurveTo(-0.064, Y(0.9), -0.061 + hs, Y(0.84));
    hair.quadraticCurveTo(-0.058 + hs, Y(0.82), -0.05 + hs, Y(0.805));
    hair.quadraticCurveTo(-0.02 + hs, Y(0.8), 0 + hs, Y(0.798));
    hair.quadraticCurveTo(0.02 + hs, Y(0.8), 0.05 + hs, Y(0.805));
    hair.quadraticCurveTo(0.058 + hs, Y(0.82), 0.061 + hs, Y(0.84));
    hair.quadraticCurveTo(0.064, Y(0.9), 0.047, Y(0.935));
    hair.closePath();
    const capTop = 0.998 - 0.01 * up;
    const capP = new Path2D();
    capP.moveTo(-0.056, Y(0.934 - 0.006 * up));
    capP.bezierCurveTo(-0.056, Y(capTop + 0.01), 0.056, Y(capTop + 0.01), 0.056, Y(0.934 - 0.006 * up));
    capP.quadraticCurveTo(0, Y(0.924 - 0.006 * up), -0.056, Y(0.934 - 0.006 * up));
    capP.closePath();

    // --- draw
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(h, h);
    const px1 = 1 / h;
    const rimW = Math.max(1.4 * px1, 0.0065);
    const all = [...legs, coat, ...arms, hair, capP];
    // rim: a soft wide glow, then a crisp line, both stroked before the fills cover their inner halves
    const rg = ctx.createLinearGradient(-0.2, 0, 0.2, 0);
    const lA = clamp(0.75 - side * 0.4), rA = clamp(0.75 + side * 0.4);
    rg.addColorStop(0, css(P.violetMid, lA * rimK));
    rg.addColorStop(0.5, css(P.violetHot, 0.55 * rimK));
    rg.addColorStop(1, css(P.violetMid, rA * rimK));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rg;
    ctx.lineJoin = 'round';
    ctx.globalAlpha *= 0.22;
    ctx.lineWidth = rimW * 5;
    for (const p of all) ctx.stroke(p);
    ctx.restore();
    ctx.strokeStyle = rg;
    ctx.lineJoin = 'round';
    ctx.lineWidth = rimW * 2;
    for (const p of all) ctx.stroke(p);
    const handPath = (hd) => {
      // a hand along the forearm direction: palm, four fingers as one soft mitten, a thumb; opens to press
      const ux = hd.dir[0], uy = -hd.dir[1]; // forearm direction in screen units (y down)
      const vx = -uy, vy = ux; // across the hand
      const w = 0.013 + 0.007 * hd.open, len = 0.05 + 0.006 * hd.open;
      const P0 = [hd.x, Y(hd.y)];
      const at = (a, b) => [P0[0] + ux * a + vx * b, P0[1] + uy * a + vy * b];
      const p = new Path2D();
      const q = [at(0, -w * 0.8), at(len * 0.45, -w), at(len * 0.95, -w * 0.7), at(len, 0), at(len * 0.95, w * 0.7), at(len * 0.5, w),
        at(len * 0.42, w * (1.35 + 0.5 * hd.open)), at(len * 0.25, w * (1.25 + 0.3 * hd.open)), at(0, w * 0.8)];
      spline(p, q, true);
      return p;
    };
    for (const hd of hands) ctx.stroke(handPath(hd));
    // fills
    ctx.fillStyle = P.coat;
    for (const p of legs) ctx.fill(p);
    for (const so of soles) {
      ctx.fillStyle = css(P.coatFold, 0.9 * so.a);
      ctx.beginPath();
      ctx.ellipse(so.x, Y(so.y + 0.012), 0.022, 0.01, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = P.coat;
    ctx.fill(coat);
    // coat details: back vent, hem, a fold on each side
    if (h > 40) {
      ctx.strokeStyle = css(P.coatFold, 0.9);
      ctx.lineWidth = Math.max(px1, 0.003);
      ctx.beginPath();
      ctx.moveTo(hemShift, Y(0.29));
      ctx.lineTo(sway * 0.4, Y(0.44));
      ctx.moveTo(-0.08, Y(0.8));
      ctx.quadraticCurveTo(-0.07, Y(0.6), -0.09 + hemShift, Y(0.31));
      ctx.moveTo(0.08, Y(0.8));
      ctx.quadraticCurveTo(0.07, Y(0.6), 0.09 + hemShift, Y(0.31));
      ctx.moveTo(-0.07, Y(0.63));
      ctx.lineTo(0.07, Y(0.63));
      ctx.stroke();
    }
    ctx.fillStyle = mixcss(P.coat, P.coatFold, 0.35);
    for (const p of arms) ctx.fill(p);
    for (const hd of hands) {
      ctx.fillStyle = css(mixc(P.skinDeep, P.skinShade, hd.open * 0.6));
      ctx.fill(handPath(hd));
    }
    ctx.fillStyle = P.hair;
    ctx.fill(hair);
    if (h > 60) {
      ctx.save();
      ctx.clip(hair);
      ctx.strokeStyle = css(P.hairLit, 0.45);
      ctx.lineWidth = Math.max(px1, 0.0025);
      ctx.beginPath();
      for (let i = -2; i <= 2; i++) {
        ctx.moveTo(i * 0.016, Y(0.93));
        ctx.quadraticCurveTo(i * 0.016 + hs, Y(0.86), i * 0.013 + hs, Y(0.805));
      }
      ctx.stroke();
      ctx.restore();
    }
    // cap: brim sliver when he looks up, crown, back-strap opening, seam, button
    if (up > 0.02) {
      ctx.fillStyle = css(P.violetDeep, up);
      ctx.beginPath();
      ctx.ellipse(0, Y(capTop + 0.004 + 0.012 * up), 0.05, 0.008 + 0.006 * up, 0, 0, TAU);
      ctx.fill();
    }
    const cg = ctx.createLinearGradient(-0.056, Y(capTop), 0.056, Y(0.93));
    cg.addColorStop(0, css(mixc(P.capPurple, P.capPurpleLit, 0.7)));
    cg.addColorStop(0.55, P.capPurple);
    cg.addColorStop(1, css(mixc(P.capPurple, P.violetDeep, 0.7)));
    ctx.fillStyle = cg;
    ctx.fill(capP);
    if (h > 30) {
      ctx.fillStyle = P.hair;
      ctx.beginPath();
      ctx.moveTo(-0.014, Y(0.928 - 0.006 * up));
      ctx.quadraticCurveTo(0, Y(0.952 - 0.006 * up), 0.014, Y(0.928 - 0.006 * up));
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = css(P.violetDeep, 0.9);
      ctx.lineWidth = Math.max(px1, 0.003);
      ctx.beginPath();
      ctx.moveTo(0, Y(capTop + 0.004));
      ctx.lineTo(0, Y(0.952 - 0.006 * up));
      ctx.moveTo(-0.018, Y(0.93 - 0.006 * up));
      ctx.lineTo(0.018, Y(0.93 - 0.006 * up));
      ctx.stroke();
      ctx.fillStyle = P.capPurpleLit;
      ctx.beginPath();
      ctx.ellipse(0, Y(capTop + 0.004), 0.008, 0.004, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  kit.cartezz = cartezz;
  function norm2(x, y) {
    const l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  }
  function mixcss(a, b, t) {
    return css(mixc(a, b, t));
  }

  // ===========================================================================
  // Cartezz, head and shoulders (shots 10 and 15): a noir profile
  // ===========================================================================

  // smooth closed/open curve through points (quadratic midpoint spline)
  function spline(ctx, pts, closed, moveFirst = true) {
    const n = pts.length;
    if (n < 2) return;
    if (!closed) {
      if (moveFirst) ctx.moveTo(pts[0][0], pts[0][1]);
      else ctx.lineTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
      return;
    }
    const m0x = (pts[n - 1][0] + pts[0][0]) / 2, m0y = (pts[n - 1][1] + pts[0][1]) / 2;
    ctx.moveTo(m0x, m0y);
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }
    ctx.closePath();
  }
  kit.spline = spline;

  /**
   * head(ctx, x, y, s, o): Cartezz's head and shoulders in profile. (x, y) = head centre, s = head height px.
   *   o.dir      +1 faces screen right, -1 faces screen left
   *   o.turn     0 = back of the head (facing away from camera) … 1 = full profile (the head turning)
   *   o.pitch    tilt up (radians, + looks up)
   *   o.body     'side' (3/4 side, bow tie peeking) or 'back' (shoulders seen from behind)
   *   o.expr     { brows, eyes, mouth, smile, blink } 0..1
   *   o.gaze     0 = looking where the face points … 1 = eye turned toward the camera
   *   o.light    { front: -1..1 (+1 lit from where he faces, -1 from behind), amt 0..1, color }
   *   o.glint    tiny reflection of his profile in the eye;  o.rim 0..1;  o.wash 0..1;  o.hairLift 0..1
   */
  function head(ctx, x, y, s, o = {}) {
    const dir = o.dir || 1;
    const turn = clamp(o.turn != null ? o.turn : 1);
    const pitch = o.pitch || 0;
    const ex = Object.assign({ brows: 0, eyes: 0, mouth: 0, smile: 0, blink: 0 }, o.expr || {});
    const lt = Object.assign({ front: 1, amt: 0.85, color: P.violetHot }, o.light || {});
    const rimK = o.rim != null ? o.rim : 0.8;
    const gaze = clamp(o.gaze || 0);
    const lift = (o.hairLift || 0) * 0.05;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * dir, s);
    const px1 = 1 / s;
    const fl = lt.front; // + lit from the face side
    const litC = mixc(P.skin, lt.color, 0.22);
    const skinGrad = (x0, x1) => {
      const g = ctx.createLinearGradient(x1, 0, x0, 0);
      const front = fl >= 0 ? mixc(P.skinShade, litC, 0.3 + 0.7 * lt.amt * fl) : mixc(P.skinDeep, P.skinShade, 0.3);
      const back = fl >= 0 ? mixc(P.skinDeep, P.skinShade, 0.45) : mixc(P.skinShade, litC, 0.25 * lt.amt * -fl);
      g.addColorStop(0, css(front));
      g.addColorStop(0.55, css(mixc(front, back, 0.6)));
      g.addColorStop(1, css(back));
      return g;
    };
    const hairGrad = () => {
      const g = ctx.createLinearGradient(-0.5, -0.5, 0.4, 1.2);
      g.addColorStop(0, css(mixc(P.hair, P.hairLit, 0.8 * lt.amt)));
      g.addColorStop(0.45, P.hair);
      g.addColorStop(1, css(mixc(P.hair, P.void, 0.5)));
      return g;
    };

    // ---- body (shoulders sit a little high: a short, strong neck)
    ctx.save();
    ctx.translate(0, -0.1);
    if ((o.body || 'side') === 'back') {
      const nk = new Path2D();
      nk.moveTo(-0.17, 0.4);
      nk.lineTo(-0.2, 0.95);
      nk.lineTo(0.2, 0.95);
      nk.lineTo(0.17, 0.4);
      nk.closePath();
      ctx.fillStyle = css(mixc(P.skinDeep, P.skinShade, 0.25));
      ctx.fill(nk);
      const b = new Path2D();
      b.moveTo(-0.16, 0.82);
      b.quadraticCurveTo(-0.5, 0.92, -0.86, 1.08);
      b.quadraticCurveTo(-1.1, 1.2, -1.14, 1.5);
      b.lineTo(-1.2, 3.2);
      b.lineTo(1.2, 3.2);
      b.lineTo(1.14, 1.5);
      b.quadraticCurveTo(1.1, 1.2, 0.86, 1.08);
      b.quadraticCurveTo(0.5, 0.92, 0.16, 0.82);
      b.closePath();
      rimFill(ctx, b, P.coat, rimK, px1, fl);
      ctx.strokeStyle = css(P.coatFold, 0.9);
      ctx.lineWidth = Math.max(px1, 0.005);
      ctx.beginPath();
      ctx.moveTo(0, 0.9);
      ctx.lineTo(0, 3.2);
      ctx.moveTo(-0.5, 1.02);
      ctx.quadraticCurveTo(-0.46, 1.9, -0.55, 3.2);
      ctx.moveTo(0.5, 1.02);
      ctx.quadraticCurveTo(0.46, 1.9, 0.55, 3.2);
      ctx.stroke();
      // raised collar
      ctx.fillStyle = css(mixc(P.coat, P.coatFold, 0.5));
      ctx.beginPath();
      ctx.moveTo(-0.24, 0.9);
      ctx.quadraticCurveTo(-0.2, 0.66, 0, 0.62);
      ctx.quadraticCurveTo(0.2, 0.66, 0.24, 0.9);
      ctx.closePath();
      ctx.fill();
    } else {
      // neck (front edge under the jaw)
      const nk = new Path2D();
      nk.moveTo(0.19, 0.45);
      nk.quadraticCurveTo(0.2, 0.56, 0.225, 0.62);
      nk.quadraticCurveTo(0.2, 0.7, 0.23, 0.92);
      nk.lineTo(-0.16, 0.95);
      nk.lineTo(-0.1, 0.35);
      nk.closePath();
      ctx.fillStyle = skinGrad(-0.1, 0.2);
      ctx.fill(nk);
      ctx.save();
      ctx.clip(nk);
      const cs = ctx.createLinearGradient(0, 0.45, 0, 0.62);
      cs.addColorStop(0, css(P.skinDeep, 0.85));
      cs.addColorStop(1, css(P.skinDeep, 0));
      ctx.fillStyle = cs;
      ctx.fillRect(-0.2, 0.44, 0.5, 0.2);
      ctx.restore();
      const b = new Path2D();
      b.moveTo(0.22, 0.86);
      b.quadraticCurveTo(0.5, 0.96, 0.58, 1.3);
      b.lineTo(0.62, 3.2);
      b.lineTo(-1.1, 3.2);
      b.lineTo(-1.05, 1.4);
      b.quadraticCurveTo(-0.9, 1.05, -0.4, 0.9);
      b.quadraticCurveTo(-0.2, 0.84, -0.12, 0.8);
      b.closePath();
      rimFill(ctx, b, P.coat, rimK, px1, fl);
      // shirt sliver, lapel and collar, bow tie peeking at the front
      ctx.fillStyle = P.shirt;
      ctx.beginPath();
      ctx.moveTo(0.21, 0.9);
      ctx.quadraticCurveTo(0.4, 1.2, 0.46, 1.8);
      ctx.lineTo(0.3, 1.8);
      ctx.quadraticCurveTo(0.26, 1.2, 0.12, 0.92);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = css(P.coatFold, 1);
      ctx.lineWidth = Math.max(px1 * 1.5, 0.007);
      ctx.beginPath();
      ctx.moveTo(0.12, 0.92);
      ctx.quadraticCurveTo(0.24, 1.3, 0.28, 1.9);
      ctx.moveTo(-0.3, 0.9);
      ctx.quadraticCurveTo(-0.1, 1.2, 0.05, 1.6);
      ctx.stroke();
      ctx.fillStyle = css(mixc(P.coat, P.coatFold, 0.55));
      ctx.beginPath();
      ctx.moveTo(-0.14, 0.9);
      ctx.quadraticCurveTo(-0.16, 0.66, -0.04, 0.6);
      ctx.quadraticCurveTo(0.02, 0.78, 0.1, 0.94);
      ctx.closePath();
      ctx.fill();
      bowtie(ctx, 0.25, 0.94, 0.3, -0.15, { yaw: 1.05, light: 0.35 + 0.6 * lt.amt, seed: 9 });
    }
    ctx.restore();

    // ---- the head group: rotates about the neck pivot when he looks up
    ctx.save();
    ctx.translate(0, 0.42);
    ctx.rotate(-pitch);
    ctx.translate(0, -0.42);
    const dx = -(1 - turn) * 0.46; // the face slides out from behind the hair as the head turns
    // back hair mass
    const hf = lerp(0.36, 0.03, turn); // front edge of the hair over the head
    const hair = new Path2D();
    hair.moveTo(hf * 0.3, -0.52);
    hair.bezierCurveTo(-0.28, -0.55, -0.41, -0.32, -0.415, -0.02);
    hair.bezierCurveTo(-0.42, 0.14, -0.4, 0.28, -0.4 - lift, 0.4);
    hair.lineTo(-0.33, 0.36);
    hair.lineTo(-0.27, 0.46);
    hair.lineTo(-0.2, 0.38);
    hair.lineTo(-0.12, 0.45);
    hair.lineTo(lerp(0.2, -0.04, turn), 0.4);
    hair.bezierCurveTo(lerp(0.3, 0.0, turn), 0.34, lerp(0.34, 0.02, turn), 0.3, hf, 0.2);
    hair.bezierCurveTo(hf + 0.02, 0.0, hf + 0.02, -0.25, hf, -0.34);
    hair.quadraticCurveTo(hf * 0.7, -0.5, hf * 0.3, -0.52);
    hair.closePath();
    // brim behind the crown while he faces away
    if (turn < 0.5) drawBrimP(ctx, turn, pitch, lt, rimK, px1);
    // the face (drawn under the hair so it emerges from behind it)
    if (turn > 0.02) {
      ctx.save();
      ctx.translate(dx, 0);
      const F = faceProfile(ex);
      const face = new Path2D();
      spline(face, F, true);
      rimFill(ctx, face, null, fl < 0 ? rimK : rimK * 0.5, px1, -fl, skinGrad(0, 0.42));
      ctx.save();
      ctx.clip(face);
      profileFeatures(ctx, ex, gaze, lt, o, px1);
      ctx.restore();
      ctx.restore();
    }
    rimFill(ctx, hair, null, rimK, px1, -1, hairGrad());
    strandsP(ctx, hair, lt, px1);
    // a lock of hair in front of the ear, falling over the shoulder
    if (turn > 0.3) {
      const a = clamp((turn - 0.3) / 0.7);
      const lock = new Path2D();
      lock.moveTo(0.08 + dx, -0.3);
      lock.bezierCurveTo(0.13 + dx, -0.1, 0.1 + dx * 0.7, 0.1, 0.09 + dx * 0.6 + lift, 0.3);
      lock.lineTo(0.04 + dx * 0.6, 0.24);
      lock.bezierCurveTo(0.02 + dx * 0.6, 0.1, -0.02 + dx * 0.8, -0.05, -0.02 + dx, -0.3);
      lock.closePath();
      ctx.save();
      ctx.globalAlpha *= a;
      rimFill(ctx, lock, null, rimK * 0.8, px1, -1, hairGrad());
      strandsP(ctx, lock, lt, px1);
      ctx.restore();
    }
    // cap crown, then the brim once it swings toward the face side
    drawCrownP(ctx, turn, lt, rimK, px1);
    if (turn >= 0.5) drawBrimP(ctx, turn, pitch, lt, rimK, px1);
    ctx.restore();
    if (o.wash) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, 0.35, -0.1, 0.8, P.violetMid, 0.2 * o.wash);
      ctx.restore();
    }
    ctx.restore();
  }
  kit.head = head;

  /** The profile outline (facing +x), closed along the hairline at the back. */
  function faceProfile(ex) {
    const op = ex.mouth * 0.028;
    const b = ex.brows * 0.01;
    const sm = ex.smile;
    return [
      [0.04, -0.34],
      [0.27, -0.31],
      [0.31, -0.19],
      [0.34, -0.085 - b],
      [0.348, -0.045],
      [0.328, -0.005],
      [0.37, 0.06],
      [0.42, 0.115],
      [0.445, 0.14],
      [0.43, 0.165],
      [0.38, 0.176],
      [0.362, 0.205 - sm * 0.004],
      [0.372, 0.236 - sm * 0.004],
      [0.375, 0.25],
      [0.36, 0.262 + op * 0.4],
      [0.368, 0.278 + op],
      [0.366, 0.294 + op],
      [0.35, 0.312 + op],
      [0.345, 0.33 + op * 0.8],
      [0.368, 0.375 + op * 0.6],
      [0.366, 0.425 + op * 0.5],
      [0.33, 0.458 + op * 0.3],
      [0.18, 0.462],
      [0.07, 0.43],
      [-0.02, 0.32],
      [-0.03, 0.1],
      [-0.0, -0.2],
    ];
  }

  function profileFeatures(ctx, ex, gaze, lt, o, px1) {
    const soft = (x, y, rx, ry, color, a) => {
      if (a <= 0.01) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(rx, ry);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, css(color, a));
      g.addColorStop(1, css(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, TAU);
      ctx.fill();
      ctx.restore();
    };
    const fl = lt.front;
    // modelling: eye socket, cheekbone, jaw, under the brim
    soft(0.25, 0.02, 0.1, 0.07, P.skinDeep, 0.55);
    soft(0.22, 0.13, 0.12, 0.07, fl > 0 ? mixc(P.skin, P.bone, 0.3) : P.skinDeep, fl > 0 ? 0.25 * lt.amt + 0.2 * ex.smile : 0.3);
    soft(0.15, 0.36, 0.2, 0.1, P.skinDeep, 0.5);
    soft(0.3, -0.26, 0.3, 0.09, P.void, 0.55 * clamp(1 - (o.pitch || 0) * 1.8));
    soft(0.3, -0.03, 0.06, 0.03, P.skinDeep, 0.5);
    // a faint shadow of stubble along the jaw and upper lip
    soft(0.25, 0.36, 0.14, 0.09, P.skinDeep, 0.28);
    soft(0.35, 0.2, 0.04, 0.025, P.skinDeep, 0.2);
    // jaw line, with a defined angle
    ctx.strokeStyle = css(P.skinDeep, 0.5);
    ctx.lineWidth = Math.max(px1 * 1.2, 0.006);
    ctx.beginPath();
    ctx.moveTo(0.3, 0.445);
    ctx.lineTo(0.08, 0.42);
    ctx.lineTo(0.0, 0.28);
    ctx.stroke();
    // eye: a sideways almond, lids meeting at the back corner
    const open = (0.024 + 0.014 * ex.eyes) * (1 - ex.blink);
    const ex0 = 0.225, ex1 = 0.302, ey = 0.02 - 0.004 * ex.eyes;
    const alm = new Path2D();
    alm.moveTo(ex0, ey + 0.004);
    alm.quadraticCurveTo(ex0 + 0.04, ey - open * 1.5, ex1, ey - open * 0.55);
    alm.quadraticCurveTo(ex1 + 0.006, ey + open * 0.25, ex1 - 0.004, ey + open * 0.7);
    alm.quadraticCurveTo(ex0 + 0.04, ey + open * 1.05, ex0, ey + 0.004);
    alm.closePath();
    if (open > 0.004) {
      ctx.fillStyle = css(mixc(P.skinShade, P.bone, fl > 0 ? 0.35 + 0.3 * lt.amt : 0.2));
      ctx.fill(alm);
      ctx.save();
      ctx.clip(alm);
      const ix = lerp(ex1 - 0.014, ex0 + 0.042, gaze), iy = ey;
      const iw = lerp(0.011, 0.024, gaze), ih = 0.026;
      const ig = ctx.createRadialGradient(ix, iy, 0, ix, iy, ih);
      ig.addColorStop(0, css(mixc(P.eye, P.violetDeep, 0.6)));
      ig.addColorStop(0.75, P.eye);
      ig.addColorStop(1, P.void);
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.ellipse(ix, iy, iw, ih, 0, 0, TAU);
      ctx.fill();
      const sg = ctx.createLinearGradient(0, ey - open * 1.5, 0, ey + 0.004);
      sg.addColorStop(0, css(P.skinDeep, 0.7));
      sg.addColorStop(1, css(P.skinDeep, 0));
      ctx.fillStyle = sg;
      ctx.fillRect(ex0, ey - open * 1.6, 0.09, open * 1.6);
      ctx.fillStyle = css(o.glint ? P.violetHot : P.bone, 0.9);
      ctx.fillRect(ix + iw * 0.15, iy - ih * 0.45, Math.max(px1 * 2, iw * 0.45), Math.max(px1 * 2, ih * 0.5));
      if (o.glint) {
        ctx.fillStyle = css(P.bone, 0.9);
        ctx.fillRect(ix + iw * 0.25, iy - ih * 0.35, Math.max(px1, iw * 0.2), Math.max(px1, ih * 0.15));
      }
      ctx.restore();
    }
    // upper lash line with the winged liner, lower smudge
    ctx.strokeStyle = P.eye;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(px1 * 1.6, 0.0065);
    ctx.beginPath();
    ctx.moveTo(ex0, ey + 0.002);
    ctx.quadraticCurveTo(ex0 + 0.04, ey - open * 1.5, ex1 + 0.004, ey - open * 0.55);
    ctx.stroke();
    ctx.lineWidth = Math.max(px1 * 1, 0.004);
    ctx.strokeStyle = css(P.skinDeep, 0.6);
    ctx.beginPath();
    ctx.moveTo(ex0 + 0.005, ey + 0.006);
    ctx.quadraticCurveTo(ex0 + 0.04, ey + open * 1.1, ex1 - 0.006, ey + open * 0.7);
    ctx.stroke();
    // lid crease
    ctx.strokeStyle = css(P.skinDeep, 0.7);
    ctx.lineWidth = Math.max(px1, 0.004);
    ctx.beginPath();
    ctx.moveTo(ex0 + 0.005, ey - open * 0.8);
    ctx.quadraticCurveTo(ex0 + 0.04, ey - open * 2.3 - 0.01 * ex.eyes, ex1 - 0.004, ey - open * 1.3);
    ctx.stroke();
    // brow
    const bl = ex.brows;
    ctx.fillStyle = css(P.hair, 0.95);
    ctx.beginPath();
    ctx.moveTo(0.16, -0.05 - 0.01 * bl);
    ctx.quadraticCurveTo(0.25, -0.078 - 0.03 * bl, 0.336, -0.07 - 0.03 * bl);
    ctx.lineTo(0.334, -0.044 - 0.026 * bl);
    ctx.quadraticCurveTo(0.25, -0.05 - 0.024 * bl, 0.165, -0.03 - 0.008 * bl);
    ctx.closePath();
    ctx.fill();
    // nostril wing
    ctx.strokeStyle = css(P.skinDeep, 0.8);
    ctx.lineWidth = Math.max(px1 * 1.3, 0.007);
    ctx.beginPath();
    ctx.moveTo(0.398, 0.168);
    ctx.quadraticCurveTo(0.352, 0.174, 0.358, 0.14);
    ctx.quadraticCurveTo(0.37, 0.118, 0.398, 0.13);
    ctx.stroke();
    ctx.fillStyle = css(P.skinDeep, 0.8);
    ctx.beginPath();
    ctx.ellipse(0.4, 0.166, 0.015, 0.006, -0.2, 0, TAU);
    ctx.fill();
    // lips: colour along the front, the line back to the corner (lifts with a smile)
    const op = ex.mouth * 0.03, sm = ex.smile;
    const cx = 0.332 - 0.01 * sm, cy = 0.258 - 0.016 * sm + op * 0.3;
    ctx.fillStyle = css(mixc(P.lips, P.skinShade, 0.45), 0.9);
    ctx.beginPath();
    ctx.moveTo(0.362, 0.21);
    ctx.quadraticCurveTo(0.38, 0.24, 0.377, 0.25);
    ctx.lineTo(cx, cy - 0.003);
    ctx.quadraticCurveTo(0.352, 0.232, 0.362, 0.21);
    ctx.closePath();
    ctx.moveTo(0.362, 0.264 + op);
    ctx.quadraticCurveTo(0.372, 0.282 + op, 0.358, 0.298 + op);
    ctx.quadraticCurveTo(0.34, 0.286 + op, cx, cy + 0.005 + op * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = css(P.eye, 0.9);
    ctx.lineWidth = Math.max(px1 * 1.5, 0.006);
    ctx.beginPath();
    ctx.moveTo(0.377, 0.256 + op * 0.4);
    ctx.quadraticCurveTo(0.355, 0.26 + op * 0.4, cx, cy);
    ctx.stroke();
    if (op > 0.004) {
      ctx.fillStyle = css(P.eye, 0.95);
      ctx.beginPath();
      ctx.moveTo(0.375, 0.254 + op * 0.2);
      ctx.quadraticCurveTo(0.362, 0.26 + op, 0.37, 0.266 + op * 0.9);
      ctx.lineTo(cx + 0.01, cy + op * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    if (sm > 0.05) {
      ctx.strokeStyle = css(P.skinDeep, 0.55 * sm);
      ctx.lineWidth = Math.max(px1, 0.005);
      ctx.beginPath();
      ctx.moveTo(cx - 0.012, cy - 0.04);
      ctx.quadraticCurveTo(cx - 0.024, cy, cx - 0.006, cy + 0.028);
      ctx.stroke();
    }
    ctx.fillStyle = css(P.bone, 0.25 * lt.amt * clamp(fl));
    ctx.beginPath();
    ctx.ellipse(0.364, 0.283 + op, 0.007, 0.004, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0.432, 0.13, 0.011, 0.008, 0, 0, TAU);
    ctx.fill();
  }

  function strandsP(ctx, path, lt, px1) {
    ctx.save();
    ctx.clip(path);
    ctx.strokeStyle = css(P.hairLit, 0.3 + 0.4 * lt.amt);
    ctx.lineWidth = Math.max(px1, 0.0035);
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const xx = -0.46 + i * 0.045;
      ctx.moveTo(xx * 0.5, -0.5);
      ctx.bezierCurveTo(xx - 0.02, 0.0, xx - 0.03, 0.7, xx - 0.02, 1.5);
    }
    ctx.stroke();
    ctx.restore();
  }

  function rimFill(ctx, path, fill, rimK, px1, fromFront, fillStyle) {
    // fromFront: +1 rim strongest on the +x side (the face side), -1 on the back side
    if (rimK > 0.01) {
      const g = ctx.createLinearGradient(-0.6, 0, 0.6, 0);
      const a0 = fromFront >= 0 ? 0.2 : 0.95, a1 = fromFront >= 0 ? 0.95 : 0.2;
      g.addColorStop(0, css(P.violetHot, a0 * rimK));
      g.addColorStop(0.5, css(P.violetMid, 0.4 * rimK));
      g.addColorStop(1, css(P.violetHot, a1 * rimK));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = g;
      ctx.globalAlpha *= 0.2;
      ctx.lineWidth = Math.max(px1 * 12, 0.03);
      ctx.stroke(path);
      ctx.restore();
      ctx.strokeStyle = g;
      ctx.lineWidth = Math.max(px1 * 2.5, 0.006);
      ctx.stroke(path);
    }
    ctx.fillStyle = fillStyle || fill;
    ctx.fill(path);
  }

  function drawCrownP(ctx, turn, lt, rimK, px1) {
    const fx = lerp(0.36, 0.31, turn); // front of the crown at the band
    const p = new Path2D();
    p.moveTo(-0.38, -0.27);
    p.bezierCurveTo(-0.4, -0.52, -0.16, -0.62, 0.02, -0.61);
    p.bezierCurveTo(0.22, -0.6, fx + 0.02, -0.46, fx, -0.27);
    p.quadraticCurveTo(0, -0.24, -0.38, -0.27);
    p.closePath();
    const g = ctx.createLinearGradient(-0.3, -0.62, 0.3, -0.25);
    const front = lt.front >= 0;
    g.addColorStop(0, css(front ? mixc(P.capPurple, P.violetDeep, 0.3) : mixc(P.capPurple, P.capPurpleLit, 0.7 * lt.amt)));
    g.addColorStop(0.5, P.capPurple);
    g.addColorStop(1, css(front ? mixc(P.capPurple, P.capPurpleLit, 0.8 * lt.amt) : mixc(P.capPurple, P.violetDeep, 0.5)));
    rimFill(ctx, p, null, rimK, px1, front ? 1 : -1, g);
    ctx.save();
    ctx.clip(p);
    ctx.strokeStyle = css(P.violetDeep, 0.8);
    ctx.lineWidth = Math.max(px1 * 1.3, 0.005);
    ctx.beginPath();
    ctx.moveTo(0.02, -0.6);
    ctx.bezierCurveTo(lerp(-0.1, 0.12, turn), -0.5, lerp(-0.12, 0.2, turn), -0.36, lerp(-0.1, 0.18, turn), -0.26);
    ctx.moveTo(0.02, -0.6);
    ctx.bezierCurveTo(-0.18, -0.52, -0.26, -0.38, -0.25, -0.26);
    ctx.stroke();
    // band + the back-strap opening when we see the back
    ctx.strokeStyle = css(P.violetDeep, 0.9);
    ctx.lineWidth = Math.max(px1 * 1.5, 0.008);
    ctx.beginPath();
    ctx.moveTo(-0.38, -0.3);
    ctx.quadraticCurveTo(0, -0.27, fx, -0.3);
    ctx.stroke();
    if (turn < 0.9) {
      ctx.fillStyle = P.hair;
      const ox = lerp(0.0, -0.36, turn);
      ctx.beginPath();
      ctx.moveTo(ox - 0.07, -0.26);
      ctx.quadraticCurveTo(ox, -0.36, ox + 0.07, -0.26);
      ctx.closePath();
      ctx.fill();
    }
    // logo on the front panel (visible as the head turns toward profile)
    if (turn > 0.6) {
      ctx.save();
      ctx.translate(0.24, -0.39);
      ctx.rotate(0.35);
      ctx.scale(0.1 * clamp((turn - 0.6) / 0.4), 0.12);
      plane(ctx, P.bone, 0.9);
      ctx.restore();
    }
    ctx.restore();
    ctx.fillStyle = P.capPurpleLit;
    ctx.beginPath();
    ctx.ellipse(0.02, -0.612, 0.035, 0.014, 0, 0, TAU);
    ctx.fill();
  }

  function drawBrimP(ctx, turn, pitch, lt, rimK, px1) {
    const tip = lerp(0.08, 0.66, E.inOutSine(turn));
    const base = lerp(0.2, 0.28, turn);
    const under = pitch > 0.05;
    const p = new Path2D();
    p.moveTo(base, -0.3);
    p.quadraticCurveTo((base + tip) / 2, -0.33, tip, -0.25);
    p.quadraticCurveTo(tip + 0.01, -0.235, tip - 0.02, -0.228);
    p.quadraticCurveTo((base + tip) / 2, under ? -0.25 : -0.262, base, -0.262);
    p.closePath();
    rimFill(ctx, p, css(under ? mixc(P.violetDeep, P.capPurple, 0.3) : mixc(P.capPurple, P.capPurpleLit, 0.4 * lt.amt)), rimK, px1, 1);
    ctx.strokeStyle = css(P.capPurpleLit, 0.7);
    ctx.lineWidth = Math.max(px1 * 1.5, 0.007);
    ctx.beginPath();
    ctx.moveTo(base, -0.3);
    ctx.quadraticCurveTo((base + tip) / 2, -0.33, tip, -0.25);
    ctx.stroke();
  }

  Object.freeze(kit);
  Object.defineProperty(FILM, 'kit', { value: kit, writable: false, enumerable: true, configurable: false });
})();
