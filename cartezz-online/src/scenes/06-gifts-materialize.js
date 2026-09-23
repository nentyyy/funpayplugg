/*
 * 06 gifts-materialize — "The gifts become objects"
 * Global T 9.333 – 10.667 (bar 4, beats 3–4), screen plate, hard cut in from 05. The next shot opens on a white flash.
 *
 * The flood is swept away and the profile's six gift bubbles become solid objects: on consecutive 16ths each
 * bubble's glow disc drains away while its gift snaps together from glitch slices and grows x1 -> x2.4, turning
 * slowly in 3D (kit.gift yaw). From T 10.0 eighteen more gifts (the same four kinds) glitch into existence on 16ths,
 * orbiting the avatar at r 300–420. From T 10.333 everything is pulled into the avatar centre (inCubic) while the
 * camera pushes x1.06 -> 1.25 about (540, 540); the profile smears inward, the centre burns brighter. The last
 * frame is the breaking point.
 *   solidify order (kit.G1.bubbles index): 1 bow tie, 2 purple cap, 3 tama, 0 white cap, 4 bow tie, 5 tama
 *                                          T 9.333, 9.500, 9.667, 9.833, 10.000, 10.167
 *   orbit spawns: T 10.000 (5), 10.167 (5), 10.333 (4), 10.500 (4)
 * Layers, back to front (all under the push):
 *   1. the G1 profile (bubbles drop out as they solidify), rendered once into a scratch layer and composited
 *      with an inward zoom smear during the pull
 *   2. 05's cascade sweeping up and out + its darkness pool lifting (floodLayout copied from 05)
 *   3. orbiting gifts and the six hero gifts (glitch-slice build, glow halo), smallest first
 *   4. the count badge (999+) pulled in with everything
 *   5. the light of the breaking point: ring flare, centre glow, a slight lift of the whole screen
 */
