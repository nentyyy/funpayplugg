// music.js : the score and sound design of the film.
// Owner: music. Contract: docs/CONTRACT.md, section Audio.
//
// FILM.audio.render(ctx, { start = 0, dest = ctx.destination }) schedules the whole piece,
// music and effects, from global time `start` into any BaseAudioContext.
// Every sound is synthesised here: oscillators, periodic waves, seeded noise, filters, envelopes,
// a ping-pong delay, convolver reverbs on generated impulse responses, a glue compressor and a
// soft limiter. Randomness comes only from FILM.lib.rng, seeded per event, so any start time
// schedules the same notes at the same global times.
//
// The engine, instruments, effects and master chain below are film-agnostic. Per film the music
// agent replaces three things: the CH chord table, the MIX.ride section automation, and the whole
// score() function — composing against FILM.TIMELINE.bpm and FILM.TIMELINE.cues so hits land on
// the cuts. What ships here is a demo score that gives the stub pass a pulse; see the skill's
// reference/music.md before composing.
(function () {
  'use strict';
  const FILM = window.FILM;
  const lib = FILM.lib;
  const TAU = Math.PI * 2;
  const FLOOR = 1e-5;

  // DynamicsCompressorNode delays its output by a fixed 6 ms look-ahead (measured: 288 samples at
  // 48 kHz). Every event before the compressor is scheduled that much early, so it leaves the master
  // exactly on its cue. Only an event inside the first 6 ms of a render window can land late.
  const LAT = 0.006;

  // Mix constants, tuned by measurement (tools/audio): loudness, peaks, per-bar profile.
  const MIX = {
    trim: 1.05,
    ceiling: 0.66, // soft limiter output ceiling (about -3.6 dBFS)
    knee: 0.5,
    bus: { drums: 0.6, perc: 0.8, bass: 0.3, pad: 0.26, keys: 0.6, bells: 0.45, lead: 0.5, sfx: 0.62, amb: 0.5 },
    // Master tilt EQ in dB: a low shelf under the subs, presence and air for phone speakers.
    eq: { low: -4, presence: 5, air: 3 },
    comp: { threshold: -18, knee: 10, ratio: 2, attack: 0.006, release: 0.2 },
    // Section fader rides in dB at global times, pre-compressor: a hushed profile, the dings a little
    // up, full at the break and at the profile-sky peak, down right after the press so every tail
    // falls away, and the final ding at exactly the level of the first one (5.333 and 33.333).
    ride: [
      [0, -8], [5.25, -8], [5.333, -5], [7.9, -5], [8.0, -3.5], [10.55, -3], [10.667, -1],
      [13.2, -0.5], [13.333, -1], [18.55, -1], [18.667, -2], [21.25, -2.5], [21.333, -1.5],
      [26.6, -1.5], [26.667, 0], [26.75, 0], [27.3, -8], [29.25, -8], [29.333, -4], [31.9, -4], [32.0, -14], [33.2, -14], [33.3, -5], [34.7, -5],
    ],
  };

  // ---------------------------------------------------------------- pitch
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function hz(n) {
    if (typeof n === 'number') return n;
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(n);
    const midi = 12 * (Number(m[3]) + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // ---------------------------------------------------------------- envelopes
  // pts: [[dt, value, shape]] with dt from the note start; shape is the ramp INTO that point:
  // 'lin' (default), 'exp' or 'set'. The first point must sit at dt 0.
  // When the voice started before the render window (skip > 0) the value at `skip` is computed
  // and automation resumes from there, so a seek hears the same envelope.
  function setEnv(param, pts, c0, skip) {
    let i;
    let prev;
    if (skip > 0) {
      let v = pts[0][1];
      for (i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        if (skip < b[0]) {
          const f = (skip - a[0]) / Math.max(1e-9, b[0] - a[0]);
          const sh = b[2] || 'lin';
          if (sh === 'set') v = a[1];
          else if (sh === 'exp' && a[1] > 0) v = a[1] * Math.pow(Math.max(b[1], FLOOR) / a[1], f);
          else v = a[1] + (b[1] - a[1]) * f;
          break;
        }
        v = b[1];
      }
      param.setValueAtTime(v, c0 + skip);
      prev = v;
    } else {
      param.setValueAtTime(pts[0][1], c0);
      prev = pts[0][1];
      i = 1;
    }
    for (; i < pts.length; i++) {
      const v = pts[i][1];
      const sh = pts[i][2] || 'lin';
      const w = c0 + pts[i][0];
      if (sh === 'set') {
        param.setValueAtTime(v, w);
        prev = v;
      } else if (sh === 'exp' && prev > 0) {
        param.exponentialRampToValueAtTime(Math.max(v, FLOOR), w);
        prev = Math.max(v, FLOOR);
      } else {
        param.linearRampToValueAtTime(v, w);
        prev = v;
      }
    }
  }

  // Percussive amplitude envelope: attack then exponential decay to silence.
  const perc = (vel, att, dec) => [[0, 0], [att, vel], [att + dec, FLOOR, 'exp']];

  // ---------------------------------------------------------------- generated buffers
  function noiseBuffer(ctx, secs, channels, seed) {
    const n = Math.floor(secs * ctx.sampleRate);
    const buf = ctx.createBuffer(channels, n, ctx.sampleRate);
    for (let ch = 0; ch < channels; ch++) {
      const r = lib.rng(lib.hash('film-noise', seed, ch));
      const d = buf.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
    }
    return buf;
  }

  // Impulse response: seeded stereo noise, exponential decay to -60 dB at `secs`, a two-pole
  // lowpass that darkens over the tail, a pre-delay and a few early reflections.
  function impulse(ctx, secs, seed, o) {
    const sr = ctx.sampleRate;
    const n = Math.floor(secs * sr);
    const buf = ctx.createBuffer(2, n, sr);
    const pre = Math.floor(o.pre * sr);
    const tail = secs - o.pre;
    for (let ch = 0; ch < 2; ch++) {
      const r = lib.rng(lib.hash('film-ir', seed, ch));
      const d = buf.getChannelData(ch);
      let l1 = 0;
      let l2 = 0;
      for (let i = pre; i < n; i++) {
        const t = (i - pre) / sr;
        const u = t / tail;
        const env = Math.exp(-6.9 * u) * (t < 0.005 ? t / 0.005 : 1);
        const a = o.bright + (o.dark - o.bright) * Math.sqrt(u);
        l1 += a * (r() * 2 - 1 - l1);
        l2 += a * (l1 - l2);
        d[i] = l2 * env;
      }
      for (let k = 0; k < o.early; k++) {
        const i = pre + Math.floor((0.003 + r() * o.spread) * sr);
        if (i < n) d[i] += (r() * 2 - 1) * 0.35 * (1 - k / o.early);
      }
    }
    return buf;
  }

  // Grains rendered straight into a stereo buffer: band-passed noise flaps and clicks, or short sines.
  // g: { t, dur, amp, pan (-1..1), f, q, att, dec, sine }
  function grainBuffer(ctx, key, secs, grains) {
    const sr = ctx.sampleRate;
    const n = Math.max(1, Math.ceil(secs * sr));
    const buf = ctx.createBuffer(2, n, sr);
    const L = buf.getChannelData(0);
    const R = buf.getChannelData(1);
    const r = lib.rng(lib.hash('film-grain', key));
    for (const g of grains) {
      const i0 = Math.floor(g.t * sr);
      const m = Math.floor(g.dur * sr);
      const gl = Math.cos(((g.pan + 1) * Math.PI) / 4);
      const gr = Math.sin(((g.pan + 1) * Math.PI) / 4);
      const att = g.att || 0.002;
      const dec = g.dec || g.dur * 0.3;
      const w = (TAU * g.f) / sr;
      const al = Math.sin(w) / (2 * (g.q || 1));
      const cw = Math.cos(w);
      const a0 = 1 + al;
      let x1 = 0;
      let x2 = 0;
      let y1 = 0;
      let y2 = 0;
      const ph = r() * TAU;
      for (let k = 0; k < m; k++) {
        const j = i0 + k;
        if (j >= n) break;
        const tt = k / sr;
        let s;
        if (g.sine) s = Math.sin(ph + w * k);
        else {
          const x = r() * 2 - 1;
          s = (al * x - al * x2 + 2 * cw * y1 - (1 - al) * y2) / a0;
          x2 = x1;
          x1 = x;
          y2 = y1;
          y1 = s;
        }
        const env = tt < att ? tt / att : Math.exp(-(tt - att) / dec);
        const tailFade = k > m - 64 ? (m - k) / 64 : 1;
        const v = s * env * tailFade * g.amp;
        if (j >= 0) {
          L[j] += v * gl;
          R[j] += v * gr;
        }
      }
    }
    return buf;
  }

  // Stick-slip creak: irregular pulses, each ringing three damped wooden resonances.
  function creakBuffer(ctx, key, secs, rate0, rate1, formants) {
    const sr = ctx.sampleRate;
    const n = Math.ceil(secs * sr);
    const buf = ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    const r = lib.rng(lib.hash('film-creak', key));
    let t = 0.004;
    while (t < secs - 0.01) {
      const u = t / secs;
      const swell = Math.sin(Math.PI * Math.min(1, u * 1.15)) * (0.55 + 0.45 * r());
      const i0 = Math.floor(t * sr);
      for (const [f, tau, a] of formants) {
        const m = Math.min(n - i0, Math.floor(tau * 5 * sr));
        const fj = f * (0.94 + 0.12 * r());
        for (let k = 0; k < m; k++) d[i0 + k] += swell * a * Math.exp(-k / sr / tau) * Math.sin((TAU * fj * k) / sr);
      }
      const rate = rate0 + (rate1 - rate0) * u;
      t += (1 / rate) * (0.7 + 0.6 * r());
    }
    for (let k = 0; k < 96 && k < n; k++) d[n - 1 - k] *= k / 96;
    return buf;
  }

  // Soft limiter transfer curve. The shaper is fed at half level, so the curve covers inputs up to
  // +6 dBFS: linear to the knee, then a tanh shoulder that never passes the ceiling.
  function limiterCurve(ceiling, knee) {
    const n = 16385;
    const c = new Float32Array(n);
    const room = ceiling - knee;
    for (let i = 0; i < n; i++) {
      const x = ((i / (n - 1)) * 2 - 1) * 2;
      const a = Math.abs(x);
      const y = a <= knee ? a : knee + room * Math.tanh((a - knee) / room);
      c[i] = x < 0 ? -y : y;
    }
    return c;
  }

  function periodic(ctx, n, amp) {
    const real = new Float32Array(n + 1);
    const imag = new Float32Array(n + 1);
    for (let k = 1; k <= n; k++) imag[k] = amp(k);
    return ctx.createPeriodicWave(real, imag);
  }

  // ---------------------------------------------------------------- engine
  function makeEngine(ctx, start, dest, DUR, MIX) {
    const base = ctx.currentTime;
    const E = { ctx, sr: ctx.sampleRate, start, base, DUR, duckTargets: [] };

    // A voice is a note or effect that starts at global time t0 and lasts len seconds (release included).
    // A sustained voice whose compensated start falls before the window resumes mid-envelope on time.
    // A short voice that starts inside the first 6 ms plays whole, up to 6 ms late; one that began
    // earlier is skipped.
    E.w0 = -Infinity;
    E.w1 = Infinity;
    E.voice = function (t0, len, sustain) {
      if (t0 < E.w0 || t0 >= E.w1) return null; // belongs to another scheduling window
      if (t0 >= DUR || t0 + len <= start) return null;
      const c = base + (t0 - start) - LAT;
      let c0 = c;
      let skip = 0;
      if (c < base) {
        if (sustain) skip = base - c;
        else if (t0 >= start) c0 = base;
        else return null;
      }
      return {
        c0,
        skip,
        len,
        env: (param, pts) => setEnv(param, pts, c0, skip),
        osc(node, stopDt) {
          node.start(c0 + skip);
          node.stop(c0 + Math.max(stopDt === undefined ? len : stopDt, skip + 0.002));
          return node;
        },
        buf(node, offset, stopDt) {
          const d = node.buffer.duration;
          let off = (offset || 0) + skip;
          if (node.loop) off %= d;
          else if (off >= d) return node;
          node.start(c0 + skip, off);
          node.stop(c0 + Math.max(stopDt === undefined ? len : stopDt, skip + 0.002));
          return node;
        },
      };
    };

    E.gain = (v) => {
      const g = ctx.createGain();
      g.gain.value = v === undefined ? 1 : v;
      return g;
    };
    E.osc = (type, f) => {
      const o = ctx.createOscillator();
      if (typeof type === 'string') o.type = type;
      else o.setPeriodicWave(type);
      o.frequency.value = f;
      return o;
    };
    E.filt = (type, f, q) => {
      const b = ctx.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      b.Q.value = q === undefined ? 0.707 : q;
      return b;
    };
    E.panner = (p) => {
      const s = ctx.createStereoPanner();
      s.pan.value = p;
      return s;
    };
    E.rng = (...k) => lib.rng(lib.hash('film-score', ...k));

    // ---- master: highpass, glue compressor, trim, soft limiter, output fades
    const master = E.gain(1);
    const hp = E.filt('highpass', 26, 0.6);
    const lowShelf = E.filt('lowshelf', 140, 0.7);
    lowShelf.gain.value = MIX.eq.low;
    const presence = E.filt('peaking', 3000, 0.7);
    presence.gain.value = MIX.eq.presence;
    const air = E.filt('highshelf', 8000, 0.7);
    air.gain.value = MIX.eq.air;
    const comp = ctx.createDynamicsCompressor();
    for (const k in MIX.comp) comp[k].value = MIX.comp[k];
    const trim = E.gain(MIX.trim * 0.5);
    const lim = ctx.createWaveShaper();
    lim.curve = limiterCurve(MIX.ceiling, MIX.knee);
    lim.oversample = 'none';
    const out = E.gain(1);
    master.connect(hp);
    hp.connect(lowShelf);
    lowShelf.connect(presence);
    presence.connect(air);
    air.connect(comp);
    comp.connect(trim);
    trim.connect(lim);
    lim.connect(out);
    out.connect(dest);
    E.master = master;
    // Output fades sit after the compressor, so they use uncompensated times. The compressor's
    // first 6 ms are silent; the output then opens over 3 ms, and the last 10 ms taper to zero, so the
    // loop seam and every seek start without a click.
    out.gain.setValueAtTime(0, base);
    out.gain.setValueAtTime(0, base + LAT);
    out.gain.linearRampToValueAtTime(1, base + LAT + 0.003);
    const cEnd = base + (DUR - start);
    if (DUR - start > 0.05) {
      out.gain.setValueAtTime(1, cEnd - 0.01);
      out.gain.linearRampToValueAtTime(0, cEnd);
    }
    // Section rides on the master input, compensated like every other pre-compressor event.
    setEnv(master.gain, MIX.ride.map(([t, d], i) => [t, Math.pow(10, d / 20), i ? 'lin' : undefined]), base - start - LAT, start + LAT);

    // ---- shared buffers
    E.white = noiseBuffer(ctx, 2.5, 1, 'white');
    E.wide = noiseBuffer(ctx, 5, 2, 'wide');
    E.warmSaw = periodic(ctx, 48, (k) => Math.pow(k, -1.35) * (k > 24 ? Math.exp(-(k - 24) / 10) : 1));
    E.softSquare = periodic(ctx, 31, (k) => (k % 2 ? Math.pow(k, -1.5) : 0.04 / k));
    E.brassSaw = periodic(ctx, 40, (k) => Math.pow(k, -1.05));

    // ---- effects returns
    E.fx = {};
    const verb = (name, secs, o, ret) => {
      const c = ctx.createConvolver();
      c.buffer = impulse(ctx, secs, name, o);
      const g = E.gain(ret);
      c.connect(g);
      g.connect(master);
      E.fx[name] = c;
    };
    verb('room', 0.9, { pre: 0.006, bright: 0.55, dark: 0.18, early: 10, spread: 0.035 }, 0.9);
    verb('hall', 2.8, { pre: 0.018, bright: 0.45, dark: 0.09, early: 14, spread: 0.07 }, 0.9);
    verb('cave', 6.0, { pre: 0.03, bright: 0.35, dark: 0.05, early: 18, spread: 0.12 }, 0.85);

    // Ping-pong delay, a dotted 8th (0.375 s) each side.
    const dIn = E.gain(1);
    dIn.channelCount = 1;
    dIn.channelCountMode = 'explicit';
    const dL = ctx.createDelay(1);
    const dR = ctx.createDelay(1);
    dL.delayTime.value = 0.375;
    dR.delayTime.value = 0.375;
    const fL = E.filt('lowpass', 4200, 0.5);
    const fR = E.filt('lowpass', 3400, 0.5);
    const gL = E.gain(0.4);
    const gR = E.gain(0.4);
    dIn.connect(dL);
    dL.connect(fL);
    fL.connect(gL);
    gL.connect(dR);
    dR.connect(fR);
    fR.connect(gR);
    gR.connect(dL);
    const mrg = ctx.createChannelMerger(2);
    fL.connect(mrg, 0, 0);
    fR.connect(mrg, 0, 1);
    const dRet = E.gain(0.75);
    mrg.connect(dRet);
    dRet.connect(master);
    const dVerb = E.gain(0.25);
    dRet.connect(dVerb);
    dVerb.connect(E.fx.hall);
    E.fx.delay = dIn;

    // ---- buses
    E.bus = {};
    // Per-voice sends pass through a tap scaled by the bus gain, so a bus fader moves its reverb too.
    E.tap = {};
    const taps = (name) => {
      E.tap[name] = {};
      for (const k of ['room', 'hall', 'cave', 'delay']) {
        const g = E.gain(MIX.bus[name]);
        g.connect(E.fx[k]);
        E.tap[name][k] = g;
      }
    };
    const bus = (name, sends, duck, hpf) => {
      taps(name);
      const b = E.gain(MIX.bus[name]);
      let tail = b;
      if (hpf) {
        const h = E.filt('highpass', hpf, 0.6);
        tail.connect(h);
        tail = h;
      }
      if (duck) {
        const d = E.gain(1);
        b.connect(d);
        tail = d;
        E.duckTargets.push(d.gain);
      }
      tail.connect(master);
      for (const k in sends) {
        const s = E.gain(sends[k]);
        tail.connect(s);
        s.connect(E.fx[k]);
      }
      E.bus[name] = b;
    };
    // Drum bus: a gentle saturator adds harmonics so the kick reads on phone speakers.
    {
      const b = E.gain(MIX.bus.drums);
      const drive = E.gain(1.6);
      const sat = ctx.createWaveShaper();
      const curve = new Float32Array(2049);
      for (let i = 0; i < curve.length; i++) {
        const x = (i / (curve.length - 1)) * 2 - 1;
        curve[i] = Math.tanh(x * 1.4) / Math.tanh(1.4);
      }
      sat.curve = curve;
      const back = E.gain(0.72);
      b.connect(drive);
      drive.connect(sat);
      sat.connect(back);
      back.connect(master);
      const rs = E.gain(0.1);
      back.connect(rs);
      rs.connect(E.fx.room);
      E.bus.drums = b;
      taps('drums');
    }
    bus('perc', { room: 0.1 });
    bus('bass', {}, true);
    bus('pad', { hall: 0.22 }, true, 180);
    bus('keys', { room: 0.12, hall: 0.14, delay: 0.06 });
    bus('bells', { hall: 0.3, cave: 0.06, delay: 0.14 });
    bus('lead', { hall: 0.22, delay: 0.18 });
    bus('sfx', { room: 0.14 });
    bus('amb', { hall: 0.12 });

    // Route a voice's last node to a bus, with an optional pan and extra sends.
    E.out = (node, busName, o) => {
      o = o || {};
      let n = node;
      if (o.pan) {
        const p = E.panner(o.pan);
        n.connect(p);
        n = p;
      }
      n.connect(E.bus[busName]);
      for (const k of ['room', 'hall', 'cave', 'delay']) {
        if (o[k]) {
          const s = E.gain(o[k]);
          n.connect(s);
          s.connect(E.tap[busName][k]);
        }
      }
      return n;
    };

    // Looping noise source with a per-event deterministic read offset.
    E.noise = (V, key, stereo) => {
      const s = ctx.createBufferSource();
      s.buffer = stereo ? E.wide : E.white;
      s.loop = true;
      const off = ((lib.hash('film-nz', key) % 100003) / 100003) * s.buffer.duration;
      return V.buf(s, off);
    };

    // Sidechain-style pump: a decaying negative curve added to the pad and bass bus gains on a kick.
    const duckLen = 0.32;
    E.duckBuf = ctx.createBuffer(1, Math.floor(duckLen * E.sr), E.sr);
    {
      const d = E.duckBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        const t = i / E.sr;
        d[i] = -(t < 0.006 ? t / 0.006 : Math.exp(-(t - 0.006) / 0.085)) * (i > d.length - 48 ? (d.length - i) / 48 : 1);
      }
    }
    E.duck = (t, depth) => {
      const V = E.voice(t, duckLen, false);
      if (!V) return;
      const s = ctx.createBufferSource();
      s.buffer = E.duckBuf;
      for (const p of E.duckTargets) {
        const g = E.gain(depth);
        s.connect(g);
        g.connect(p);
      }
      V.buf(s, 0);
    };
    return E;
  }

  // ---------------------------------------------------------------- instruments
  function instruments(E) {
    const ctx = E.ctx;
    const I = {};

    // Felt, full, heartbeat or thud kick: a pitch-dropping sine with a short filtered click.
    I.kick = (t, vel, kind) => {
      const P = {
        felt: { f0: 125, f1: 50, fd: 0.055, dec: 0.36, click: 0.18, cf: 1600 },
        full: { f0: 165, f1: 47, fd: 0.065, dec: 0.5, click: 0.3, cf: 4200 },
        heart: { f0: 96, f1: 46, fd: 0.05, dec: 0.3, click: 0.16, cf: 1500 },
        thud: { f0: 95, f1: 52, fd: 0.04, dec: 0.2, click: 0.12, cf: 1200 },
      }[kind || 'felt'];
      const V = E.voice(t, P.dec + 0.03, false);
      if (!V) return;
      const o = E.osc('sine', P.f0);
      V.env(o.frequency, [[0, P.f0], [P.fd, P.f1, 'exp'], [P.dec, P.f1 * 0.92, 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.002, vel], [0.06, vel * 0.75, 'exp'], [P.dec, FLOOR, 'exp']]);
      o.connect(g);
      E.out(g, 'drums');
      V.osc(o);
      const n = E.noise(V, ['kick', t]);
      const f = E.filt('lowpass', P.cf, 0.7);
      const cg = E.gain(0);
      V.env(cg.gain, perc(vel * P.click, 0.0008, 0.012));
      n.connect(f);
      f.connect(cg);
      E.out(cg, 'drums');
    };

    I.brush = (t, vel, pan) => {
      const V = E.voice(t, 0.26, false);
      if (!V) return;
      const n = E.noise(V, ['brush', t]);
      const f = E.filt('bandpass', 3000, 0.55);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.004, vel], [0.05, vel * 0.45, 'exp'], [0.24, FLOOR, 'exp']]);
      n.connect(f);
      f.connect(g);
      E.out(g, 'perc', { pan: pan || 0.12 });
      const o = E.osc('sine', 185);
      const og = E.gain(0);
      V.env(og.gain, perc(vel * 0.35, 0.002, 0.06));
      o.connect(og);
      E.out(og, 'drums');
      V.osc(o, 0.1);
    };

    I.hat = (t, vel, open) => {
      const len = open ? 0.22 : 0.055;
      const V = E.voice(t, len + 0.01, false);
      if (!V) return;
      const n = E.noise(V, ['hat', t]);
      const f = E.filt('highpass', 7200, 0.8);
      const f2 = E.filt('peaking', 10500, 1.2);
      f2.gain.value = 5;
      const g = E.gain(0);
      V.env(g.gain, perc(vel, 0.001, len));
      n.connect(f);
      f.connect(f2);
      f2.connect(g);
      E.out(g, 'perc', { pan: -0.25 });
    };

    I.shaker = (t, vel, pan) => {
      const V = E.voice(t, 0.09, false);
      if (!V) return;
      const n = E.noise(V, ['shaker', t]);
      const f = E.filt('bandpass', 6500, 1.1);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.01, vel], [0.075, FLOOR, 'exp']]);
      n.connect(f);
      f.connect(g);
      E.out(g, 'perc', { pan: pan || 0.3 });
    };

    I.crash = (t, vel, o) => {
      o = o || {};
      const dec = o.dec || 1.55;
      const V = E.voice(t, dec + 0.05, false);
      if (!V) return;
      const n = E.noise(V, ['crash', t], true);
      const f = E.filt('highpass', 4800, 0.6);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.003, vel], [0.12, vel * 0.45, 'exp'], [dec, FLOOR, 'exp']]);
      n.connect(f);
      f.connect(g);
      E.out(g, 'perc', o);
    };

    // Woodblock tock or small wooden click.
    I.tock = (t, vel, f, o) => {
      o = o || {};
      const V = E.voice(t, 0.1, false);
      if (!V) return;
      const s = E.osc('sine', f * 1.5);
      V.env(s.frequency, [[0, f * 1.5], [0.006, f, 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, perc(vel, 0.001, o.dec || 0.06));
      s.connect(g);
      E.out(g, o.bus || 'perc', o);
      V.osc(s);
      const tri = E.osc('triangle', f * 2.71);
      const tg = E.gain(0);
      V.env(tg.gain, perc(vel * 0.25, 0.001, 0.025));
      tri.connect(tg);
      E.out(tg, o.bus || 'perc', o);
      V.osc(tri, 0.05);
      const n = E.noise(V, ['tock', t, f]);
      const nf = E.filt('bandpass', Math.min(9000, f * 2.4), 2.5);
      const ng = E.gain(0);
      V.env(ng.gain, perc(vel * 0.5, 0.0005, 0.01));
      n.connect(nf);
      nf.connect(ng);
      E.out(ng, o.bus || 'perc', o);
    };

    // FM marimba: soft-mallet FM attack on the fundamental, the tuned 4th partial, a mallet thump.
    I.marimba = (t, f, vel, o) => {
      o = o || {};
      const dec = o.dec || Math.min(2.2, Math.max(0.35, 1.5 * Math.sqrt(220 / f)));
      const V = E.voice(t, dec + 0.05, false);
      if (!V) return;
      const c = E.osc('sine', f);
      const m = E.osc('sine', f);
      const mg = E.gain(0);
      V.env(mg.gain, [[0, f * 1.4], [0.04, f * 0.04, 'exp'], [dec, FLOOR, 'exp']]);
      m.connect(mg);
      mg.connect(c.frequency);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.003, vel], [dec, FLOOR, 'exp']]);
      c.connect(g);
      E.out(g, o.bus || 'keys', o);
      V.osc(c);
      V.osc(m);
      if (f * 4 < 16000) {
        const p = E.osc('sine', f * 4);
        const pg = E.gain(0);
        V.env(pg.gain, perc(vel * 0.22, 0.002, 0.12));
        p.connect(pg);
        E.out(pg, o.bus || 'keys', o);
        V.osc(p, 0.2);
      }
      const n = E.noise(V, ['mar', t, f]);
      const nf = E.filt('lowpass', 1400, 0.7);
      const ng = E.gain(0);
      V.env(ng.gain, perc(vel * 0.12, 0.001, 0.012));
      n.connect(nf);
      nf.connect(ng);
      E.out(ng, o.bus || 'keys', o);
    };

    // Kalimba: sine tine with a small pitch settle, an inharmonic overtone and a thumb click.
    I.kalimba = (t, f, vel, o) => {
      o = o || {};
      const dec = o.dec || 1.5;
      const V = E.voice(t, dec + 0.05, false);
      if (!V) return;
      const s = E.osc('sine', f);
      V.env(s.frequency, [[0, f * 1.007], [0.03, f, 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.002, vel], [0.09, vel * 0.55, 'exp'], [dec, FLOOR, 'exp']]);
      s.connect(g);
      E.out(g, o.bus || 'keys', o);
      V.osc(s);
      if (f * 5.93 < 17000) {
        const p = E.osc('sine', f * 5.93);
        const pg = E.gain(0);
        V.env(pg.gain, perc(vel * 0.28, 0.001, 0.07));
        p.connect(pg);
        E.out(pg, o.bus || 'keys', o);
        V.osc(p, 0.12);
      }
      const h = E.osc('sine', f * 2);
      const hg = E.gain(0);
      V.env(hg.gain, perc(vel * 0.1, 0.002, 0.35));
      h.connect(hg);
      E.out(hg, o.bus || 'keys', o);
      V.osc(h, 0.5);
      const n = E.noise(V, ['kal', t, f]);
      const nf = E.filt('bandpass', 3300, 1.8);
      const ng = E.gain(0);
      V.env(ng.gain, perc(vel * 0.3, 0.0005, 0.008));
      n.connect(nf);
      nf.connect(ng);
      E.out(ng, o.bus || 'keys', o);
    };

    // Glockenspiel: free-bar partial ratios, higher partials die first.
    I.glock = (t, f, vel, o) => {
      o = o || {};
      const dec = o.dec || 1.8;
      const V = E.voice(t, dec + 0.05, false);
      if (!V) return;
      const parts = [
        [1, 1, 1],
        [2.756, 0.3, 0.35],
        [5.404, 0.11, 0.14],
        [8.933, 0.05, 0.06],
      ];
      for (const [ratio, a, d] of parts) {
        if (f * ratio > 18000) continue;
        const s = E.osc('sine', f * ratio);
        const g = E.gain(0);
        V.env(g.gain, perc(vel * a, 0.001, dec * d));
        s.connect(g);
        E.out(g, o.bus || 'bells', o);
        V.osc(s, dec * d + 0.02);
      }
    };

    // Glassy sine ping.
    I.glass = (t, f, vel, o) => {
      o = o || {};
      const dec = o.dec || 1.6;
      const V = E.voice(t, dec + 0.05, false);
      if (!V) return;
      const parts = [
        [1, 1, 1],
        [2, 0.12, 0.35],
        [3.01, 0.05, 0.18],
      ];
      for (const [ratio, a, d] of parts) {
        const s = E.osc('sine', f * ratio);
        const g = E.gain(0);
        V.env(g.gain, perc(vel * a, o.att || 0.003, dec * d));
        s.connect(g);
        E.out(g, o.bus || 'bells', o);
        V.osc(s, dec * d + 0.02);
      }
    };

    // FM bell: modulator at an inharmonic or harmonic ratio, index decaying with the note.
    I.fmBell = (t, f, vel, o) => {
      o = o || {};
      const dec = o.dec || 1.6;
      const ratio = o.ratio || 1.4;
      const idx = o.index || 3;
      const V = E.voice(t, dec + 0.05, false);
      if (!V) return;
      const c = E.osc('sine', f);
      const m = E.osc('sine', f * ratio);
      const mg = E.gain(0);
      V.env(mg.gain, [[0, f * idx], [dec * 0.5, f * idx * 0.08, 'exp']]);
      m.connect(mg);
      mg.connect(c.frequency);
      const g = E.gain(0);
      V.env(g.gain, perc(vel, o.att || 0.002, dec));
      c.connect(g);
      E.out(g, o.bus || 'bells', o);
      V.osc(c);
      V.osc(m);
    };

    // Soft FM gong.
    I.gong = (t, f, vel, o) => {
      o = o || {};
      const dec = o.dec || 2.2;
      const V = E.voice(t, dec + 0.05, false);
      if (!V) return;
      const c = E.osc('sine', f);
      const m = E.osc('sine', f * 1.41);
      const mg = E.gain(0);
      V.env(mg.gain, [[0, f * 0.3], [0.09, f * 2.2], [dec, f * 0.15, 'exp']]);
      m.connect(mg);
      mg.connect(c.frequency);
      const lp = E.filt('lowpass', 1900, 0.5);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.012, vel], [dec, FLOOR, 'exp']]);
      c.connect(lp);
      lp.connect(g);
      E.out(g, o.bus || 'bells', o);
      V.osc(c);
      V.osc(m);
    };

    // Metallic FM ting for the gold dots.
    I.ting = (t, f, vel, o) => I.fmBell(t, f, vel, Object.assign({ ratio: 3.51, index: 1.6, dec: 0.45 }, o || {}));

    // Warm detuned pad: two warm-saw voices per note, spread left and right, one shared lowpass.
    // o: att, rel, cut0, cut1 (cutoff at the start and at t1), q, sine (hushed sine pad), bus, sends
    I.pad = (t0, t1, notes, vel, o) => {
      o = o || {};
      const att = Math.min(o.att === undefined ? 0.25 : o.att, t1 - t0);
      const rel = o.rel === undefined ? 0.35 : o.rel;
      const hold = t1 - t0;
      const len = hold + rel;
      const V = E.voice(t0, len, true);
      if (!V) return;
      const lp = E.filt('lowpass', o.cut0 || 1200, o.q || 0.6);
      V.env(lp.frequency, [[0, o.cut0 || 1200], [hold, o.cut1 || o.cut0 || 1200, 'exp'], [len, (o.cut1 || o.cut0 || 1200) * 0.7, 'exp']]);
      const g = E.gain(0);
      const pts = [[0, 0], [att, vel, o.attShape || 'lin']];
      if (hold > att) pts.push([hold, vel * (o.sus === undefined ? 1 : o.sus), 'lin']);
      pts.push([len, 0, 'lin']);
      V.env(g.gain, pts);
      lp.connect(g);
      E.out(g, o.bus || 'pad', o);
      const per = 1 / Math.sqrt(notes.length * 2);
      notes.forEach((nm, i) => {
        const f = hz(nm);
        const sides = o.sine ? [0] : [-1, 1];
        for (const side of sides) {
          const s = E.osc(o.sine ? 'sine' : E.warmSaw, f);
          s.detune.value = side * (o.detune || 8) + (i % 2 ? 1.5 : -1.5);
          const sg = E.gain(per * (o.sine ? 1.4 : 1));
          const p = E.panner(side * (o.width === undefined ? 0.55 : o.width) * (i % 2 ? 0.8 : 1));
          s.connect(sg);
          sg.connect(p);
          p.connect(lp);
          V.osc(s);
        }
      });
    };

    // Sub bass: sine with a little 2nd and 3rd harmonic so it survives small speakers.
    I.sub = (t0, t1, note, vel, o) => {
      o = o || {};
      const att = Math.min(o.att === undefined ? 0.008 : o.att, t1 - t0);
      const rel = o.rel === undefined ? 0.06 : o.rel;
      const hold = t1 - t0;
      const len = hold + rel;
      const V = E.voice(t0, len, true);
      if (!V) return;
      const f = hz(note);
      const g = E.gain(0);
      const pts = [[0, 0], [att, vel, o.attShape || 'lin']];
      if (hold > att) pts.push([hold, vel * (o.sus === undefined ? 0.85 : o.sus), 'lin']);
      pts.push([len, 0, 'lin']);
      V.env(g.gain, pts);
      const lp = E.filt('lowpass', 420, 0.5);
      for (const [k, a] of [
        [1, 1],
        [2, 0.3],
        [3, 0.1],
      ]) {
        const s = E.osc('sine', f * k);
        const sg = E.gain(a);
        s.connect(sg);
        sg.connect(lp);
        V.osc(s);
      }
      lp.connect(g);
      E.out(g, 'bass');
    };

    // Sub drop: a sine sweeping down under a hit.
    I.subDrop = (t, f0, f1, len, vel) => {
      const V = E.voice(t, len + 0.02, false);
      if (!V) return;
      const s = E.osc('sine', f0);
      V.env(s.frequency, [[0, f0], [len, f1, 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.004, vel], [len * 0.5, vel * 0.7, 'lin'], [len, FLOOR, 'exp']]);
      s.connect(g);
      E.out(g, 'bass');
      V.osc(s);
    };

    // Warm pluck: warm saw plus soft square an octave up, a fast lowpass sweep.
    I.pluck = (t, note, vel, o) => {
      o = o || {};
      const f = hz(note);
      const dec = o.dec || 0.8;
      const V = E.voice(t, dec + 0.05, false);
      if (!V) return;
      const lp = E.filt('lowpass', 2000, o.q || 1.2);
      const top = Math.min(11000, f * (o.bright || 9));
      V.env(lp.frequency, [[0, top], [0.16, Math.max(180, f * 1.8), 'exp'], [dec, Math.max(150, f * 1.2), 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.003, vel], [0.14, vel * 0.45, 'exp'], [dec, FLOOR, 'exp']]);
      const a = E.osc(E.warmSaw, f);
      a.detune.value = -5;
      const b = E.osc(E.softSquare, f * 2);
      b.detune.value = 6;
      const bg = E.gain(0.35);
      a.connect(lp);
      b.connect(bg);
      bg.connect(lp);
      lp.connect(g);
      E.out(g, o.bus || 'keys', o);
      V.osc(a);
      V.osc(b);
    };

    // FM boop with an upward bend (the molts).
    I.boop = (t, note, vel, o) => {
      o = o || {};
      const f = hz(note);
      const V = E.voice(t, 0.32, false);
      if (!V) return;
      const c = E.osc('sine', f * 0.8);
      V.env(c.frequency, [[0, f * 0.8], [0.06, f, 'exp']]);
      const m = E.osc('sine', f * 1.6);
      V.env(m.frequency, [[0, f * 1.6], [0.06, f * 2, 'exp']]);
      const mg = E.gain(0);
      V.env(mg.gain, [[0, f * 2.2], [0.14, f * 0.2, 'exp']]);
      m.connect(mg);
      mg.connect(c.frequency);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.004, vel], [0.08, vel * 0.6, 'exp'], [0.3, FLOOR, 'exp']]);
      c.connect(g);
      E.out(g, 'keys', Object.assign({ room: 0.2 }, o));
      V.osc(c);
      V.osc(m);
    };

    // Detuned, band-passed saw stab.
    I.stab = (t, notes, vel, o) => {
      o = o || {};
      const len = o.len || 0.22;
      const V = E.voice(t, len + 0.02, false);
      if (!V) return;
      const bp = E.filt('bandpass', o.f || 1500, 1.4);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.003, vel], [len, FLOOR, 'exp']]);
      bp.connect(g);
      E.out(g, 'keys', o);
      for (const nm of notes) {
        for (const d of [-14, 14]) {
          const s = E.osc('sawtooth', hz(nm));
          s.detune.value = d;
          const sg = E.gain(0.5 / notes.length);
          s.connect(sg);
          sg.connect(bp);
          V.osc(s);
        }
      }
    };

    // Continuous FM lead with glides and delayed vibrato. phrase: [[t, note, glide]]
    I.lead = (phrase, tEnd, vel, o) => {
      o = o || {};
      const t0 = phrase[0][0];
      const rel = o.rel || 0.3;
      const len = tEnd - t0 + rel;
      const V = E.voice(t0, len, true);
      if (!V) return;
      const pitch = ctx.createConstantSource();
      const pp = [[0, hz(phrase[0][1])]];
      const vib = [[0, 0]];
      for (let i = 1; i < phrase.length; i++) {
        const dt = phrase[i][0] - t0;
        const gl = Math.max(0.005, phrase[i][2] || 0);
        pp.push([dt, hz(phrase[i - 1][1]), 'set']);
        pp.push([dt + gl, hz(phrase[i][1]), 'exp']);
      }
      for (let i = 0; i < phrase.length; i++) {
        const a = phrase[i][0] - t0;
        const b = (i + 1 < phrase.length ? phrase[i + 1][0] : tEnd + rel) - t0;
        const f = hz(phrase[i][1]);
        vib.push([a, 0, 'set']);
        if (b - a > 0.35) {
          vib.push([a + 0.18, 0, 'set']);
          vib.push([Math.min(b, a + 0.45), f * 0.008, 'lin']);
          vib.push([b, f * 0.008, 'lin']);
        }
      }
      V.env(pitch.offset, pp);
      const c = E.osc('sine', 0);
      const m = E.osc('sine', 0);
      const sub = E.osc('triangle', 0);
      pitch.connect(c.frequency);
      const mr = E.gain(1);
      pitch.connect(mr);
      mr.connect(m.frequency);
      const sr = E.gain(0.5);
      pitch.connect(sr);
      sr.connect(sub.frequency);
      const mg = E.gain(hz(phrase[0][1]) * 0.9);
      m.connect(mg);
      mg.connect(c.frequency);
      const lfo = E.osc('sine', 5.3);
      const vg = E.gain(0);
      V.env(vg.gain, vib);
      lfo.connect(vg);
      vg.connect(c.frequency);
      const lp = E.filt('lowpass', 3200, 0.8);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.012, vel], [tEnd - t0, vel * 0.9, 'lin'], [len, 0, 'lin']]);
      const sg = E.gain(0.35);
      c.connect(lp);
      sub.connect(sg);
      sg.connect(lp);
      lp.connect(g);
      E.out(g, 'lead', o);
      V.osc(pitch);
      V.osc(c);
      V.osc(m);
      V.osc(sub);
      V.osc(lfo);
    };

    // Synth horn: two brass saws with a filter swell per note and a scoop into pitch.
    I.horn = (phrase, tEnd, vel, o) => {
      o = o || {};
      const t0 = phrase[0][0];
      const rel = 0.25;
      const len = tEnd - t0 + rel;
      const V = E.voice(t0, len, true);
      if (!V) return;
      const pitch = ctx.createConstantSource();
      const pp = [];
      const cut = [];
      phrase.forEach(([t, nm], i) => {
        const dt = t - t0;
        const f = hz(nm);
        if (i === 0) pp.push([0, f * 0.97]);
        else pp.push([dt, f * 0.97, 'set']);
        pp.push([dt + 0.07, f, 'exp']);
        cut.push([dt, 300, i === 0 ? 'lin' : 'set']);
        cut.push([dt + 0.16, 2400, 'exp']);
        cut.push([dt + 0.45, 1500, 'exp']);
      });
      cut[0] = [0, 300];
      V.env(pitch.offset, pp);
      const lp = E.filt('lowpass', 300, 1.1);
      V.env(lp.frequency, cut);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.06, vel], [tEnd - t0, vel, 'lin'], [len, 0, 'lin']]);
      for (const d of [-7, 7]) {
        const s = E.osc(E.brassSaw, 0);
        s.detune.value = d;
        pitch.connect(s.frequency);
        const sg = E.gain(0.5);
        s.connect(sg);
        sg.connect(lp);
        V.osc(s);
      }
      lp.connect(g);
      E.out(g, 'lead', o);
      V.osc(pitch);
    };

    // Generic filtered noise: whooshes, sweeps, cracks, risers.
    // o: { type, f: env pts, q, amp: env pts, pan, panEnv, bus, sustain, stereo, sends }
    I.nz = (t, len, o) => {
      const V = E.voice(t, len, !!o.sustain);
      if (!V) return;
      const n = E.noise(V, ['nz', t, len, o.key || ''], !!o.stereo);
      const f = E.filt(o.type || 'bandpass', o.f[0][1], o.q || 0.8);
      V.env(f.frequency, o.f);
      const g = E.gain(0);
      V.env(g.gain, o.amp);
      n.connect(f);
      let last = f;
      if (o.type2) {
        const f2 = E.filt(o.type2, o.f2, o.q2 || 0.7);
        f.connect(f2);
        last = f2;
      }
      last.connect(g);
      let node = g;
      if (o.panEnv) {
        const p = E.panner(0);
        V.env(p.pan, o.panEnv);
        g.connect(p);
        node = p;
      }
      E.out(node, o.bus || 'sfx', o);
    };

    // A generated buffer played through an optional filter. make() builds the buffer only when the
    // voice is actually scheduled; secs must match its length.
    I.play = (t, secs, make, vel, o) => {
      o = o || {};
      const V = E.voice(t, secs + 0.01, o.sustain !== false);
      if (!V) return;
      const s = ctx.createBufferSource();
      s.buffer = make();
      let last = s;
      if (o.filt) {
        const f = E.filt(o.filt[0], o.filt[1], o.filt[2]);
        s.connect(f);
        last = f;
      }
      const g = E.gain(vel);
      last.connect(g);
      E.out(g, o.bus || 'sfx', o);
      V.buf(s, 0);
    };

    // Wing flutter: band-passed noise sweeping f0 to f1 with a flap on each listed offset.
    I.flutter = (t, len, flaps, o) => {
      const amp = [[0, 0]];
      const fl = o.floor || 0.08;
      flaps.forEach((dt, i) => {
        const pk = o.vel * (o.grow ? 0.6 + (0.4 * i) / Math.max(1, flaps.length - 1) : 1);
        amp.push([dt, amp.length > 1 ? o.vel * fl : 0, 'lin']);
        amp.push([dt + 0.008, pk, 'lin']);
        amp.push([dt + 0.06, o.vel * fl, 'exp']);
      });
      amp.push([len, FLOOR, 'exp']);
      I.nz(t, len, {
        type: 'bandpass',
        q: 1.1,
        f: [[0, o.f0], [len, o.f1, 'exp']],
        amp,
        panEnv: o.pan ? [[0, -o.pan], [len, o.pan, 'lin']] : null,
        bus: 'sfx',
        room: 0.25,
        key: 'flutter',
      });
    };

    I.chew = (t, vel, pan) =>
      I.nz(t, 0.02, { type: 'highpass', q: 0.7, f: [[0, 4200]], amp: perc(vel, 0.0008, 0.012), pan, key: 'chew' });

    I.plip = (t, f0, f1, vel, o) => {
      o = o || {};
      const V = E.voice(t, 0.14, false);
      if (!V) return;
      for (const [k, a] of [
        [1, 1],
        [2, 0.25],
      ]) {
        const s = E.osc('sine', f0 * k);
        V.env(s.frequency, [[0, f0 * k], [0.05, f1 * k, 'exp']]);
        const g = E.gain(0);
        V.env(g.gain, [[0, 0], [0.002, vel * a], [0.02, vel * a * 0.6, 'exp'], [0.12, FLOOR, 'exp']]);
        s.connect(g);
        E.out(g, 'sfx', Object.assign({ room: 0.2 }, o));
        V.osc(s);
      }
    };

    I.glide = (t, f0, f1, len, vel, o) => {
      o = o || {};
      const V = E.voice(t, len + 0.3, false);
      if (!V) return;
      const s = E.osc('sine', f0);
      V.env(s.frequency, [[0, f0], [len, f1, 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.003, vel], [len, vel * 0.5, 'exp'], [len + 0.28, FLOOR, 'exp']]);
      s.connect(g);
      E.out(g, o.bus || 'sfx', o);
      V.osc(s);
    };

    // Low whump for the wing pumps: a rising sine body plus a soft rising noise sweep.
    I.whump = (t, vel) => {
      const V = E.voice(t, 0.42, false);
      if (!V) return;
      const s = E.osc('sine', 55);
      V.env(s.frequency, [[0, 55], [0.14, 88, 'exp'], [0.4, 80, 'lin']]);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.006, vel], [0.12, vel * 0.7, 'exp'], [0.4, FLOOR, 'exp']]);
      s.connect(g);
      E.out(g, 'bass');
      V.osc(s);
      const h = E.osc('triangle', 110);
      V.env(h.frequency, [[0, 110], [0.14, 176, 'exp']]);
      const hg = E.gain(0);
      V.env(hg.gain, perc(vel * 0.25, 0.005, 0.18));
      h.connect(hg);
      E.out(hg, 'sfx');
      V.osc(h, 0.25);
      I.nz(t, 0.3, {
        type: 'bandpass',
        q: 1.5,
        f: [[0, 220], [0.26, 1500, 'exp']],
        amp: [[0, 0], [0.02, vel * 0.08], [0.2, vel * 0.18, 'lin'], [0.3, FLOOR, 'exp']],
        key: 'whump',
      });
    };

    I.whistle = (t, len, f0, f1, vel) => {
      const V = E.voice(t, len + 0.05, false);
      if (!V) return;
      const s = E.osc('sine', f0);
      V.env(s.frequency, [[0, f0], [len, f1, 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.015, vel], [len, FLOOR, 'exp']]);
      s.connect(g);
      E.out(g, 'sfx', { hall: 0.15 });
      V.osc(s);
    };

    I.bleep = (t, f, vel) => {
      const V = E.voice(t, 0.07, false);
      if (!V) return;
      const s = E.osc('sine', f);
      const lp = E.filt('lowpass', 6500, 0.7);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.002, vel], [0.062, FLOOR, 'exp']]);
      s.connect(lp);
      lp.connect(g);
      E.out(g, 'sfx', { room: 0.15 });
      V.osc(s);
    };

    // Striated buzz: a rising saw, chopped at 30 Hz, through a feedback comb.
    I.buzz = (t, len, vel) => {
      const V = E.voice(t, len + 0.05, false);
      if (!V) return;
      const s = E.osc('sawtooth', 98);
      V.env(s.frequency, [[0, 98], [len, 196, 'exp']]);
      const chop = E.gain(0.5);
      const lfo = E.osc('square', 30);
      const lg = E.gain(0.45);
      lfo.connect(lg);
      lg.connect(chop.gain);
      const d = ctx.createDelay(0.05);
      d.delayTime.value = 0.0034;
      const fb = E.gain(0.55);
      const bp = E.filt('bandpass', 1300, 0.8);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.04, vel * 0.5], [len * 0.85, vel, 'lin'], [len, FLOOR, 'exp']]);
      s.connect(chop);
      chop.connect(bp);
      chop.connect(d);
      d.connect(fb);
      fb.connect(d);
      d.connect(bp);
      bp.connect(g);
      E.out(g, 'sfx', { hall: 0.25 });
      V.osc(s);
      V.osc(lfo);
    };

    // Reverse swell: noise rising exponentially into a hard stop at t + len.
    I.revSwell = (t, len, vel, o) => {
      o = o || {};
      const hi = o.hi || false;
      I.nz(t, len, {
        type: hi ? 'highpass' : 'lowpass',
        q: 0.7,
        f: hi ? [[0, 9000], [len, 3500, 'exp']] : [[0, 400], [len, o.fTop || 3500, 'exp']],
        type2: hi ? 'peaking' : null,
        f2: 9500,
        amp: [[0, vel * 0.004], [len - 0.012, vel, 'exp'], [len, FLOOR, 'lin']],
        stereo: true,
        sustain: true,
        bus: o.bus || 'sfx',
        hall: o.hall || 0.2,
        key: 'rev',
      });
    };

    // Stereo wind bed: wide noise through a slowly wandering band-pass. amp: env pts.
    I.wind = (t0, t1, amp, o) => {
      o = o || {};
      const len = t1 - t0;
      const f = [[0, 700]];
      for (let k = 1; k * 0.25 < len; k++) f.push([k * 0.25, 650 + 380 * lib.noise1(k * 0.23 + t0, 'film-wind'), 'lin']);
      I.nz(t0, len, { type: 'bandpass', q: 0.45, f, type2: 'lowpass', f2: o.lp || 2600, amp, stereo: true, sustain: true, bus: 'amb', key: 'wind' });
    };

    // ---- voices added for CARTEZZ // ONLINE

    // Generic tone: one oscillator per harmonic (o.h: [[ratio, amp]]), frequency and amplitude
    // envelopes (env pts, the last amp point ends the voice), optional lowpass (o.lp), wave (o.wave).
    I.tone = (t, len, fEnv, amp, o) => {
      o = o || {};
      const V = E.voice(t, len, o.sustain !== false);
      if (!V) return;
      const g = E.gain(0);
      V.env(g.gain, amp);
      let head = g;
      if (o.lp) {
        const lp = E.filt('lowpass', o.lp, o.q || 0.7);
        lp.connect(g);
        head = lp;
      }
      for (const [k, a] of o.h || [[1, 1]]) {
        const s = E.osc(o.wave || 'sine', fEnv[0][1] * k);
        V.env(s.frequency, fEnv.map(([dt, f, sh]) => [dt, f * k, sh]));
        const sg = E.gain(a);
        s.connect(sg);
        sg.connect(head);
        V.osc(s);
      }
      E.out(g, o.bus || 'sfx', o);
    };

    // Pad bed with free amplitude and cutoff envelopes (env pts), warm-saw pairs or hushed sines.
    I.bed = (t, len, notes, amp, o) => {
      o = o || {};
      const V = E.voice(t, len, true);
      if (!V) return;
      const cut = o.cut || [[0, 800]];
      const lp = E.filt('lowpass', cut[0][1], o.q || 0.6);
      V.env(lp.frequency, cut);
      const g = E.gain(0);
      V.env(g.gain, amp);
      lp.connect(g);
      E.out(g, o.bus || 'pad', o);
      const per = 1 / Math.sqrt(notes.length * 2);
      notes.forEach((nm, i) => {
        for (const side of o.sine ? [0] : [-1, 1]) {
          const s = E.osc(o.sine ? 'sine' : E.warmSaw, hz(nm));
          s.detune.value = side * (o.detune || 7) + (i % 2 ? 1.5 : -1.5);
          const sg = E.gain(per * (o.sine ? 1.4 : 1));
          const p = E.panner(side * (o.width === undefined ? 0.5 : o.width) * (i % 2 ? 0.8 : 1));
          s.connect(sg);
          sg.connect(p);
          p.connect(lp);
          V.osc(s);
        }
      });
    };

    // Choir-like pad: three detuned saws per note with a slow shared vibrato, through an "ah" formant bank.
    I.choir = (t, len, notes, amp, o) => {
      o = o || {};
      const V = E.voice(t, len, true);
      if (!V) return;
      const g = E.gain(0);
      V.env(g.gain, amp);
      const mix = E.gain(1);
      const lp = E.filt('lowpass', o.lp || 3600, 0.5);
      for (const [f, q, a] of [
        [350, 2, 0.35],
        [730, 5, 1],
        [1090, 6, 0.55],
        [2440, 8, 0.22],
      ]) {
        const bp = E.filt('bandpass', f, q);
        const bg = E.gain(a * 2.4);
        mix.connect(bp);
        bp.connect(bg);
        bg.connect(lp);
      }
      lp.connect(g);
      E.out(g, o.bus || 'pad', o);
      const lfo = E.osc('sine', 4.9);
      const lg = E.gain(0);
      V.env(lg.gain, [[0, 0], [Math.min(0.8, len * 0.5), 10, 'lin']]); // cents, delayed vibrato
      lfo.connect(lg);
      V.osc(lfo);
      const per = 0.7 / Math.sqrt(notes.length * 3);
      notes.forEach((nm, i) => {
        for (const d of [-9, 0, 9]) {
          const s = E.osc('sawtooth', hz(nm));
          s.detune.value = d + (i % 2 ? 2 : -2);
          lg.connect(s.detune);
          const sg = E.gain(per);
          const p = E.panner((d / 12) * (o.width === undefined ? 0.8 : o.width));
          s.connect(sg);
          sg.connect(p);
          p.connect(mix);
          V.osc(s);
        }
      });
    };

    // Ostinato bass: two warm saws and a sine through a closing lowpass.
    I.bassNote = (t, note, len, vel, o) => {
      o = o || {};
      const f = hz(note);
      const V = E.voice(t, len + 0.08, false);
      if (!V) return;
      const lp = E.filt('lowpass', 900, o.q || 2.2);
      V.env(lp.frequency, [[0, o.bright || 1100], [0.12, Math.max(170, f * 2.4), 'exp'], [len + 0.08, Math.max(120, f * 1.6), 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.004, vel], [len * 0.7, vel * 0.6, 'exp'], [len + 0.06, FLOOR, 'exp']]);
      const a = E.osc(E.warmSaw, f);
      a.detune.value = -4;
      const b = E.osc(E.warmSaw, f);
      b.detune.value = 5;
      const s = E.osc('sine', f);
      const sg = E.gain(0.9);
      a.connect(lp);
      b.connect(lp);
      s.connect(sg);
      sg.connect(g);
      lp.connect(g);
      E.out(g, 'bass', o);
      V.osc(a);
      V.osc(b);
      V.osc(s);
    };

    // Felt heartbeat: lub-dub.
    I.heart = (t, vel) => {
      I.kick(t, vel, 'heart');
      I.kick(t + 0.2, vel * 0.45, 'heart');
    };

    // Soft footstep on a hard street: heel thud, scuff, a little grit.
    I.step = (t, vel, pan) => {
      const V = E.voice(t, 0.16, false);
      if (!V) return;
      const s = E.osc('sine', 115);
      V.env(s.frequency, [[0, 115], [0.04, 58, 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, perc(vel, 0.003, 0.11));
      s.connect(g);
      E.out(g, 'sfx', { pan });
      V.osc(s);
      I.nz(t, 0.14, { type: 'bandpass', q: 0.9, f: [[0, 1500], [0.1, 600, 'exp']], amp: [[0, 0], [0.004, vel * 0.5], [0.03, vel * 0.22, 'exp'], [0.13, FLOOR, 'exp']], pan, key: 'step', room: 0.25 });
      I.nz(t + 0.035, 0.06, { type: 'highpass', q: 0.7, f: [[0, 3800]], amp: perc(vel * 0.16, 0.002, 0.03), pan, key: 'grit' });
    };

    // Dark metallic tick: inharmonic FM ping plus a narrow noise tick.
    I.metal = (t, vel, pan) => {
      I.fmBell(t, 1850, vel, { ratio: 3.73, index: 2.2, dec: 0.16, bus: 'perc', pan, room: 0.2 });
      I.nz(t, 0.05, { type: 'bandpass', q: 3, f: [[0, 6200]], amp: perc(vel * 0.8, 0.0006, 0.02), pan, bus: 'perc', key: 'metal' });
    };

    // Air whoosh: band-passed stereo noise f0 -> fp (at pk seconds) -> f1, optional pan sweep and sub body.
    I.whoosh = (t, len, vel, o) => {
      o = o || {};
      const pk = o.pk || len * 0.4;
      I.nz(t, len, {
        type: 'bandpass',
        q: o.q || 0.9,
        f: [[0, o.f0 || 300], [pk, o.fp || 1400, 'exp'], [len, o.f1 || 500, 'exp']],
        amp: [[0, 0], [o.att || 0.02, vel * 0.25], [pk, vel, 'lin'], [len, FLOOR, 'exp']],
        panEnv: o.pan ? [[0, -o.pan], [len, o.pan, 'lin']] : null,
        stereo: true,
        bus: 'sfx',
        hall: o.hall || 0.15,
        key: o.key || 'whoosh',
      });
      if (o.body) I.tone(t, len, [[0, o.body], [len, o.body * 0.6, 'exp']], [[0, 0], [pk, vel * 0.5], [len, FLOOR, 'exp']], { bus: 'bass', sustain: false });
    };

    // THE notification tone: FM bell (harmonic ratio) + glass, one pitch. o: pan, dry, dec, hall, delay, bus.
    I.dingTone = (t, f, vel, o) => {
      o = o || {};
      const dry = !!o.dry;
      const sends = dry ? { room: 0.05 } : { hall: o.hall === undefined ? 0.28 : o.hall, delay: o.delay === undefined ? 0.1 : o.delay };
      const base = Object.assign({ pan: o.pan || 0, bus: o.bus || 'sfx' }, sends);
      const dec = (o.dec || 1.4) * (dry ? 0.6 : 1);
      I.fmBell(t, f, vel * 0.5, Object.assign({ ratio: 2, index: 1.3, dec }, base));
      I.glass(t, f, vel * 0.5, Object.assign({ dec: dec * 0.9 }, base));
      I.glass(t, f * 2, vel * 0.07, Object.assign({ dec: dec * 0.3 }, base));
    };
    // THE notification ding: E6 then B6 a 32nd later.
    I.ding = (t, vel, o) => {
      I.dingTone(t, hz('E6'), vel, o);
      I.dingTone(t + 1 / 12, hz('B6'), vel * 0.9, o);
    };

    // Glass shimmer: a quick run of glass pings, alternating sides.
    I.shimmer = (t, notes, step, vel, o) =>
      notes.forEach((nm, i) => I.glass(t + i * step, hz(nm), vel * (1 - i * 0.07), Object.assign({ dec: 1.3, pan: (i % 2 ? 1 : -1) * 0.45, hall: 0.3 }, o || {})));

    // Band-limited crash: stereo noise between 4.2 and 11 kHz, so it does not pile energy near Nyquist
    // into the limiter (the stock crash is highpass-only).
    I.cymbal = (t, vel, o) => {
      o = o || {};
      const dec = o.dec || 1.8;
      I.nz(t, dec + 0.05, {
        type: 'highpass',
        q: 0.6,
        f: [[0, 4200]],
        type2: 'lowpass',
        f2: o.lp || 11000,
        amp: [[0, 0], [0.003, vel], [0.12, vel * 0.45, 'exp'], [dec, FLOOR, 'exp']],
        stereo: true,
        bus: 'perc',
        hall: o.hall || 0.15,
        key: o.key || 'cymbal',
      });
    };

    // Pre-rendered grain texture (clicks, crackle, shards).
    I.grains = (t, secs, key, grains, vel, o) => I.play(t, secs, () => grainBuffer(ctx, key, secs, grains), vel, o);

    // THE press: a deep tock, a sub thump and a mechanical clack-latch.
    I.press = (t, vel) => {
      const V = E.voice(t, 0.8, false);
      if (!V) return;
      const s = E.osc('sine', 170);
      V.env(s.frequency, [[0, 170], [0.045, 58, 'exp'], [0.7, 44, 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.0015, vel], [0.09, vel * 0.5, 'exp'], [0.7, FLOOR, 'exp']]);
      s.connect(g);
      E.out(g, 'drums');
      V.osc(s);
      I.tone(t, 0.9, [[0, 54], [0.6, 40, 'exp']], [[0, 0], [0.006, vel * 0.9], [0.25, vel * 0.45, 'exp'], [0.85, FLOOR, 'exp']], { bus: 'bass', sustain: false, h: [[1, 1], [2, 0.25]] });
      I.tock(t, vel * 0.7, 820, { bus: 'sfx', dec: 0.07, room: 0.15 });
      I.nz(t, 0.06, { type: 'bandpass', q: 1.4, f: [[0, 2600]], amp: perc(vel * 1.2, 0.0004, 0.014), bus: 'sfx', key: 'clack', room: 0.2 });
      I.nz(t + 0.028, 0.05, { type: 'bandpass', q: 2, f: [[0, 4200]], amp: perc(vel * 0.45, 0.0004, 0.01), bus: 'sfx', key: 'latch', room: 0.2 });
    };

    // Tape rewind: a chattering saw diving in pitch, chopped by a slowing reel flutter.
    I.rewind = (t, len, vel) => {
      const V = E.voice(t, len + 0.02, true);
      if (!V) return;
      const s = E.osc('sawtooth', 1800);
      V.env(s.frequency, [[0, 1800], [len, 55, 'exp']]);
      const am = E.gain(0.5);
      const lfo = E.osc('square', 46);
      V.env(lfo.frequency, [[0, 46], [len, 7, 'exp']]);
      const lg = E.gain(0.5);
      lfo.connect(lg);
      lg.connect(am.gain);
      const bp = E.filt('bandpass', 3000, 1.1);
      V.env(bp.frequency, [[0, 3200], [len, 240, 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.08, vel * 0.5], [len * 0.55, vel, 'lin'], [len - 0.06, vel * 0.5, 'lin'], [len, FLOOR, 'exp']]);
      s.connect(am);
      am.connect(bp);
      bp.connect(g);
      E.out(g, 'sfx', { pan: 0.1 });
      V.osc(s);
      V.osc(lfo);
    };

    return I;
  }

  // ---------------------------------------------------------------- grain textures
  function flapGrains(r, t0, len, rate, o) {
    const out = [];
    const n = Math.floor(len * rate);
    for (let i = 0; i < n; i++) {
      const t = t0 + r() * len;
      out.push({
        t,
        dur: 0.05 + r() * 0.05,
        amp: (o.amp || 0.3) * (0.4 + 0.6 * r()),
        pan: (r() * 2 - 1) * (o.width || 0.9),
        f: (o.f0 || 380) + r() * (o.f1 || 1200),
        q: 0.9,
        att: 0.008 + r() * 0.008,
        dec: 0.02 + r() * 0.02,
      });
    }
    return out;
  }
  function clickGrains(r, t0, len, count, o) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const u = o.shape ? Math.pow(r(), o.shape) : r();
      out.push({
        t: t0 + u * len,
        dur: 0.008,
        amp: (o.amp || 0.3) * (0.3 + 0.7 * r()),
        pan: (r() * 2 - 1) * (o.width || 0.9),
        f: (o.f0 || 3000) + r() * (o.f1 || 5000),
        q: o.q || 1.2,
        att: 0.0004,
        dec: o.dec || 0.0015,
      });
    }
    return out;
  }

  // ---------------------------------------------------------------- the score
  // CARTEZZ // ONLINE. 90 bpm, 13 bars, D minor world (D dorian: the ding's B natural belongs).
  // Every cue in FILM.TIMELINE.cues is implemented by hand at the same frame-snapped time, b(n).
  // Acts: 1 profile (pulse, UI) | 2 the notification (ding, flood) | 3 the break | 4 the walk, the
  // awe | 5 the button (peak, pause, press) | 6 silence | 7 pull-back, black, one ding.
  const CH = {
    open: ['D3', 'A3', 'D4'], // hushed open fifth: the dark ambient bed
    notif: ['E4', 'B4'], // the ding's colour over D: D lydian (E pentatonic sits inside it)
    low: ['D2', 'A2', 'D3', 'F3'], // the world break, low
    dm: ['D3', 'F3', 'A3', 'C4', 'E4'], // Dm9
    bb: ['Bb2', 'F3', 'A3', 'D4'], // Bbmaj7
    c: ['C3', 'G3', 'C4', 'E4'], // C
    wonder: ['D3', 'A3', 'E4', 'F#4', 'C#5'], // Dmaj9: the awe
    wonderChoir: ['A3', 'D4', 'F#4', 'A4'],
    lift: ['B2', 'G3', 'D4', 'F#4', 'B4'], // Gmaj7/B: the smile
    liftChoir: ['B3', 'D4', 'F#4', 'G4'],
  };
  const BASS = {
    dm: ['D2', 'D2', 'A2', 'D2', 'D2', 'C3', 'A2', 'F2'],
    bb: ['Bb1', 'Bb1', 'F2', 'Bb1'],
    c: ['C2', 'C2', 'G2', 'E2'],
  };
  const PENTA = ['E6', 'F#6', 'G#6', 'B6', 'C#7'];

  function score(E, I) {
    const { kick, hat, tock, glass, glock, marimba, kalimba, gong, sub, subDrop, whump, bleep, chew, buzz, revSwell, nz, lead } = I;
    const BEAT = 60 / FILM.TIMELINE.bpm;
    const b = (n) => Math.round(n * BEAT * 24) / 24; // the timeline's frame-snapped beat grid
    const S16 = BEAT / 4;
    const S8 = BEAT / 2;
    const r = (...k) => E.rng(...k);
    const ctx = E.ctx;
    // A chord segment of the groove pad, crossfading into the next one.
    const padSeg = (t0, t1, notes, vel, cut, o) =>
      I.bed(t0, t1 - t0 + 0.25, notes, [[0, 0], [0.12, vel], [t1 - t0, vel * 0.95, 'lin'], [t1 - t0 + 0.25, 0, 'lin']], Object.assign({ cut: [[0, cut]], hall: 0.12 }, o || {}));
    const bassBar = (t0, pat, vel) => pat.forEach((nm, k) => I.bassNote(t0 + k * S8, nm, S8 * 0.92, vel * (k % 4 === 0 ? 1 : k % 2 ? 0.72 : 0.85)));

    // ================================================================ ACT 1 — the profile (0 – 5.333)
    // The dark bed: a hushed open fifth on D, swelling a little at 2.667, carrying on under the
    // notifications until the break cuts it.
    I.bed(0, b(16), CH.open, [[0, 0], [2.0, 0.15], [b(4), 0.15], [b(5.5), 0.21], [b(8), 0.2], [b(12), 0.22], [b(15), 0.26], [b(16) - 0.02, 0.28], [b(16), 0]], {
      cut: [[0, 380], [b(4), 420], [b(5.5), 650], [b(12), 900, 'exp'], [b(16), 1600, 'exp']],
      hall: 0.2,
    });
    // Felt heartbeat every 2 beats.
    for (const n of [0, 2, 4, 6, 8, 10, 14]) I.heart(b(n), n < 8 ? 0.5 : 0.45);
    // 0.333 soft UI tick: corner brackets.
    tock(b(0.5), 0.13, 3300, { bus: 'sfx', dec: 0.025, room: 0.35, pan: -0.2 });
    // 0.667 low glass tone D4: the phone frame.
    glass(b(1), hz('D4'), 0.34, { dec: 3.2, hall: 0.3 });
    glass(b(1), hz('D5'), 0.05, { dec: 1.2, hall: 0.3 });
    // 1.333 sine bloom A4: the avatar ring.
    I.tone(b(2), 3.2, [[0, hz('A4')]], [[0, 0], [0.28, 0.12], [3.2, FLOOR, 'exp']], { bus: 'bells', h: [[1, 1], [2, 0.12]], hall: 0.35 });
    // 2.0 seven key clicks on 16ths: the name types.
    for (let k = 0; k < 7; k++) {
      const q = r('key', k);
      const pan = (q() * 2 - 1) * 0.3;
      tock(b(3) + k * S16, 0.1 + q() * 0.04, 2600 + q() * 900, { bus: 'sfx', dec: 0.018, pan, room: 0.2 });
      chew(b(3) + k * S16, 0.05, pan);
    }
    // 2.667 a low drone D2 enters under the pad (to the break).
    I.bed(b(4), b(16) - b(4), ['D2'], [[0, 0], [1.4, 0.2], [b(8) - b(4), 0.24], [b(12) - b(4), 0.3], [b(16) - b(4) - 0.02, 0.32], [b(16) - b(4), 0]], { bus: 'amb', cut: [[0, 230]], detune: 5 });
    // 3.333 a soft pitched pulse A3, long tail: the focus ring.
    marimba(b(5), hz('A3'), 0.22, { dec: 1.4, hall: 0.3 });
    I.tone(b(5), 3.4, [[0, hz('A3')]], [[0, 0], [0.006, 0.15], [3.4, FLOOR, 'exp']], { bus: 'keys', hall: 0.3 });
    // 4.0 blip E5, 4.667 blip B4: the 2 and its blink.
    bleep(b(6), hz('E5'), 0.24);
    bleep(b(7), hz('B4'), 0.2);

    // ================================================================ ACT 2 — the notification (5.333 – 10.667)
    // THE ding, then three more.
    I.ding(b(8), 0.85);
    I.ding(b(10), 0.75, { pan: -0.35 });
    I.ding(b(11), 0.65, { pan: 0.4 });
    I.ding(b(11.5), 0.5, { pan: -0.45 });
    // The ding's colour over the bed (D lydian), glassy and hushed.
    I.bed(b(8), b(16) - b(8), CH.notif, [[0, 0], [2.4, 0.06], [b(12) - b(8), 0.08], [b(16) - b(8) - 0.02, 0.12], [b(16) - b(8), 0]], { sine: true, cut: [[0, 3000]], hall: 0.25 });
    // Quiet hats on 8ths from 6.667, 16ths through the flood.
    for (let k = 0; k < 4; k++) hat(b(10) + k * S8, k % 2 ? 0.05 : 0.07);
    for (let k = 0; k < 12; k++) hat(b(12) + k * S16, k % 2 ? 0.06 : 0.09);
    // 8.0 the flood: a full ding on the downbeat, then single dings on 16ths, then on 32nds, seeded
    // pitches across E pentatonic and seeded pans.
    I.ding(b(12), 0.7, { pan: 0.1, dec: 1.0 });
    for (let k = 1; k < 11; k++) {
      const q = r('flood', k);
      const t = k < 4 ? b(12) + k * S16 : b(13) + (k - 4) * (S16 / 2);
      const nm = PENTA[Math.floor(q() * PENTA.length)];
      I.dingTone(t, hz(nm), 0.34 + 0.2 * q() + k * 0.012, { pan: (q() * 2 - 1) * 0.8, dec: 0.6, hall: 0.22, delay: 0.06 });
    }
    // Sub pulse on every beat of the flood.
    for (const n of [12, 13]) {
      kick(b(n), 0.5, 'heart');
      sub(b(n), b(n) + 0.45, 'D2', 0.4, { att: 0.005, rel: 0.2 });
    }
    // 9.333 glass shimmer and glitch clicks as the gifts solidify (bursts on 16ths).
    I.shimmer(b(14), ['E6', 'G#6', 'B6', 'E7', 'G#7', 'B7'], 1 / 24, 0.2);
    {
      const q = r('glitch');
      const gr = [];
      for (let k = 0; k < 8; k++) {
        const t0 = k * S16;
        const n = k === 0 ? 6 : 2 + Math.floor(q() * 4);
        for (let j = 0; j < n; j++)
          gr.push({ t: j === 0 ? t0 : t0 + q() * 0.035, dur: 0.008, amp: (j === 0 ? (k === 0 ? 1 : 0.5) : 0.25 * (0.3 + 0.7 * q())) * (1 - k * 0.06), pan: (q() * 2 - 1) * 0.8, f: 2500 + q() * 6000, q: 1.3, att: 0.0003, dec: 0.0016 });
      }
      I.grains(b(14), 1.4, 'glitch', gr, 0.9, { bus: 'sfx', room: 0.15 });
    }
    // 10.0 reverse swell and a riser climbing a fifth (D4 -> A4) into the break; a snap starts it.
    tock(b(15), 0.16, 2900, { bus: 'sfx', dec: 0.02, room: 0.2 });
    revSwell(b(15), b(16) - b(15), 0.42, { fTop: 5000, hall: 0.12 });
    I.tone(b(15), b(16) - b(15), [[0, hz('D4')], [b(16) - b(15), hz('A4'), 'exp']], [[0, 0], [0.01, 0.03], [b(16) - b(15) - 0.01, 0.1, 'exp'], [b(16) - b(15), 0, 'lin']], { wave: 'sawtooth', lp: 2400, bus: 'lead', h: [[1, 1], [1.004, 0.8]] });

    // ================================================================ ACT 3 — the world breaks (10.667 – 13.333)
    {
      const t = b(16);
      kick(t, 0.85, 'full');
      E.duck(t, 0.7);
      subDrop(t, hz('D2'), 30, 1.8, 0.7);
      whump(t, 0.7);
      I.cymbal(t, 0.4, { dec: 2.6, key: 'breakcym' });
      nz(t, 1.8, { type: 'lowpass', q: 0.8, f: [[0, 9000], [1.6, 300, 'exp']], amp: perc(0.4, 0.002, 1.5), stereo: true, bus: 'sfx', hall: 0.3, key: 'breakcrash' });
      // Glass burst: bright pings and shards spraying out.
      ['D7', 'A6', 'E7', 'F#7', 'A7', 'D6'].forEach((nm, i) => glass(t + i * 0.011, hz(nm), 0.16 - i * 0.015, { dec: 1.1, pan: (i % 2 ? 1 : -1) * (0.3 + i * 0.1), hall: 0.35 }));
      {
        const q = r('shards');
        const gr = [];
        for (let j = 0; j < 40; j++) gr.push({ t: j === 0 ? 0 : Math.pow(q(), 1.8) * 0.5, dur: 0.02, amp: 0.3 * (0.3 + 0.7 * q()), pan: (q() * 2 - 1) * 0.9, f: 4000 + q() * 7000, q: 4, att: 0.0003, dec: 0.004 });
        I.grains(t, 0.6, 'shards', gr, 0.8, { bus: 'sfx', hall: 0.2 });
      }
    }
    // The low world grows: dark pad opening up, a D1 sub floor, kick on 1 and 3.
    I.bed(b(16), b(20) - b(16) + 0.2, CH.low, [[0, 0], [0.5, 0.2], [b(20) - b(16), 0.3, 'lin'], [b(20) - b(16) + 0.2, 0]], { cut: [[0, 260], [b(20) - b(16), 1000, 'exp']], hall: 0.2 });
    sub(b(16), b(20), 'D1', 0.3, { att: 0.9, rel: 0.1 });
    kick(b(18), 0.85, 'full');
    E.duck(b(18), 0.5);
    // 11.333 deep rising grinds: the towers rise.
    I.play(b(17), 1.9, () => creakBuffer(ctx, 'grind', 1.9, 26, 70, [[110, 0.02, 1], [240, 0.012, 0.5], [520, 0.006, 0.2]]), 0.16, { bus: 'sfx', hall: 0.2, filt: ['lowpass', 1400, 0.7] });
    nz(b(17), 1.95, { type: 'bandpass', q: 2.5, f: [[0, 90], [1.9, 420, 'exp']], amp: [[0, 0], [1.6, 0.4, 'lin'], [1.95, FLOOR, 'exp']], stereo: true, bus: 'sfx', hall: 0.15, key: 'grind' });
    // 12.0 searchlight thoom (low gong).
    gong(b(18), hz('D2'), 0.55, { dec: 3.0, hall: 0.3 });
    // 12.667 the first metal tick and a 16th pickup into the groove.
    I.metal(b(19), 0.12, 0.2);
    I.metal(b(19.5), 0.07, -0.2);
    I.metal(b(19.75), 0.09, 0.2);
    for (let k = 0; k < 4; k++) hat(b(18) + k * S8, 0.06);

    // ================================================================ ACT 4 — the walk (13.333 – 18.667)
    // Bass ostinato on 8ths, dark pad, kick 1 and 3, metal 2 and 4, hats, the ding motif on offbeats.
    bassBar(b(20), BASS.dm, 0.55);
    bassBar(b(24), BASS.bb, 0.55);
    bassBar(b(26), BASS.c, 0.55);
    padSeg(b(20), b(24), CH.dm, 0.22, 850);
    padSeg(b(24), b(26), CH.bb, 0.22, 850);
    padSeg(b(26), b(28), CH.c, 0.22, 950);
    for (let n = 20; n < 28; n++) {
      if (n % 2 === 0) {
        kick(b(n), 0.82, 'full');
        E.duck(b(n), 0.55);
      } else I.metal(b(n), n < 24 ? 0.09 : 0.15, n % 4 === 1 ? -0.2 : 0.2);
      hat(b(n) + S8, 0.07);
      if (n >= 24) hat(b(n), 0.035);
    }
    // The ding as a quiet melodic motif on offbeats (E–B, the ding's interval, then D dorian).
    ['E6', 'B6', 'A6', 'E6', 'D6', 'A6', 'G6', 'E6'].forEach((nm, k) => I.dingTone(b(20 + k) + S8, hz(nm), 0.2, { pan: k % 2 ? 0.3 : -0.3, dec: 0.9, hall: 0.25, delay: 0.14, bus: 'bells' }));
    // 14.667 and 17.333 arrival whooshes (deep; the white cap lighter).
    I.whoosh(b(22), 1.3, 0.34, { f0: 180, fp: 900, f1: 260, pk: 0.4, pan: 0.5, body: 70, key: 'bowtie' });
    I.whoosh(b(26), 1.1, 0.28, { f0: 260, fp: 1500, f1: 400, pk: 0.35, pan: -0.5, key: 'cap' });
    // 15.333 the first footstep, then one on every beat while he walks.
    for (let n = 23; n <= 27; n++) I.step(b(n), 0.32, n % 2 ? -0.08 : 0.08);
    // 18.0 hologram flicker: crackle, buzz, a rising filtered swell (hard stop into 18.667).
    {
      const q = r('crackle');
      const gr = [];
      for (let j = 0; j < 55; j++) gr.push({ t: j === 0 ? 0 : Math.pow(q(), 0.8) * 0.62, dur: 0.01, amp: j === 0 ? 0.5 : 0.28 * (0.3 + 0.7 * q()), pan: (q() * 2 - 1) * 0.7, f: 1800 + q() * 6000, q: 1.5, att: 0.0003, dec: 0.002 });
      I.grains(b(27), 0.66, 'crackle', gr, 0.85, { bus: 'sfx', room: 0.2 });
    }
    buzz(b(27), 0.62, 0.1);
    nz(b(27), b(28) - b(27) - 0.03, { type: 'bandpass', q: 3, f: [[0, 300], [0.63, 3200, 'exp']], amp: [[0, 0], [0.6, 0.22, 'exp'], [b(28) - b(27) - 0.03, FLOOR, 'lin']], stereo: true, sustain: true, bus: 'sfx', hall: 0.2, key: 'holoswell' });
    // Hologram hum, on from the flicker through the awe.
    I.tone(b(27), b(32) - b(27), [[0, 100]], [[0, 0], [0.5, 0.045], [b(32) - b(27) - 0.4, 0.03, 'lin'], [b(32) - b(27), 0, 'lin']], { wave: 'sawtooth', lp: 520, bus: 'amb', h: [[1, 1], [1.5, 0.3]] });

    // ================================================================ the awe (18.667 – 21.333)
    // The groove drops. A warm open Dmaj9 swell with a choir-like pad; a felt touch and a mallet dyad.
    {
      const t = b(28);
      kick(t, 0.42, 'heart');
      marimba(t, hz('D4'), 0.26, { dec: 1.8, hall: 0.35 });
      marimba(t, hz('A4'), 0.18, { dec: 1.6, hall: 0.35 });
      const L = b(31) - t;
      I.bed(t, L + 0.6, CH.wonder, [[0, 0], [0.9, 0.3], [L, 0.32, 'lin'], [L + 0.6, 0, 'lin']], { cut: [[0, 500], [1.2, 2000, 'exp']], hall: 0.3 });
      I.choir(t, L + 0.6, CH.wonderChoir, [[0, 0], [1.2, 0.2], [L, 0.22, 'lin'], [L + 0.6, 0, 'lin']], { hall: 0.35 });
      sub(t, b(31) + 0.3, 'D2', 0.26, { att: 0.5, rel: 0.4 });
    }
    // 19.333 glass shimmer: surprise.
    I.shimmer(b(29), ['F#6', 'A6', 'C#7', 'E7', 'F#7', 'A7'], 0.045, 0.13);
    // 20.0 the ding motif slow, like a music box: B5, E6.
    for (const [n, nm] of [[30, 'B5'], [30.5, 'E6']]) {
      glock(b(n), hz(nm), 0.3, { dec: 1.7, hall: 0.3, delay: 0.1 });
      tock(b(n), 0.03, 4200, { bus: 'sfx', dec: 0.01 });
    }
    // 20.667 the chord lifts to Gmaj7/B: the smile.
    {
      const t = b(31);
      const L = b(32) - t;
      kalimba(t, hz('B4'), 0.26, { dec: 1.6, hall: 0.3 });
      kalimba(t, hz('F#5'), 0.14, { dec: 1.4, hall: 0.3, pan: 0.25 });
      I.bed(t, L + 0.3, CH.lift, [[0, 0], [0.25, 0.32], [L, 0.34, 'lin'], [L + 0.3, 0, 'lin']], { cut: [[0, 1600], [L, 2600, 'exp']], hall: 0.3 });
      I.choir(t, L + 0.3, CH.liftChoir, [[0, 0], [0.3, 0.22], [L, 0.24, 'lin'], [L + 0.3, 0, 'lin']], { hall: 0.35 });
      sub(t, b(32), 'B1', 0.24, { att: 0.2, rel: 0.1 });
      revSwell(b(31.5), b(32) - b(31.5), 0.3, { hi: true, hall: 0.1 });
    }

    // ================================================================ ACT 5 — the button (21.333 – 26.667)
    // 21.333 the full groove returns bigger: crash, kick, bass (+ octave pluck), 16th hats, the ding
    // motif as the lead, whooshes on 8ths for the arrivals.
    {
      const t = b(32);
      I.cymbal(t, 0.42, { dec: 2.4, key: 'returncym' });
      nz(t, 0.9, { type: 'lowpass', q: 0.7, f: [[0, 7000], [0.8, 500, 'exp']], amp: perc(0.22, 0.002, 0.8), stereo: true, bus: 'sfx', hall: 0.2, key: 'return' });
      for (const [n, v] of [[32, 0.88], [33.5, 0.45], [34, 0.82], [35.5, 0.45]]) {
        kick(b(n), v, 'full');
        E.duck(b(n), v > 0.6 ? 0.6 : 0.3);
      }
      I.metal(b(33), 0.17, -0.2);
      I.metal(b(35), 0.17, 0.2);
      for (let k = 0; k < 16; k++) hat(b(32) + k * S16, k % 4 === 2 ? 0.11 : k % 2 ? 0.06 : 0.08, k === 14);
      bassBar(b(32), BASS.dm.slice(0, 4).concat(['D2', 'C3', 'A2', 'F2']), 0.6);
      bassBar(b(34), BASS.bb, 0.6);
      bassBar(b(35), BASS.c, 0.6);
      const oct = ['D3', 'D3', 'A3', 'D3', 'D3', 'C4', 'A3', 'F3', 'Bb2', 'Bb2', 'F3', 'Bb2', 'C3', 'C3', 'G3', 'E3'];
      oct.forEach((nm, k) => I.pluck(b(32) + k * S8, nm, 0.12, { dec: 0.3, bright: 5 }));
      padSeg(b(32), b(34), CH.dm, 0.26, 1300);
      padSeg(b(34), b(35), CH.bb, 0.26, 1300);
      padSeg(b(35), b(36) - 0.25, CH.c, 0.26, 1500);
      // The ding motif as the lead line on 8ths (bell) with an FM lead an octave below.
      const mel = ['E6', 'B6', 'A6', 'E6', 'F6', 'E6', 'D6', 'A5', 'F6', 'D6', 'A6', 'F6', 'G6', 'E6', 'C7', 'B6'];
      mel.forEach((nm, k) => I.dingTone(b(32) + k * S8, hz(nm), k % 2 ? 0.26 : 0.32, { pan: k % 2 ? 0.2 : -0.2, dec: 0.8, hall: 0.25, delay: 0.1, bus: 'lead' }));
      const low = (nm) => nm.replace(/\d$/, (d) => String(Number(d) - 1));
      lead(mel.map((nm, k) => [b(32) + k * S8, low(nm), 0.03]), b(36) - 0.3, 0.1, { hall: 0.2 });
      // Whooshes on the 8ths between kicks: new arrivals, alternating sides.
      for (let k = 0; k < 8; k++) {
        if (k === 0 || k === 4) continue;
        const q = r('arrive', k);
        I.whoosh(b(32) + k * S8, 0.32, 0.13 + q() * 0.05, { f0: 500 + q() * 300, fp: 2200 + q() * 1500, f1: 900, pk: 0.14, pan: k % 2 ? 0.6 : -0.6, hall: 0.1, key: 'arr' + k });
      }
      // Footsteps as he walks up to the button (stop at 24.0).
      I.step(b(34), 0.3, 0.06);
      I.step(b(35), 0.3, -0.06);
      // 22.667 riser toward the button, cutting a frame before 24.0.
      const rl = b(36) - b(34) - 0.04;
      nz(b(34), rl, { type: 'bandpass', q: 1.8, f: [[0, 500], [rl, 7000, 'exp']], amp: [[0, 0.01], [rl - 0.01, 0.3, 'exp'], [rl, FLOOR, 'lin']], stereo: true, sustain: true, bus: 'sfx', key: 'riser' });
      I.tone(b(34), rl, [[0, hz('A3')], [rl, hz('A4'), 'exp']], [[0, 0], [0.02, 0.02], [rl - 0.01, 0.09, 'exp'], [rl, 0, 'lin']], { wave: 'sawtooth', lp: 3000, bus: 'lead', h: [[1, 1], [1.006, 0.8]] });
    }
    // 24.0 sudden thinning: a sub pulse on each beat (a clock tick with it) and a held high A5.
    for (let n = 36; n < 40; n++) {
      kick(b(n), n === 36 ? 0.7 : 0.5, 'heart');
      sub(b(n), b(n) + 0.4, 'A1', 0.42, { att: 0.004, rel: 0.2 });
      tock(b(n), 0.1, 3400, { bus: 'sfx', dec: 0.02, pan: 0.12 });
    }
    // The tension tone: A5, climbing a semitone from 25.333, stopping dead on the press.
    {
      const L = b(40) - b(36);
      I.tone(b(36), L, [[0, hz('A5')], [b(38) - b(36), hz('A5')], [L - 0.15, hz('A#5'), 'exp']], [[0, 0], [0.012, 0.045], [b(38) - b(36), 0.05, 'lin'], [L - 0.008, 0.085, 'exp'], [L, 0, 'lin']], { bus: 'sfx', h: [[1, 1], [2, 0.03]] });
    }
    // 25.333 reverse swell to the press (dry, so nothing rings on after it).
    revSwell(b(38), b(40) - b(38), 0.55, { fTop: 6500, hall: 1e-4 });

    // ================================================================ ACT 6 — everything stops (26.667 – 29.333)
    I.press(b(40), 1);
    // Then near silence: a very faint high room tone fading over about a second.
    nz(b(40), 1.3, { type: 'highpass', q: 0.6, f: [[0, 5200]], type2: 'lowpass', f2: 11000, amp: [[0, 0], [0.04, 0.012], [1.25, FLOOR, 'exp']], stereo: true, bus: 'amb', key: 'roomtone' });
    // 28.833 a barely audible sub breath as his eye lands: a sub swell and a whisper of air.
    I.tone(b(43.25), 1.5, [[0, 40], [1.5, 35, 'exp']], [[0, 0], [0.22, 0.2], [1.5, FLOOR, 'exp']], { bus: 'bass', h: [[1, 1], [2, 0.35]] });
    nz(b(43.25), 1.0, { type: 'bandpass', q: 0.8, f: [[0, 700], [1.0, 380, 'exp']], amp: [[0, 0], [0.025, 0.02], [0.2, 0.012, 'exp'], [1.0, FLOOR, 'exp']], stereo: true, bus: 'amb', key: 'breath' });

    // ================================================================ ACT 7 — the reveal (29.333 – 34.667)
    // 29.333 pull-back: a tape engages, reverse air rushes up, the rewind dives; both land at 31.333.
    {
      const t = b(44);
      const L = b(47) - t;
      tock(t, 0.3, 1500, { bus: 'sfx', dec: 0.035, room: 0.2 });
      nz(t, 0.03, { type: 'bandpass', q: 2, f: [[0, 3800]], amp: perc(0.3, 0.0004, 0.008), bus: 'sfx', key: 'engage' });
      nz(t, L, { type: 'bandpass', q: 0.6, f: [[0, 220], [L - 0.05, 5200, 'exp'], [L, 4000, 'lin']], amp: [[0, 0.002], [0.03, 0.03], [L - 0.03, 0.42, 'exp'], [L - 0.02, FLOOR, 'lin']], panEnv: [[0, 0.4], [L, -0.3, 'lin']], stereo: true, sustain: true, bus: 'sfx', hall: 0.08, key: 'pullback' });
      I.rewind(t, L, 0.2);
    }
    // 31.333 the opening's ambient pulse returns, very low, and stops at the cut to black.
    {
      const t = b(47);
      const L = b(48) - t;
      I.heart(t, 0.5);
      I.bed(t, L, CH.open, [[0, 0], [0.25, 0.13], [L - 0.06, 0.13, 'lin'], [L, 0, 'lin']], { cut: [[0, 420]], hall: 0.1 });
      I.bed(t, L, ['D2'], [[0, 0], [0.25, 0.18], [L - 0.06, 0.18, 'lin'], [L, 0, 'lin']], { bus: 'amb', cut: [[0, 230]], detune: 5 });
    }
    // 32.0 silence (only the faintest screen-off tick marks the cut to black).
    tock(b(48), 0.035, 2300, { bus: 'sfx', dec: 0.012 });
    // 33.333 one clean notification ding, the same as 5.333: dry, centred, short tail.
    I.ding(b(50), 0.85, { dry: true });
  }

  FILM.audio = {
    render(ctx, opts) {
      const o = opts || {};
      const start = Math.max(0, Number(o.start) || 0);
      const dest = o.dest || ctx.destination;
      const DUR = (FILM.TIMELINE && FILM.TIMELINE.duration) || FILM.DURATION || 32;
      // opts.mix overrides the mix constants (bus gains, trim); the analysis tools use it for solo renders.
      const om = o.mix || {};
      const mix = Object.assign({}, MIX, om, {
        bus: Object.assign({}, MIX.bus, om.bus || {}),
        eq: Object.assign({}, MIX.eq, om.eq || {}),
        comp: Object.assign({}, MIX.comp, om.comp || {}),
      });
      const E = makeEngine(ctx, start, dest, DUR, mix);
      const I = instruments(E);
      // The score is scheduled one bar at a time, so the audio graph only ever holds the voices of
      // the next few seconds. Each voice belongs to exactly one bar by its start time, so the output
      // is the same as scheduling everything at once. The first bar also takes every earlier voice
      // still sounding at `start`.
      const BAR = 240 / ((FILM.TIMELINE && FILM.TIMELINE.bpm) || 120);
      const first = Math.floor(start / BAR);
      const last = Math.ceil(DUR / BAR) - 1;
      const run = (k) => {
        E.w0 = k === first ? -Infinity : k * BAR;
        E.w1 = k === last ? Infinity : (k + 1) * BAR;
        score(E, I);
      };
      const due = (k) => E.base + (k * BAR - start) - LAT; // context time of bar k's first event
      run(first);
      let k = first + 1;
      const isOffline = typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
      if (isOffline && typeof ctx.suspend !== 'function') {
        // An offline context that cannot pause mid-render gets every bar up front.
        for (; k <= last; k++) run(k);
      } else if (isOffline) {
        // Offline: pause the render 0.25 s before each bar, schedule it, resume.
        const q = 128 / ctx.sampleRate;
        const end = ctx.length / ctx.sampleRate;
        for (; k <= last; k++) {
          const j = k;
          const when = Math.floor((due(j) - 0.25) / q) * q;
          if (when >= end - q) break; // this bar starts after the render window ends
          let paused = null;
          if (when > ctx.currentTime + q) {
            try {
              paused = ctx.suspend(when);
            } catch (e) {
              paused = null;
            }
          }
          if (!paused) run(j);
          else
            paused.then(
              () => {
                run(j);
                ctx.resume();
              },
              () => run(j)
            );
        }
      } else {
        // Live: a look-ahead timer schedules each bar 1.5 s before it sounds.
        const AHEAD = 1.5;
        const pump = () => {
          while (k <= last && due(k) - ctx.currentTime < AHEAD) run(k++);
          return k <= last;
        };
        if (pump()) {
          const timer = setInterval(() => {
            if (ctx.state === 'closed' || !pump()) clearInterval(timer);
          }, 100);
        }
      }
    },
  };
})();
