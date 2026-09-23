// FILM.TIMELINE: the shot list and audio cue list for "CARTEZZ // ONLINE".
// Owner: storyboard. Human-readable plan: docs/storyboard.md. Visual rules: docs/art-bible.md.
// 90 bpm: a beat is 2/3 s (16 frames at 24 fps), a bar 8/3 s. Every boundary is a multiple of B.
(function () {
  'use strict';
  const FILM = window.FILM;
  const B = 60 / 90; // one beat
  const b = (n) => Math.round(n * B * 24) / 24; // n beats, snapped to the frame grid
  const HOLD = { hold: b(40) }; // the world freeze: the grain clock stops at the press (T 26.667)

  FILM.TIMELINE = {
    title: 'CARTEZZ // ONLINE',
    bpm: 90,
    duration: b(52),
    fps: 24,
    width: 1080,
    height: 1920,
    shots: [
      {
        id: 'profile-boot', file: '01-profile-boot.js', start: b(0), end: b(4), mode: 'schematic', plate: 'screen',
        title: 'The profile wakes in the dark',
        brief: 'Black. A single online spark at the avatar centre; corner brackets draw on; the phone frame, the charcoal header, the avatar ring (the dark city inside, G2), the status row 12:14, "cartezz" typed on 16ths, the white 2 + online, then the tiles, music row, username card and tabs cascade in. Scale 0.86 -> 1.0 about (540, 900). Ends on G1 exactly, no gift bubbles yet.',
      },
      {
        id: 'avatar-macro', file: '02-avatar-macro.js', start: b(4), end: b(6), mode: 'schematic', plate: 'screen',
        title: 'The avatar, too close',
        brief: 'Extreme close-up of the avatar (kit.avatar at r 470 about (540, 900), pushing to r 520): the dark city, unreadable and beautiful, a purple glow at its heart, a thick violet ring arc crossing the frame edges, a rail of 48 ash ticks. A focus ring pops on the glow at T 3.333.',
      },
      {
        id: 'online-macro', file: '03-online-macro.js', start: b(6), end: b(8), mode: 'schematic', plate: 'screen',
        title: '2 online',
        brief: 'Macro on kit.presence at x3.2 about (540, 895): the white rounded square with the 2 and the grey word online running off right. Brackets pop around the 2 at T 4.0; the 2 blinks once at T 4.667 (dims to 30% for 4 frames). Nothing else moves.',
      },
      {
        id: 'first-gift', file: '04-first-gift.js', start: b(8), end: b(12), mode: 'schematic', plate: 'screen',
        title: 'One notification. Then another',
        brief: 'G1 locked. Notification pills (kit.notif, 620 x 104) drop in under the status row at 5.333, 6.667, 7.333, 7.667, each with a gift icon; the count badge at (660, 410) counts 1-4; gift bubbles g2, g3, g4, g1 bloom on those beats; each arrival jolts the screen 3 px for 2 frames.',
      },
      {
        id: 'gift-flood', file: '05-gift-flood.js', start: b(12), end: b(14), mode: 'schematic', plate: 'screen',
        title: 'Dozens',
        brief: 'G1 under a flood: ~40 notification pills pour down on every 16th in a fanned, slightly perspective stack; the badge climbs 12, 48, 99+, 999+; bubbles g5 and g6 bloom at 8.333 and 8.667. Slow push x1.0 -> 1.06 about the avatar.',
      },
      {
        id: 'gifts-materialize', file: '06-gifts-materialize.js', start: b(14), end: b(16), mode: 'schematic', plate: 'screen',
        title: 'The gifts become objects',
        brief: 'Pills sweep away; each bubble gift solidifies (glitch slices) and grows x2.4 with slow 3D yaw; 18 more gifts spawn on 16ths orbiting the avatar at r 300-420; from 10.333 everything is pulled into the avatar centre. Push x1.06 -> 1.25 about (540, 540).',
      },
      {
        id: 'world-breaks', file: '07-world-breaks.js', start: b(16), end: b(20), mode: 'schematic', plate: 'screen-to-city',
        transitionIn: { kind: 'flash', dur: 2 / 24, color: FILM.lib.pal.hot },
        title: 'The profile unfolds into a city',
        brief: 'Flash on the bar-5 downbeat. The G1 profile tilts back into a ground plane (strip warp), the camera descends from above to street level (ends near CAM 08 start: pos (0,1.1,18) pitch 0.2 f 1050), the action tiles extrude into the first towers, towers rise in a wave to the horizon (kit.city rise), the gifts become giant sky objects. Cartezz stands tiny at (0,0,34).',
      },
      {
        id: 'city-reveal', file: '08-city-reveal.js', start: b(20), end: b(24), mode: 'schematic', plate: 'city',
        title: 'Cartezz in the city',
        brief: 'One-point perspective down the street, towers leaving the top of frame, the ONLINE glow on the horizon. Cartezz back view at (0,0,34), about 150 px tall, rim-lit. A giant bow tie materializes at 14.667; he takes his first step at 15.333. Camera (0,1.1,18) -> (0,1.1,20.5), pitch 0.2, f 1050.',
      },
      {
        id: 'walk-street', file: '09-walk-street.js', start: b(24), end: b(28), mode: 'schematic', plate: 'city',
        title: 'He walks',
        brief: 'Tracking behind him (camera (0,1.55,zH-4.2), pitch 0.1, f 1400) as he walks z = 60 + 1.45(T-16), a step on every beat; giant caps, bow ties, tamagotchis and notification billboards drift overhead; a white cap arrives at 17.333; at 18.0 his hologram profile flickers on high ahead.',
      },
      {
        id: 'awe', file: '10-awe.js', start: b(28), end: b(32), mode: 'schematic', plate: 'city',
        title: 'He sees himself',
        brief: 'Close-up in profile facing screen right (kit.head dir 1, body side, s 540 -> 590), head tilted up at the hologram of his own profile off-frame top right, its cold light on his face (wash, glint); the dark street behind. 18.667 neutral; 19.333 brows lift, eyes widen (surprise); 20.0 lips part; 20.667 a small admiring smile. A young man, dignified wonder, never comic.',
      },
      {
        id: 'profile-sky', file: '11-profile-sky.js', start: b(32), end: b(34), mode: 'schematic', plate: 'city',
        title: 'His profile over the city',
        brief: 'Low angle behind him (camera (1.5,0.6,58.5), pitch 0.62, f 950, craning to y 1.2): the giant hologram profile fills the upper frame, dozens of giant gifts orbit it, notification pills the size of buildings, searchlights crossing; he stands small at the bottom, looking up. Absurdity peaks; new arrivals on 8ths.',
      },
      {
        id: 'button-approach', file: '12-button-approach.js', start: b(34), end: b(38), mode: 'schematic', plate: 'city',
        title: 'ONLINE',
        brief: 'Behind him in the plaza (camera (0,2.2,190) -> (0,2.0,194), pitch 0.12, f 1150): the gigantic ONLINE button fills the middle of the frame. He walks z = 216.9 + 1.8(T-22.667) and stops at 24.0 (z 219.3). Pause. The button breathes on 24.0 and 24.667.',
      },
      {
        id: 'button-press', file: '13-button-press.js', start: b(38), end: b(40), mode: 'schematic', plate: 'city',
        title: 'The press',
        brief: 'Over his right shoulder (camera (1.4,1.5,216.9), yaw -0.28, pitch 0.18, f 1300): his silhouette against the glowing button face; his right arm rises (arm 0 -> 1 by 26.5), the palm meets the surface on the last frames; the glow blooms around the hand. Cut on the action.',
      },
      {
        id: 'freeze', file: '14-freeze.js', start: b(40), end: b(42), mode: 'schematic', plate: 'city', post: HOLD,
        transitionIn: { kind: 'flash', dur: 2 / 24, color: FILM.lib.pal.hot },
        title: 'Everything stops',
        brief: 'Locked wide from the side of the plaza (camera (-16,7.5,186), yaw 0.42, pitch 0.02, f 1050): the pressed button at full glow, Cartezz tiny at its base with his palm on it, every giant gift, pill, online dot and searchlight stopped. Nothing moves. Grain held.',
      },
      {
        id: 'look', file: '15-look.js', start: b(42), end: b(44), mode: 'schematic', plate: 'city', post: HOLD,
        title: 'He looks at us',
        brief: 'From behind: his shoulders, cap and hair (kit.head body back, dir -1) against the glowing frozen button face; at 28.333 he turns his head over the shoulder into profile (turn 0 -> 1, 10 drawings) and at 28.833 his eye slides to the camera (gaze 0 -> 1); one blink at 29.083. The world stays frozen.',
      },
      {
        id: 'pull-back', file: '16-pull-back.js', start: b(44), end: b(48), mode: 'schematic', plate: 'city-to-screen', post: HOLD,
        title: 'It was inside the avatar',
        brief: 'Rapid 3D pull from 15\'s end up and back along the frozen street to CAM_AVATAR (29.333-30.5), then a 2D zoom about (540,540) from Z 6.882 to 1 (30.25-31.333): the city shrinks into the avatar circle and the full G1 profile appears around it. Hold on G1 with 2 online and 12:14 unchanged.',
      },
      {
        id: 'end-title', file: '17-end-title.js', start: b(48), end: b(52), mode: 'none', plate: 'black', post: HOLD,
        title: 'CARTEZZ // @MURTHERED',
        brief: 'Black. At 32.667 the title CARTEZZ // @MURTHERED fades in centred on x 540, baseline 968 (bone / ash / violetMid); at 33.333 a tiny online dot pops left of it with the final ding. Hold.',
      },
    ],
    cues: [
      { t: b(0), kind: 'open', note: 'Ambient bed (low pad on D) and a felt heartbeat pulse every 2 beats until 5.333' },
      { t: b(0.5), kind: 'sfx', note: 'Soft UI tick: corner brackets' },
      { t: b(1), kind: 'sfx', note: 'Low glass tone D4: phone frame draws' },
      { t: b(2), kind: 'sfx', note: 'Sine bloom A4: avatar ring draws' },
      { t: b(3), kind: 'sfx', note: 'Seven key clicks on 16ths: the name types' },
      { t: b(4), kind: 'cut', note: 'Drone D2 enters under the pad' },
      { t: b(5), kind: 'sfx', note: 'Soft pulse A3: focus ring on the glow' },
      { t: b(6), kind: 'sfx', note: 'Blip E5: brackets around the 2' },
      { t: b(7), kind: 'sfx', note: 'Blip B4: the 2 blinks' },
      { t: b(8), kind: 'hit', note: 'THE notification ding: E6 then B6, FM bell + glass, centre' },
      { t: b(10), kind: 'hit', note: 'Ding 2, slightly left; quiet hats on 8ths start' },
      { t: b(11), kind: 'hit', note: 'Ding 3, right' },
      { t: b(11.5), kind: 'hit', note: 'Ding 4, left' },
      { t: b(12), kind: 'cut', note: 'Flood: dings on every 16th across E pentatonic, hats on 16ths, sub every beat' },
      { t: b(14), kind: 'sfx', note: 'Glass shimmer and glitch clicks: gifts solidify' },
      { t: b(15), kind: 'swell', note: 'Reverse swell and riser to the break at 10.667' },
      { t: b(16), kind: 'hit', note: 'World break: sub drop, whump, noise crash, glass burst; kick groove starts' },
      { t: b(18), kind: 'sfx', note: 'Searchlight thoom (low gong)' },
      { t: b(20), kind: 'cut', note: 'Bass ostinato in D minor on 8ths + dark pad; ding motif on offbeats' },
      { t: b(22), kind: 'sfx', note: 'Arrival whoosh: giant bow tie' },
      { t: b(23), kind: 'sfx', note: 'First footstep; then a step on every beat while he walks' },
      { t: b(24), kind: 'cut', note: 'Walk groove: kick 1 and 3, metal tick 2 and 4, bass 8ths' },
      { t: b(26), kind: 'sfx', note: 'Arrival whoosh: white cap' },
      { t: b(27), kind: 'sfx', note: 'Hologram flicker: crackle, buzz, rising swell' },
      { t: b(28), kind: 'hit', note: 'Awe: groove drops, warm Dmaj9 swell, choir-like pad' },
      { t: b(29), kind: 'sfx', note: 'Glass shimmer: surprise' },
      { t: b(30), kind: 'sfx', note: 'Music-box ding motif B5 E6' },
      { t: b(31), kind: 'sfx', note: 'Chord lifts to Gmaj7/B: the smile' },
      { t: b(32), kind: 'hit', note: 'Full groove returns bigger, crash; whooshes on 8ths for arrivals' },
      { t: b(34), kind: 'cut', note: 'Groove continues, riser toward the button' },
      { t: b(36), kind: 'hit', note: 'Sudden thinning: sub pulse and a held A5 tension tone; steps stop' },
      { t: b(38), kind: 'swell', note: 'Reverse swell to the press, tension tone climbs' },
      { t: b(40), kind: 'hit', note: 'THE press: huge tactile click, then near silence' },
      { t: b(43.25), kind: 'sfx', note: 'Barely audible sub breath as his eyes meet the camera' },
      { t: b(44), kind: 'swell', note: 'Pull-back: rushing reverse whoosh + rewind glide landing at 31.333' },
      { t: b(47), kind: 'sfx', note: 'The opening ambient pulse returns, very low' },
      { t: b(48), kind: 'cut', note: 'Silence' },
      { t: b(50), kind: 'hit', note: 'One clean notification ding (same as 5.333), dry, centre' },
    ],
  };
})();