(function () {
  'use strict';
  const ID = 'gifts-materialize';
  const FILM = window.FILM;
  const LIB = FILM.lib;
  const P = LIB.pal;
  const E = LIB.ease;
  const K = FILM.kit;
  const FR = 1 / 24;
  const TAU = Math.PI * 2;
  const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const B = K.B;
  const sd = (...k) => LIB.hash(ID, ...k) & 0x7fffffff;

  const CX = 540, CY = 540; // avatar centre, G1
  const T_SUCK = 1.5 * B; // T 10.333: the pull begins
  const T_ORBIT = B; //      T 10.000: orbit spawns begin
  const LAST = 31 / 24; //   the shot's last frame (T 10.625)

  // ---------------------------------------------------------------------------------------------
  // The flood cascade — copied verbatim from 05 gift-flood (shot-local time of 05).
  // ---------------------------------------------------------------------------------------------
  const FLOOD = 'gift-flood';
  const fsd = (...k) => LIB.hash(FLOOD, ...k) & 0x7fffffff;
  const BURSTS = [1, 2, 3, 4, 5, 6, 8, 10]; // one burst on every 16th, T 8.000 .. 9.167
  const GIFT_CYCLE = ['bowtie', 'capPurple', 'tama', 'capWhite'];
  const PILLS = (() => {
    const out = [{ a: -1, gift: 'capWhite', side: 0, seed: 43 }]; // 04's last notification
    const r = LIB.rng(fsd('pills'));
    BURSTS.forEach((n, bi) => {
      for (let j = 0; j < n; j++) {
        const g = GIFT_CYCLE[(Math.floor(r() * 4) + out.length) % 4];
        out.push({ a: bi * (B / 4), gift: g, side: r() * 2 - 1, seed: fsd('p', out.length) % 997, burst: bi, j, n });
      }
    });
    return out;
  })();
  const shiftU = (t, a) => (t < a - 1e-6 ? 0 : E.outCubic(clamp((t - a) / (4 * FR) + 1 / 4)));
  function floodLayout(t) {
    const out = [];
    const N = PILLS.length;
    const burstU = BURSTS.map((n, bi) => shiftU(t, bi * (B / 4)));
    for (let i = 0; i < N; i++) {
      const p = PILLS[i];
      if (p.a > t + 1e-6) continue;
      let d = 0;
      for (let bi = 0; bi < BURSTS.length; bi++) {
        const a = bi * (B / 4);
        if (a <= p.a + 1e-6) continue;
        d += BURSTS[bi] * burstU[bi];
      }
      if (p.a >= 0) d += (p.n - 1 - p.j) * burstU[p.burst];
      const arrive = p.a < 0 ? 1 : burstU[p.burst];
      const depthK = 1 - Math.exp(-d / 14);
      let x = 540 + p.side * 52 * Math.sqrt(d);
      let y = 300 + 900 * depthK;
      const rot = p.side * 0.034 * Math.sqrt(d);
      const sc = 0.5 + 0.5 * Math.exp(-d / 11);
      const sq = 1 - 0.3 * (1 - Math.exp(-d / 9));
      const bright = Math.exp(-d / 7);
      if (arrive < 1) {
        const ey = -170 - (p.n - 1 - p.j) * 36;
        const ex = x + p.side * 90;
        x = lerp(ex, x, arrive);
        y = lerp(ey, y, arrive);
      }
      out.push({ x, y, rot, sc, sq, bright, d, glow: Math.exp(-d / 2.2), gift: p.gift, seed: p.seed, arrive, a: p.a, side: p.side });
    }
    out.sort((u, v) => v.d - u.d);
    return out;
  }
  const PILL_W = 620, PILL_H = PILL_W * 0.168;
  function drawPill(ctx, q, alphaMul = 1) {
    const a = clamp((40 - q.d) / 12) * alphaMul;
    if (a < 0.015) return;
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.rotate(q.rot);
    ctx.scale(q.sc, q.sc * q.sq);
    ctx.globalAlpha *= a;
    if (q.bright > 0.03) K.notif(ctx, 0, 0, PILL_W, { gift: q.gift, alpha: 1, glow: q.glow > 0.05 ? q.glow * 1.4 : 0, seed: q.seed });
    ctx.beginPath();
    K.rrect(ctx, -PILL_W / 2, -PILL_H / 2, PILL_W, PILL_H, PILL_H / 2);
    if (q.bright <= 0.03) {
      ctx.fillStyle = P.tile;
      ctx.fill();
    } else if (q.bright < 1) {
      ctx.fillStyle = K.css(P.tile, 0.92 * (1 - q.bright));
      ctx.fill();
    }
    if (q.bright < 0.8) {
      ctx.strokeStyle = K.css(P.steelEdge, 0.35 + 0.5 * q.bright);
      ctx.lineWidth = 1.5 / q.sc;
      ctx.stroke();
    }
    ctx.restore();
  }
  function sinkDark(ctx, k) {
    if (k <= 0.01) return;
    ctx.save();
    ctx.translate(540, 960);
    ctx.scale(1, 0.8);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 640);
    g.addColorStop(0, K.css(P.void, 0.97 * k));
    g.addColorStop(0.55, K.css(P.void, 0.92 * k));
    g.addColorStop(0.8, K.css(P.void, 0.45 * k));
    g.addColorStop(1, K.css(P.void, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-640, -640, 1280, 1280);
    ctx.restore();
  }
  const FLOOD_END = 31 / 24; // 05's last frame: every burst settled
  const FLOOD_LAYOUT = floodLayout(FLOOD_END);
  // ---------------------------------------------------------------------------------------------

  // ---- the six hero gifts ---------------------------------------------------------------------
  const ORDER = [1, 2, 3, 0, 4, 5];
  // where each grown gift settles (x2.4 needs room; kept inside x 100–980)
  const GROWN = {
    0: [270, 400], // white cap
    1: [230, 640], // bow tie
    2: [190, 850], // purple cap
    3: [830, 390], // tamagotchi
    4: [880, 610], // bow tie
    5: [820, 830], // tamagotchi
  };
  const HERO = ORDER.map((bi, k) => {
    const b = K.G1.bubbles[bi];
    return { bi, x: b.x, y: b.y, gx: GROWN[bi][0], gy: GROWN[bi][1], type: b.type, ts: k * (B / 4), seed: bi + 1, spin: (sd('spin', bi) % 2 ? 1 : -1) };
  });
  const R_B = K.G1.bubbleR;

  // ---- the orbit ------------------------------------------------------------------------------
  const ORBIT_BURSTS = [5, 5, 4, 4];
  const ORBIT = (() => {
    const r = LIB.rng(sd('orbit'));
    const out = [];
    let n = 0;
    ORBIT_BURSTS.forEach((c, k) => {
      for (let j = 0; j < c; j++) {
        // spread the 18 around the ring (golden-angle order), jittered
        const th = (n * 2.39996 + (r() - 0.5) * 0.35) % TAU;
        out.push({
          ts: T_ORBIT + k * (B / 4),
          th,
          rad: 300 + r() * 120,
          size: 62 + r() * 58,
          type: K.GIFTS[(n + Math.floor(r() * 4)) % 4],
          yaw0: r() * TAU,
          spin: (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.6),
          rot: (r() - 0.5) * 0.4,
          seed: 100 + n,
        });
        n++;
      }
    });
    return out;
  })();
  const OMEGA = -0.55; // orbit angular speed, rad/s (counter-clockwise on screen)

  const glowCol = (type) => (type === 'bowtie' || type === 'capPurple' ? P.glowPink : P.glowSlate);

  /** One gift through kit.gift; the tamagotchi has no yaw in the kit, so its turn is a horizontal squash. */
  function giftYaw(ctx, type, x, y, s, rot, yaw, light) {
    if (s < 1) return;
    if (type === 'tama') {
      const sx = 0.62 + 0.38 * Math.abs(Math.cos(yaw));
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(sx, 1);
      K.gift(ctx, 'tama', 0, 0, s, rot, 0, { light });
      ctx.restore();
    } else {
      K.gift(ctx, type, x, y, s, rot, yaw, { light });
    }
  }

  /**
   * Glitch-slice build: horizontal slices of the drawing offset sideways, snapping into place as u -> 1
   * (six frames). Offsets change on every frame of the build; slices may drop out early.
   */
  function glitch(ctx, u, x, y, s, seed, draw) {
    if (u >= 1) {
      draw();
      return;
    }
    if (u <= 0) return;
    const n = 7;
    const top = y - s * 0.75, h = (s * 1.5) / n;
    const step = Math.floor(u * 6 + 1e-6);
    const amp = s * 0.7 * Math.pow(1 - u, 1.6);
    for (let i = 0; i < n; i++) {
      const r = LIB.rng(LIB.hash(ID, 'gl', seed, i, step));
      const drop = r() < 0.35 * (1 - u);
      if (drop) continue;
      const dx = (r() - 0.5) * 2 * amp;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - s * 1.4 + dx, top + i * h, s * 2.8, h + 0.6);
      ctx.clip();
      ctx.translate(dx, 0);
      ctx.globalAlpha *= clamp(0.35 + u);
      draw();
      ctx.restore();
    }
    // scan hairlines at a few slice seams (UI sparks, bone)
    const r = LIB.rng(LIB.hash(ID, 'seam', seed, step));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const yy = top + Math.floor(r() * n) * h;
      const w = s * (0.6 + r() * 1.2);
      const xx = x + (r() - 0.5) * s;
      ctx.fillStyle = K.css(i === 0 ? P.violetHot : P.bone, 0.5 * (1 - u));
      ctx.fillRect(xx - w / 2, yy - 0.75, w, 1.5);
    }
    ctx.restore();
  }

  // scratch layer for the profile (fully redrawn every frame; nothing carries between frames)
  const LAYERS = {};
  function layer(name, w, h) {
    const c = LAYERS[name];
    if (c && c.width === w && c.height === h) return c;
    return (LAYERS[name] = FILM.makeCanvas(w, h));
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const t = clamp(tIn, 0, info.dur);
      const T = info.shot.start + t;
      const hit = (a, frames, e, lead = 1) =>
        t < a - 1e-6 ? 0 : (e || ((u) => u))(clamp((t - a) / (frames * FR) + lead / frames));
      const since = (a) => (t < a - 1e-6 ? -1 : t - a);
      const S = FILM.S || 1;

      // the pull (inCubic from T 10.333) and the push x1.06 -> 1.25
      // reaches 0.94 on the last frame: every object a tight knot at the centre, the light at its peak
      const suck = 0.94 * E.inCubic(clamp((t - T_SUCK) / (LAST - T_SUCK)));
      const p = t / info.dur;
      const z = 1.06 + 0.19 * (0.3 * E.inOutSine(p) + 0.7 * E.inCubic(p));
      const pull = (x, y, extraRot) => {
        // spiral toward the avatar centre
        const dx = x - CX, dy = y - CY;
        const a = extraRot * suck;
        const k = 1 - suck;
        const ca = Math.cos(a), sa = Math.sin(a);
        return [CX + (dx * ca - dy * sa) * k, CY + (dx * sa + dy * ca) * k];
      };

      // ---- 1. the profile into the scratch layer ------------------------------------------
      const bl = [1, 1, 1, 1, 1, 1];
      for (const h of HERO) if (t >= h.ts - 1e-6) bl[h.bi] = 0;
      const W = Math.round(1080 * S), H = Math.round(1920 * S);
      const lay = layer('full', W, H);
      const lc = lay.getContext('2d');
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.globalAlpha = 1;
      lc.globalCompositeOperation = 'source-over';
      lc.clearRect(0, 0, W, H);
      lc.setTransform(S, 0, 0, S, 0, 0);
      K.profile(lc, { T, bubbles: bl, bg: false });

      ctx.fillStyle = P.void;
      ctx.fillRect(-10, -10, 1100, 1940);
      ctx.save();
      ctx.translate(CX, CY);
      ctx.scale(z, z);
      ctx.translate(-CX, -CY);
      // the profile, smeared inward as the pull takes it
      ctx.drawImage(lay, 0, 0, 1080, 1920);
      if (suck > 0.002) {
        // inward zoom smear, accumulated at half resolution from a quarter-resolution copy, then laid over once
        // (soft like motion blur, and a single full-frame blit)
        const qw = Math.max(2, Math.round(W / 4)), qh = Math.max(2, Math.round(H / 4));
        const quarter = layer('quarter', qw, qh);
        const qc = quarter.getContext('2d');
        qc.setTransform(1, 0, 0, 1, 0, 0);
        qc.globalAlpha = 1;
        qc.clearRect(0, 0, qw, qh);
        qc.drawImage(lay, 0, 0, qw, qh);
        const hw = Math.max(2, Math.round(W / 2)), hh = Math.max(2, Math.round(H / 2));
        const half = layer('half', hw, hh);
        const hc = half.getContext('2d');
        hc.setTransform(1, 0, 0, 1, 0, 0);
        hc.globalAlpha = 1;
        hc.clearRect(0, 0, hw, hh);
        const k = hw / 1080;
        const copies = 7;
        for (let i = 1; i <= copies; i++) {
          const sc = 1 - suck * 0.045 * i;
          hc.globalAlpha = 0.5 * (1 - (i - 1) / copies);
          hc.setTransform(k * sc, 0, 0, k * sc, k * CX * (1 - sc), k * CY * (1 - sc));
          hc.drawImage(quarter, 0, 0, 1080, 1920);
        }
        ctx.save();
        ctx.globalAlpha = 0.7 * suck;
        ctx.drawImage(half, 0, 0, 1080, 1920);
        ctx.restore();
        // the profile dims toward the edges as it drains into the centre
        const vg = ctx.createRadialGradient(CX, CY, 140, CX, CY, 1150);
        vg.addColorStop(0, K.css(P.void, 0));
        vg.addColorStop(1, K.css(P.void, 0.85 * suck));
        ctx.fillStyle = vg;
        ctx.fillRect(-200, -200, 1480, 2320);
      }

      // ---- 2. the flood sweeps up and out ----------------------------------------------------
      const poolK = 1 - E.inOutSine(hit(0, 8, null));
      // 05's light over the header, draining with the flood
      K.glow(ctx, 540, 330, 480, P.violetMid, 0.7 * poolK);
      if (t < 16 * FR) {
        ctx.save();
        ctx.beginPath();
        K.rrect(ctx, 30, 140, 1020, 1640, 72);
        ctx.clip();
        let pooled = false;
        for (const q of FLOOD_LAYOUT) {
          // as in 05: the darkness sits over the deep cards and under the near ones
          if (!pooled && q.d < 9) {
            sinkDark(ctx, poolK);
            pooled = true;
          }
          // near cards leave first, deep ones follow: up and out, fanning
          const u = E.inCubic(clamp((t + FR - q.d * 0.004) / (7 * FR)));
          if (u >= 1) continue;
          const qq = Object.assign({}, q, {
            y: q.y - u * (q.y + 260),
            x: q.x + q.side * u * 220,
            rot: q.rot + q.side * u * 0.25,
          });
          drawPill(ctx, qq, 1 - u * 0.6);
        }
        if (!pooled) sinkDark(ctx, poolK);
        ctx.restore();
      }

      // ---- 3. gifts: orbit + heroes, drawn small to large -----------------------------------
      const items = [];
      for (const o of ORBIT) {
        const s0 = since(o.ts);
        if (s0 < 0) continue;
        const u = hit(o.ts, 6, null);
        const th = o.th + OMEGA * s0;
        const px = CX + Math.cos(th) * o.rad, py = CY + Math.sin(th) * o.rad * 0.96;
        const [x, y] = pull(px, py, 2.2);
        const size = o.size * (0.6 + 0.4 * E.outBack(clamp(u * 1.2))) * (1 - 0.82 * suck);
        items.push({ x, y, size, type: o.type, rot: o.rot, yaw: o.yaw0 + o.spin * s0, u, seed: o.seed, halo: 0.35, sparks: 0 });
      }
      for (const h of HERO) {
        const s0 = since(h.ts);
        if (s0 < 0) continue;
        const u = hit(h.ts, 6, null);
        const grow = E.inOutSine(clamp(s0 / (10 * FR)));
        const scale = 1 + 1.4 * grow;
        // drift outward from the avatar a little as they grow, so the six can breathe
        const ox = lerp(h.x, h.gx, grow), oy = lerp(h.y, h.gy, grow);
        const [x, y] = pull(ox, oy, 1.6);
        const bob = Math.sin(T * 1.3 + h.seed) * R_B * 0.03;
        const yawB = h.type === 'tama' ? 0 : 0.35 * Math.sin(T * 0.6 + h.seed);
        const yaw = yawB + h.spin * 1.1 * Math.pow(s0, 1.25);
        const size = R_B * 1.5 * scale * (1 - 0.8 * suck);
        items.push({ x, y: y + bob * (1 - suck), size, type: h.type, rot: h.type === 'bowtie' ? -0.08 : 0, yaw, u, seed: h.seed, halo: 1, disc: 1 - hit(h.ts, 6, E.inOutSine), hero: h, s0 });
      }
      items.sort((a, b) => a.size - b.size);
      for (const it of items) {
        const col = glowCol(it.type);
        // the bubble's disc draining away (same gradient as kit.giftBubble), then a halo of the object's own light
        if (it.disc > 0) {
          const g = ctx.createRadialGradient(it.hero.x, it.hero.y, 0, it.hero.x, it.hero.y, R_B * 1.15);
          g.addColorStop(0, K.css(col, 0.95 * it.disc));
          g.addColorStop(0.45, K.css(col, 0.55 * it.disc));
          g.addColorStop(0.8, K.css(col, 0.12 * it.disc));
          g.addColorStop(1, K.css(col, 0));
          ctx.fillStyle = g;
          ctx.fillRect(it.hero.x - R_B * 1.2, it.hero.y - R_B * 1.2, R_B * 2.4, R_B * 2.4);
          // its four sparkles fade with it
          const rr = LIB.rng(LIB.hash('bubble-sparkle', it.seed));
          for (let i = 0; i < 4; i++) {
            const a = rr() * TAU, d = R_B * (0.55 + rr() * 0.5);
            const tw = 0.55 + 0.45 * Math.sin(T * 3 + i * 1.7 + it.seed);
            K.sparkle(ctx, it.hero.x + Math.cos(a) * d, it.hero.y + Math.sin(a) * d, R_B * (0.1 + rr() * 0.08), tw * it.disc);
          }
        }
        K.glow(ctx, it.x, it.y, it.size * 1.3, col, (0.35 + 0.4 * it.halo) * clamp(it.u * 1.5) * (1 - 0.5 * suck));
        glitch(ctx, it.u, it.x, it.y, it.size, it.seed, () => giftYaw(ctx, it.type, it.x, it.y, it.size, it.rot, it.yaw, 1));
        // a violet flash as each hero snaps solid
        if (it.hero) {
          const f = Math.exp(-Math.max(0, it.s0 - 5 * FR) / 0.08) * (it.s0 >= 5 * FR - 1e-6 ? 1 : 0);
          if (f > 0.02) K.glow(ctx, it.x, it.y, it.size * 0.9, P.violetHot, 0.5 * f);
        }
      }

      // ---- 4. the count badge, dragged into the centre --------------------------------------
      {
        const [bx, by] = pull(K.G1.badge.x, K.G1.badge.y, 1.2);
        const sc = 1 - 0.85 * suck;
        ctx.save();
        ctx.translate(bx, by);
        ctx.scale(sc, sc);
        K.badge(ctx, 0, 0, '999+', 42, 1 - suck * 0.6);
        ctx.restore();
      }

      // ---- 5. the breaking point ---------------------------------------------------------
      const build = clamp((t - B) / (info.dur - B));
      // the avatar ring flares
      ctx.save();
      ctx.strokeStyle = K.css(P.violetMid, 0.3 * build + 0.6 * suck);
      ctx.lineWidth = 2 + 5 * suck;
      ctx.beginPath();
      ctx.arc(CX, CY, 160 + 6 * build, 0, TAU);
      ctx.stroke();
      ctx.restore();
      K.glow(ctx, CX, CY, 260 + 240 * suck, P.violetMid, 0.15 + 0.9 * suck);
      K.glow(ctx, CX, CY, 70 + 170 * suck, P.violetHot, 0.1 + 1.0 * suck);
      if (suck > 0.3) K.onlineDot(ctx, CX, CY, 6 + 10 * suck, clamp((suck - 0.3) * 2));
      ctx.restore();

      // the screen lifts slightly (neutral, not a purple wash)
      const lift = 0.012 * build + 0.04 * suck;
      if (lift > 0.002) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = K.css(P.bone, lift);
        ctx.fillRect(-10, -10, 1100, 1940);
        ctx.restore();
      }
    },
  });
})();
