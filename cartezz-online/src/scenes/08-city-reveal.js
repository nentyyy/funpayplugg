FILM.scene({
  id: 'city-reveal',
  draw(ctx, tIn, info) {
    const L = info.lib, K = FILM.kit;
    const t = L.clamp(tIn, 0, info.dur);
    const p = L.ease.inOutSine(t / info.dur);
    const cam = K.lerpCam({ pos: [0, 1.1, 18], yaw: 0, pitch: 0.2, f: 1050 }, { pos: [0, 1.1, 20.5], yaw: 0, pitch: 0.2, f: 1050 }, p);
    const T = info.T;
    K.city(ctx, cam, T, {
      extra: (c, C) => K.figure(c, C, 0, 34, { walk: T >= 15.333 ? (T - 15.333) / (2 * K.B) : null }),
    });
  },
});
