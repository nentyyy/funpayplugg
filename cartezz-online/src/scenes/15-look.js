(function () {
  'use strict';
  const ID = 'look';
  const FILM = window.FILM;
  const K = FILM.kit;
  const E = FILM.lib.ease;
  const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const t = clamp(tIn, 0, info.dur);
      const T = info.shot.start + t;
      K.city(ctx, { pos: [-0.9, 1.62, 214.6], yaw: 0.1, pitch: 0.05, f: 1100 }, K.T_PRESS, {});
      const turn = E.inOutCubic(clamp(Math.floor((T - 28.333) * 12 + 1e-6) / 6 / 0.9999));
      const gaze = clamp(Math.floor((T - 28.833) * 12 + 1e-6 + 1) / 3);
      K.head(ctx, 540, 820, 500 + 40 * E.inOutSine(t / info.dur), { dir: -1, body: 'back', turn, gaze, expr: {}, light: { front: -1, amt: 0.8 }, rim: 1 });
    },
  });
})();
