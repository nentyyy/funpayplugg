/*
 * 01 profile-boot — "The profile wakes in the dark"
 * Global T 0.000 – 2.667 (bar 1), screen plate, film start (cut from nothing).
 *
 * The phone world assembles on G1 in darkness under a slow approach (scale 0.86 -> 1.0 about (540, 900)).
 * Layers, back to front (all under the approach transform unless noted):
 *   1. void + the G1 profile (FILM.kit.profile) with every part on its storyboard beat:
 *        brackets 0.333 · frame + header 0.667 · avatar ring + content 1.333 · status 1.667 · back/edit 1.833
 *        name typed 2.0 (a letter every 2 frames) · gold badge 2.25 · presence 2.333 · tiles/music/card/tabs 2.333–2.667
 *   2. popped parts redrawn alone under their own outBack scale (status row, presence)
 *   3. the lone online spark at the avatar centre (the first light of the film), gone once the avatar is lit
 *   4. the "classified system" scan line sweeping down once (T 1.333 – 2.0, bone 8%)
 * The last frame (T 2.625) is G1 exactly at scale 1: every part shown, no bubbles, no count badge.
 */
(function () {
  'use strict';
  const ID = 'profile-boot';
  const FILM = window.FILM;
  const LIB = FILM.lib;
  const P = LIB.pal;
  const E = LIB.ease;
  const K = FILM.kit;
  const FR = 1 / 24;
  const TAU = Math.PI * 2;
  const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, u) => a + (b - a) * u;

  // Beats (shot-local = global here: the shot starts at T 0)
  const B = K.B;
  const T_BRACKETS = B / 2; //   T 0.333  8th
  const T_FRAME = B; //          T 0.667  beat 2
  const T_RING = 2 * B; //       T 1.333  beat 3
  const T_STATUS = 2.5 * B; //   T 1.667  8th
  const T_EDIT = 2.75 * B; //    T 1.833  16th (back + edit ride in after the status row)
  const T_NAME = 3 * B; //       T 2.000  beat 4
  const T_BADGE = 3.375 * B; //  T 2.250  (frame 54)
  const T_PRES = 3.5 * B; //     T 2.333  8th
  const F_CASCADE = 56; //       frame of T 2.333: tiles, then music, card, tabs every 2 frames
  const LAST_F = 63; //          the shot's last frame (T 2.625)

  const PARTS = ['brackets', 'frame', 'header', 'status', 'back', 'edit', 'avatar', 'ring', 'name', 'badgeGold', 'presence', 'tiles', 'music', 'username', 'tabs'];
  const NO_BUBBLES = [0, 0, 0, 0, 0, 0];
  function only(key, v) {
    const s = {};
    for (const k of PARTS) s[k] = 0;
    s[key] = v;
    return s;
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const t = clamp(tIn, 0, info.dur);
      const T = info.shot.start + t;
      const f = Math.round(t * 24);

      // timing helpers (lead 1: the event is visible ON its beat frame)
      const hit = (a, frames, e, lead = 1) =>
        t < a - 1e-6 ? 0 : (e || ((u) => u))(clamp((t - a) / (frames * FR) + lead / frames));
      const hitF = (fa, frames, e) => (f < fa ? 0 : (e || ((u) => u))(clamp((f - fa + 1) / frames)));

      // ---- reveal amounts ---------------------------------------------------
      const brk = hit(T_BRACKETS, 6, E.outExpo);
      const frame = hit(T_FRAME, 8, E.outExpo);
      const header = hit(T_FRAME, 12, E.inOutSine);
      const ring = hit(T_RING, 8, E.outExpo);
      const avatarA = hit(T_RING, 12, E.inOutSine);
      const status = hit(T_STATUS, 3);
      const edit = hit(T_EDIT, 4, E.inOutSine);
      const letters = t < T_NAME - 1e-6 ? 0 : Math.min(7, Math.floor((t - T_NAME) / (2 * FR) + 1e-6) + 1);
      const badge = hit(T_BADGE, 3);
      const pres = hit(T_PRES, 3);
      // cascade: 4 parts, 2 frames apart, each fully up by the last frame
      const casc = [0, 1, 2, 3].map((i) => {
        const fa = F_CASCADE + 2 * i;
        return hitF(fa, Math.min(5, LAST_F - fa + 1), E.inOutSine);
      });

      // ---- approach: 0.86 -> 1.0 about (540, 900), exactly 1 on the last frame --
      const pe = clamp(f / LAST_F);
      const s = lerp(0.86, 1, E.inOutSine(pe));

      ctx.fillStyle = P.void;
      ctx.fillRect(0, 0, info.W, info.H);

      ctx.save();
      ctx.translate(540, 900);
      ctx.scale(s, s);
      ctx.translate(-540, -900);

      // 1. the profile: everything but the popped parts
      const popStatus = status > 0 && status < 1;
      const popPres = pres > 0 && pres < 1;
      K.profile(ctx, {
        T,
        bubbles: NO_BUBBLES,
        show: {
          brackets: brk,
          frame,
          header,
          status: popStatus ? 0 : status,
          back: edit,
          edit,
          avatar: avatarA,
          ring,
          name: letters / 7,
          badgeGold: badge,
          presence: popPres ? 0 : pres,
          tiles: casc[0],
          music: casc[1],
          username: casc[2],
          tabs: casc[3],
        },
      });

      // 2. pops (outBack, 3 frames): the part alone, scaled about its own centre
      const pop = (key, v, cx, cy) => {
        const k = 0.72 + 0.28 * E.outBack(v);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(k, k);
        ctx.translate(-cx, -cy);
        K.profile(ctx, { T, bg: false, fade: false, avatar: false, bubbles: NO_BUBBLES, show: only(key, clamp(v * 1.6)) });
        ctx.restore();
      };
      if (popStatus) pop('status', status, 521, 247);
      if (popPres) pop('presence', pres, 451, 895);

      // 3. the first light: one online spark at the avatar centre, breathing on the sub pulse
      const sparkA = 1 - hit(T_RING, 12, E.inOutSine);
      if (sparkA > 0.001) {
        const ph = t % (2 * B); // heartbeat every 2nd beat
        const beat = Math.exp(-ph / 0.16);
        const born = clamp(0.55 + f * 0.15); // lit on frame 0, settles over 3 frames
        K.glow(ctx, 540, 540, 110 + 50 * beat, P.violetMid, (0.45 + 0.4 * beat) * sparkA * born);
        K.glow(ctx, 540, 540, 26 + 8 * beat, P.violetHot, (0.5 + 0.3 * beat) * sparkA * born);
        K.onlineDot(ctx, 540, 540, 4 * (1 + 0.18 * beat), sparkA * born);
      }

      // 4. the scan line: one sweep down the screen, T 1.333 – 2.0
      const sw = (t - T_RING) / (T_NAME - T_RING);
      if (sw >= 0 && sw <= 1) {
        const y = lerp(150, 1640, E.inOutSine(sw));
        const env = Math.sin(Math.PI * sw);
        ctx.save();
        ctx.beginPath();
        K.rrect(ctx, 30, 140, 1020, 1640, 72);
        ctx.clip();
        const g = ctx.createLinearGradient(0, y - 140, 0, y);
        g.addColorStop(0, K.css(P.bone, 0));
        g.addColorStop(1, K.css(P.bone, 0.04 * env));
        ctx.fillStyle = g;
        ctx.fillRect(30, y - 140, 1020, 140);
        ctx.fillStyle = K.css(P.bone, 0.08);
        ctx.fillRect(30, y - 1, 1020, 2);
        ctx.fillStyle = K.css(P.bone, 0.12 * env);
        ctx.fillRect(30, y - 0.5, 1020, 1);
        ctx.restore();
      }

      ctx.restore();
    },
  });
})();
