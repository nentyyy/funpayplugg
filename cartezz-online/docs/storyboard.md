# Storyboard: CARTEZZ // ONLINE

## Logline

Late at night Cartezz's Telegram profile starts receiving gifts — one, then another, then hundreds — until the profile unfolds into an enormous city of interface, where he walks, stops to admire his own profile in the sky, and presses a giant ONLINE button that freezes everything; the camera pulls back and the whole city was inside his avatar all along, and it still says `2 online`.
Every pixel is drawn by JavaScript on a canvas and every sound is synthesised in Web Audio, from one shared world model (`src/kit.js`) so the city, the character and the gifts are identical in every shot.

## Numbers

- 90 bpm → beat 0.6667 s = 16 frames; 8th = 8 frames; 16th = 4 frames; bar 2.6667 s = 64 frames.
- 13 bars of 4/4 = 34.6667 s = 832 frames at 24 fps, 1080 × 1920.
- 17 shots, each 1.3333 s (2 beats) or 2.6667 s (1 bar).
- In code, times are written as multiples of `B = 60 / 90` so every boundary is exact on the frame grid. Below, times are shown to 3 decimals.

## Summary

| Order | Id | Start | End | Plate | Title |
|---|---|---|---|---|---|
| 01 | profile-boot | 0.000 | 2.667 | screen | The profile wakes in the dark |
| 02 | avatar-macro | 2.667 | 4.000 | screen | The avatar, too close |
| 03 | online-macro | 4.000 | 5.333 | screen | 2 online |
| 04 | first-gift | 5.333 | 8.000 | screen | One notification. Then another |
| 05 | gift-flood | 8.000 | 9.333 | screen | Dozens |
| 06 | gifts-materialize | 9.333 | 10.667 | screen | The gifts become objects |
| 07 | world-breaks | 10.667 | 13.333 | screen → city | The profile unfolds into a city |
| 08 | city-reveal | 13.333 | 16.000 | city | Cartezz in the city |
| 09 | walk-street | 16.000 | 18.667 | city | He walks |
| 10 | awe | 18.667 | 21.333 | city | He sees himself |
| 11 | profile-sky | 21.333 | 22.667 | city | His profile over the city |
| 12 | button-approach | 22.667 | 25.333 | city | ONLINE |
| 13 | button-press | 25.333 | 26.667 | city | The press |
| 14 | freeze | 26.667 | 28.000 | city | Everything stops |
| 15 | look | 28.000 | 29.333 | city | He looks at us |
| 16 | pull-back | 29.333 | 32.000 | city → screen | It was inside the avatar |
| 17 | end-title | 32.000 | 34.667 | black | CARTEZZ // @MURTHERED |

Timeline `mode`: every shot is `schematic` (the engine's fine dark grain); shot 17 uses `mode: 'none'`. The plate lives in the extra field `plate`.

## Structure

- **Act 1 — The profile (bars 1–2, 0–5.333).** Silence and a pulse. The profile assembles, the avatar is looked at too closely, `2 online` blinks. Tension by stillness.
- **Act 2 — The notification (bars 3–4, 5.333–10.667).** One ding. Another. Then a flood; the four gifts materialize around the profile as real objects.
- **Act 3 — The world breaks (bar 5, 10.667–13.333).** On the bar-5 downbeat the profile tilts down into a ground plane and its tiles rise as towers; the city grows to the horizon.
- **Act 4 — Cartezz walks (bars 6–8, 13.333–21.333).** A lone figure in a monumental street. Absurd giant gifts arrive one by one. At 18.667 his own profile flickers on in the sky; he stops, looks up — surprised, then admiring (the director's added beat).
- **Act 5 — The button (bars 9–10, 21.333–26.667).** Absurdity peaks (profile-sky), then the giant ONLINE button, the approach, the pause, the press — which lands on the bar-11 downbeat, 26.667.
- **Act 6 — Everything stops (bar 11, 26.667–29.333).** The world freezes on the press frame. Silence. He looks at the camera.
- **Act 7 — The reveal (bars 12–13, 29.333–34.667).** A rapid pull-back up the street, into the avatar circle, out to the profile. `2 online`. Cut to black. Title. One ding.

- **Match cuts / continuity:** 01 ↔ 16-end: the profile on G1 pixels. 02 ↔ 16: avatar content is the city from `CAM_AVATAR` (G2). 06 → 07: the gift bubbles on G1 positions become the first giant objects. 12 → 13 → 14: Cartezz at z 219.3 in front of the button.
- **Scale devices:** 07 descend from profile to street; 16 one continuous pull from his face to the whole profile (scale ×≈ 900).
- **Time device:** the status clock reads `12:14` in 01 and still `12:14` at the end of 16 — nothing happened, and everything did.
- **Loop:** the last profile frame of 16 is the first frame of 01's settled state; the final ding answers the first.

## Conventions

- `T` global seconds, `t` shot-local (t = T − start). All times below are global.
- City cameras use `FILM.kit.cam({ pos:[x,y,z], yaw, pitch, f })`: yaw 0 looks down +z, positive yaw turns toward +x; pitch positive looks up; f = focal length in px (vertical fov = 2·atan(960/f)). The principal point is the frame centre (540, 960).
- The world freezes at `T_PRESS = 26.6667` (`FILM.kit.T_PRESS`): all world motion uses `FILM.kit.cityTime(T)`.
- Palette names from the art bible; drawings of Cartezz, the gifts, the profile and the city come only from `FILM.kit`.
- Hard cuts by default; the incoming shot owns any `transitionIn`.
- Scenes clamp t past their duration.

## Shared geometry

### G1: the profile screen (`FILM.kit.profile(ctx, o)`)

All positions in frame pixels. Drawn identically in 01, 04, 05, 06 (start), 07 (start) and 16 (end).

| Element | Geometry |
|---|---|
| Phone frame | rounded rect x 30–1050, y 140–1780, r 72, 1.5 px steelEdge 55% |
| Header | radial gradient centre (540, 540), charcoal → charcoalLow (r 420) → void (r 880); leaf pattern 4% over y 150–1150 |
| Status | `12:14` x 96, baseline 258, 44 px w600 bone; bed glyph x 228–276, y 232–258; signal x 760–812, wifi x 828–876, battery x 890–946 y 234–262 with `37` |
| Back button | circle (140, 372) r 50, tile; chevron bone |
| Edit | pill x 790–936, y 324–420, tile; `Edit` 40 px bone centred x 863, baseline 386 |
| Avatar | circle centre (540, 540), r 160; ring 2.5 px violet 90% + 1 px violetMid 35% at r 165 |
| Gift bubbles | r 58: g1 white cap (315, 455) slate · g2 bow tie (290, 640) pink · g3 purple cap (148, 770) pink · g4 tamagotchi (765, 455) slate · g5 bow tie (888, 575) pink · g6 tamagotchi (790, 650) slate |
| Name | `cartezz` 100 px w600 bone, centred x 520, baseline 840; gold badge centre (745, 805), 56 px |
| Presence | white square x 428–474, y 872–918, r 10, `2` 34 px w700 void; `online` 56 px mist at x 490, baseline 912 |
| Action tiles | y 975–1135, w 196, x 124 / 336 / 548 / 760, r 34, voidLift; icon centre y 1038; labels `call` `unmute` `search` `more` 30 px bone baseline 1106 |
| Music row | baseline 1205, centred x 540: `♫ twerk - cartezz ›` (`twerk` w600 bone, rest mist), 34 px |
| Username card | x 70–1010, y 1255–1405, r 56, tile; `username` 34 px bone at x 120 baseline 1318; `@murthered` 46 px link at x 120 baseline 1378; QR glyph centre (950, 1330) 52 px link |
| Tabs | pill x 70–1010, y 1440–1520, charcoalLow; active x 80–360; `Gifts` x 110, `Media` 440, `Voice` 610, `Links` 780, baseline 1492, 36 px |
| Fade | void 0 → 1 from y 1450 to y 1640 (the profile dissolves into darkness) |
| Brackets | corners of the safe area (60, 220), (940, 220), (60, 1540), (940, 1540), arms 22 px |

### G2: the avatar (`FILM.kit.avatar(ctx, cx, cy, r, T)`)

The avatar shows the city from `CAM_AVATAR = { pos: [0, 34, 152], yaw: 0, pitch: −0.39, f: 1300 }` at city time `cityTime(T)`, the city frame mapped into the circle with k = r / 1101.2 (1101.2 = half-diagonal of the frame, so the whole frame is inscribed), clipped to the circle, centre of frame → centre of circle. At camera zoom Z = 1101.2 / r about the avatar centre, the avatar's content lands exactly on the full-frame render from `CAM_AVATAR` — the handoff of shot 16.

### G3: the city (`FILM.kit.city(ctx, cam, T, o)`)

Art bible 10.6. Fixed anchors every scene can rely on:

| Anchor | World position |
|---|---|
| Street centreline | x = 0, road |x| ≤ 9, sidewalk to 12 |
| ONLINE button face | z = 220, x −12..12, y 0.6..10.6; bezel 26 × 12, depth 3 |
| Cartezz at the button | (0, 0, 219.3), facing +z |
| Hologram profile | centre (0, 40, 140), 30 × 53.3 m, facing −z, on from T 18.0 (flicker) to full at 18.667 |
| Cartezz, shot 08 | (0, 0, 34) standing, facing +z; first step at 15.333 |
| Cartezz, shot 09 | walking z = 60 + 1.45·(T − 16.0), facing +z |
| Cartezz, shots 10–11 | stopped at (0, 0, 63.9) |
| Cartezz, shot 12 | walking z = 216.9 + 1.8·(T − 22.667) until 24.0 (z 219.3), then still |

### G4: cameras

| Shot | Camera |
|---|---|
| 08 | pos (0, 1.1, 18) → (0, 1.1, 20.5), yaw 0, pitch 0.20, f 1050 |
| 09 | pos (0, 1.55, zH − 4.2), yaw 0, pitch 0.10, f 1400 (tracking) |
| 10 | background only: pos (3.2, 1.9, 64.2), yaw −1.75 (looking across the street behind him), pitch 0.25, f 1100 |
| 11 | pos (1.5, 0.6, 58.5), yaw −0.02, pitch 0.62, f 950 |
| 12 | pos (0, 2.2, 190) → (0, 2.0, 194), yaw 0, pitch 0.12, f 1150 |
| 13 | pos (1.4, 1.5, 216.9), yaw −0.28, pitch 0.18, f 1300 |
| 14 | pos (−16, 7.5, 186), yaw 0.42, pitch 0.02, f 1050 (locked) |
| 15 | background: pos (−0.9, 1.62, 214.6), yaw 0.1, pitch 0.05, f 1100; the head is screen-space |
| 16 | from 15's background camera → CAM_AVATAR (3D), then a 2D zoom Z 6.88 → 1 into G1 |

---

## 01 profile-boot: The profile wakes in the dark

T 0.000 to 2.667, screen plate, cut (film start).

### Composition
Black. The phone world assembles on G1 and holds, a tiny object floating in darkness: the whole screen is scaled 0.86 about (540, 900) at the start and settles to 1.0 by the end (the camera slowly approaches).

### Forms
G1 elements, built in order. The avatar shows the dark city (G2) — a black disc with a faint purple glow near its centre and a few tiny points of light.

### Overlays
The four corner brackets draw on first (the "classified system"), then a thin scan line sweeps down once over the screen at T 1.333–2.0 (bone 8%).

### Motion
- T 0.000: black, one online-dot spark (violetHot, r 4) at the avatar centre (540, 540).
- T 0.333 (8th): corner brackets draw on (outExpo 6 frames).
- T 0.667 (beat 2): the phone frame hairline draws around (outExpo over 8 frames); the header gradient fades up over 12 frames.
- T 1.333 (beat 3): the avatar ring draws clockwise from 12 o'clock (outExpo 8 frames); the avatar content fades in.
- T 1.667 (8th): status row pops (outBack 3 frames).
- T 2.000 (beat 4): `cartezz` types on 16ths (a letter every 2 frames), badge pops at 2.25; presence square pops at 2.333 with `online`.
- T 2.333–2.667: action tiles, music row, username card and tabs fade up in a quick cascade (4 frames apart). Gift bubbles are **not** there yet (they arrive with the notifications).

### Camera
Scale 0.86 → 1.0 about (540, 900), inOutSine over the whole shot.

### Enter and exit
Film start. Exits on the full profile at scale 1.0 — G1 exactly.

### Subject
The profile layout, status time `12:14` with the Sleep bed glyph, `2 online`, `@murthered` in link blue.

### Sound
- T 0.000: a dark ambient bed fades in (low pad on D, very quiet) and a sub pulse (heartbeat kick, felt) on every 2nd beat from here to 5.333.
- T 0.333: a soft tick (UI) for the brackets.
- T 0.667: a low glass tone D4 as the phone frame draws.
- T 1.333: a soft sine bloom A4 as the avatar ring draws.
- T 2.000: seven tiny key-clicks on 16ths for the letters.

---

## 02 avatar-macro: The avatar, too close

T 2.667 to 4.000, screen plate, cut.

### Composition
Extreme close-up of the avatar: the avatar circle fills the frame width (circle radius ≈ 470 px on screen at (540, 900)); the ring is a thick violet arc crossing the frame edges.

### Forms
`FILM.kit.avatar` drawn large (r 470 at (540, 900)) — the dark city: towers as faint vertical strokes, the purple glow at the end of the street, points of light. It must stay ambiguous: dark, beautiful, unreadable. Small UI ticks around the ring (a focus rail: 48 ticks, ash).

### Overlays
A focus ring (1.5 px violetMid) pops at T 3.333 around the purple glow, then fades.

### Motion
- T 2.667: very slow push (r 470 → 520).
- T 3.333 (beat 2): focus ring pops on the glow at the heart of the avatar; the glow breathes once.

### Camera
Push, scale ×1.1 over the shot, inOutSine.

### Enter and exit
From 01's full profile to this macro — hard cut. Exits on the glow.

### Subject
The avatar is the city (G2) — the audience does not know yet.

### Sound
- T 2.667: the pad swells slightly; a low drone D2 enters under it.
- T 3.333: a single soft pitched pulse (sine A3, long tail) for the focus ring.

---

## 03 online-macro: 2 online

T 4.000 to 5.333, screen plate, cut.

### Composition
Macro on the presence element: the white `2` square and `online` enlarged ×3.2 about (540, 895) — the square ≈ 147 px, `online` running off to the right; below it, blurred-dark hints of the action tiles.

### Forms
`FILM.kit.presence` at ×3.2. A thin tick rail along the bottom (ash).

### Overlays
Corner brackets at a tight frame around the `2` (outBack pop at 4.0).

### Motion
- T 4.000: brackets pop around the `2`.
- T 4.667 (beat 2): the `2` blinks once (the square dims to 30% for 4 frames and returns) — like a heartbeat. Nothing else moves. Tension.

### Camera
Almost locked: drift ×1.0 → 1.03.

### Enter and exit
Cut in; exits on stillness, the `2`.

### Subject
`2 online`: a white rounded square with the digit, the word in grey.

### Sound
- T 4.000: a soft blip (sine E5, very short).
- T 4.667: the blip again, lower (B4) with the blink. The pulse continues. Then 5.333 lands.

---

## 04 first-gift: One notification. Then another

T 5.333 to 8.000, screen plate, cut.

### Composition
The full profile on G1. Notifications drop in over the header just under the status row (centred x 540, landing at y 300, older ones compressing into a thin stack above) and gift bubbles begin to appear at the G1 bubble positions.

### Forms
`FILM.kit.notif` pills (width 620, height 104) centred x 540. Each carries a gift icon (in order: bow tie, purple cap, tamagotchi, white cap). Count badge (violet pill with `bone` number) at the avatar's top-right (660, 410).

### Overlays
The count badge. A focus ring flashes around each newly arrived gift bubble.

### Motion
- T 5.333 (bar 3): **notification 1** slides down from y 150 to y 300 (outBack over 4 frames), glow pulses; badge pops `1`; gift bubble g2 (bow tie) blooms at (290, 640).
- T 6.000: notification 1 slides up into a thin stack line.
- T 6.667 (beat 3): **notification 2**; badge `2`; bubble g3 (purple cap) blooms.
- T 7.333 (beat 4): notification 3, badge `3`; bubble g4 (tamagotchi).
- T 7.667 (8th): notification 4, badge `4`; bubble g1 (white cap).
- Each arrival nudges the whole screen down 3 px for 2 frames (a micro-jolt).

### Camera
Locked at G1.

### Enter and exit
Enter on G1 pixels. Exit with four notifications stacked and four bubbles present.

### Subject
The profile's gift bubbles (glow disc + gift + four-point sparkles) exactly as on the real profile.

### Sound
- T 5.333: **the notification sound** — a clean two-note ding, E6 then B6 (FM bell + glass), panned centre. This exact sound returns at 33.333.
- T 6.667: the ding again, slightly left.
- T 7.333: ding (right), 7.667: ding (left), smaller.
- The heartbeat pulse continues; a quiet hat enters on 8ths at 6.667.

---

## 05 gift-flood: Dozens

T 8.000 to 9.333, screen plate, cut.

### Composition
The profile on G1, now under a flood: notification pills pour down in a fanned, slightly perspective stack behind and over the header; the count badge climbs.

### Forms
~40 notification pills (scaled 0.5–1.0, alpha by depth), each with one of the four gifts; count badge `4 → 12 → 48 → 99+ → 999+`.

### Overlays
Count badge only.

### Motion
- T 8.000 (bar 4): pills begin arriving on every 16th (4 frames), each from above, stacking and sliding down, older ones dimming into the darkness below.
- T 8.333, 8.667, 9.0: badge jumps `12`, `48`, `99+`; at 9.167 `999+`.
- The remaining bubbles g5 and g6 bloom at 8.333 and 8.667.

### Camera
A slow push ×1.0 → 1.06 about the avatar (540, 540).

### Enter and exit
Cut from 04 (G1). Exits with the header buried in light and pills.

### Subject
Gifts arrive as notifications; the six bubbles on the profile are complete.

### Sound
- T 8.000: dings on every 16th, pitch-varied across E-major pentatonic (E6 F#6 G#6 B6 C#7), panned randomly (seeded), getting denser; hats on 16ths; sub pulse on every beat.

---

## 06 gifts-materialize: The gifts become objects

T 9.333 to 10.667, screen plate, cut.

### Composition
The profile on G1, pills cleared; the six gift bubbles now **materialize** as solid objects: each gift grows out of its bubble (×1 → ×2.4), rotates in 3D (yaw), and new copies spawn around the profile — bow ties, caps, tamagotchis — orbiting the avatar in a ring (radius 300–420 px).

### Forms
Kit gift glyphs, drawn larger with glitch-slice build-up (horizontal slices offset then snapping into place over 6 frames).

### Overlays
None.

### Motion
- T 9.333 (beat 1): the pills sweep up and out; each bubble's gift snaps to solid (glitch-slice) on consecutive 16ths.
- T 10.0 (beat 2): 18 more gifts spawn on 16ths around the avatar ring, orbiting.
- T 10.333–10.667: everything is sucked toward the avatar centre (inCubic), the screen brightens slightly — the breaking point.

### Camera
Push ×1.06 → 1.25 about (540, 540), inCubic toward the end.

### Enter and exit
From the flood to objects. Exits on maximum tension one frame before the break.

### Subject
The four profile gifts as real objects.

### Sound
- T 9.333: a glassy shimmer, glitch granular clicks as each gift solidifies.
- T 10.0: a reverse swell (revSwell) builds from 10.0 to the hit at 10.667; the riser rises a fifth.

---

## 07 world-breaks: The profile unfolds into a city

T 10.667 to 13.333, screen → city, `transitionIn: flash (hot, 0.083 s)`.

### Composition
On the downbeat a white-violet flash. The profile (G1, as a flat texture) tilts backward about its lower edge and lies down as the ground plane; the camera drops toward it; the action tiles and the username card extrude upward into the first dark towers; then towers rise out of the ground in a wave running outward to the horizon; the gifts blown out of the avatar become giant objects in the sky. It ends on the city at street level, Cartezz a tiny silhouette standing at (0, 0, 34).

### Forms
The profile texture (G1) warped as a tilting plane (horizontal strip warp), the city via `FILM.kit.city` with `o.rise(tower)` growing tower heights, giant gifts.

### Overlays
None.

### Motion
- T 10.667 (bar 5): flash; the profile starts tilting (pitch 0 → 90° by 11.667, inOutCubic).
- T 11.333 (beat 2): the four action tiles extrude as towers; towers begin rising in a wave from the centre outward (each tower's rise begins at 11.333 + 0.015·distance, 0.6 s, outCubic).
- T 12.0 (beat 3): the profile texture has dissolved into the street; searchlights ignite.
- T 12.667 (beat 4): the camera settles near the start pose of shot 08.

### Camera
From the screen (orthographic G1) → 3D: the camera descends from (0, 60, −10) looking down (pitch −1.2) to (0, 1.1, 18) pitch 0.2, f 1050, inOutCubic 10.667 → 13.333.

### Enter and exit
Enters from 06's maximum push. Exits on the establishing street, near 08's first frame.

### Subject
The UI becomes architecture: tiles → towers; gifts → giant objects.

### Sound
- T 10.667: **the break hit**: sub drop (subDrop from D2), a low whump, a filtered noise crash and a glass-shard burst; the kick groove starts (full kick on 1 and 3).
- T 11.333: deep rising grinds (towers rising) — filtered noise swells; T 12.0: searchlight "thoom" (low gong); groove continues.

---

## 08 city-reveal: Cartezz in the city

T 13.333 to 16.000, city plate, cut.

### Composition
One-point perspective down the street: towers of dark tiles on both sides rising out of the top of frame, the street to a vanishing point, the ONLINE button's glow faint far away on the horizon. Cartezz stands on the centreline, back to us, small (≈ 150 px tall), rim-lit violet. A few giant gifts hang in the air.

### Forms
`kit.city`, `kit.cartezz` back view at (0, 0, 34).

### Overlays
None.

### Motion
- T 13.333: he stands still; online dots drift upward; searchlights sweep.
- T 14.667 (beat 3): a giant bow tie materializes above the street (arrival).
- T 15.333 (beat 4): he takes his first step (walk begins; steps land on the beats).

### Camera
Slow push (0, 1.1, 18) → (0, 1.1, 20.5), yaw 0, pitch 0.20, f 1050, inOutSine.

### Enter and exit
From 07's settle. Exits on his first steps.

### Subject
Long black coat, purple cap, long dark hair — the silhouette reads instantly.

### Sound
- T 13.333: bass ostinato enters (D minor, 8ths, warm saw through a lowpass), a dark pad; kick on 1 and 3; the notification ding appears as a melodic motif on offbeats, quiet.
- T 14.667: a deep whoosh for the arrival.
- T 15.333: first soft footstep (then every beat while he walks).

---

## 09 walk-street: He walks

T 16.000 to 18.667, city plate, cut.

### Composition
Tracking behind him at head height: his back (medium, ≈ 700 px tall), the street ahead, absurd giant gifts drifting overhead — a rotating purple cap the size of a building, bow ties, tamagotchis, notification pills as billboards — online dots drifting. He is completely calm.

### Forms
`kit.cartezz` back view, walking; `kit.city` with the tracking camera.

### Overlays
None.

### Motion
- He walks z = 60 + 1.45·(T − 16); a step every beat (16.0, 16.667, 17.333, 18.0).
- T 17.333 (beat 3): a white cap 20 m wide materializes ahead, spinning slowly.
- T 18.000 (beat 4): the hologram profile flickers on high ahead (upper frame): glitchy, then solid by 18.667; he slows.

### Camera
Tracking: pos (0, 1.55, zH − 4.2), pitch 0.10, f 1400; a slight lateral sway of 0.05 m.

### Enter and exit
From his first steps. Exits as the light of the hologram falls on him.

### Subject
Calm stride, coat swinging, hair moving slightly.

### Sound
- Groove: kick on 1 and 3, metallic tick on 2 and 4, bass 8ths, footstep each beat; ding motif.
- T 17.333: arrival whoosh.
- T 18.000: hologram flicker: electric crackle and buzz, a rising filtered swell.

---

## 10 awe: He sees himself

T 18.667 to 21.333, city plate, cut.

### Composition
Close-up in profile, facing screen right: his head (kit.head, s ≈ 560, centre ≈ (470, 820)) tilted up (pitch 0.3 → 0.36) toward the hologram of his own profile, which is off-frame top right; its cold violet-white light falls on the front of his face (light.front 1, wash 1). Behind him (screen left), the dark street and towers receding, dimmed; the hologram's glow spills into the top right corner with drifting online dots. A tiny reflection of the profile in his eye (glint).

### Forms
`kit.head` { dir: 1, turn: 1, body: 'side', pitch, expr, glint: true, wash }, `kit.city` background (camera from his side, dimmed 55%).

### Overlays
None.

### Motion
- T 18.667 (bar 8 beat 1): neutral, looking up; the light flickers twice as the hologram stabilises.
- T 19.333 (beat 2): surprise — brows 0 → 0.8, eyes 0 → 0.8 over 3 drawings on twos.
- T 20.000 (beat 3): lips part (mouth 0.5).
- T 20.667 (beat 4): a small admiring smile (smile 0 → 0.7, mouth → 0.15, brows settle 0.5); an online dot drifts up past his face.

### Camera
Very slow push (s 540 → 590), inOutSine.

### Enter and exit
From the hologram's light in 09. Exits on the smile.

### Subject
Admiring, dignified wonder of a young man seeing himself huge in the sky. Not comic.

### Sound
- T 18.667: the groove drops out; a warm open chord (Dmaj9: D3 A3 E4 F#4 C#5) swells on the pad; the hologram hum continues quietly.
- T 19.333: a gentle glass shimmer.
- T 20.000: the ding motif plays slow (B5 E6), like a music box.
- T 20.667: the chord lifts to Gmaj7/B.

---

## 11 profile-sky: His profile over the city

T 21.333 to 22.667, city plate, cut.

### Composition
Low angle behind him (small silhouette at bottom, ≈ 190 px tall, looking up): the giant hologram of his profile fills the upper-middle of the frame — avatar, `cartezz`, `2 online` — and around it the absurdity peaks: dozens of giant bow ties, caps and tamagotchis orbiting it, notification pills the size of buildings, searchlights crossing.

### Forms
`kit.city` (hologram on), `kit.cartezz` back view, head tilted up.

### Overlays
None.

### Motion
- T 21.333 (bar 9): the orbit of giant gifts accelerates slightly; new arrivals pop on 8ths (21.333 … 22.333).
- Everything drifts and rotates; he stands still, looking up.

### Camera
Pos (1.5, 0.6, 58.5), yaw −0.02, pitch 0.62, f 950; a slow crane up (y 0.6 → 1.2).

### Enter and exit
From his smile to what he sees. Exits at the peak of absurdity.

### Subject
His own profile, made monumental. The humour is the scale.

### Sound
- T 21.333: full groove returns bigger: crash, kick, bass, hats on 16ths, the ding motif as a lead line.
- New arrivals: short whooshes on 8ths.

---

## 12 button-approach: ONLINE

T 22.667 to 25.333, city plate, cut.

### Composition
Behind him in the plaza: the gigantic ONLINE button fills the middle of the frame (≈ 920 px wide), `ONLINE` in huge letters, its purple-white glow lighting the ground, giant gifts drifting around it. He walks toward it, a silhouette (≈ 380 px tall), and stops.

### Forms
`kit.city`, `kit.cartezz` back view (walking, then still).

### Overlays
None.

### Motion
- He walks z = 216.9 + 1.8·(T − 22.667) (steps on 22.667, 23.333).
- T 24.000 (bar 10): he stops. **Pause.** The button breathes on each beat (24.0, 24.667).

### Camera
Slow dolly (0, 2.2, 190) → (0, 2.0, 194), pitch 0.12, f 1150.

### Enter and exit
From the profile-sky peak to the button. Exits on the pause.

### Subject
The button: a pill with `ONLINE` and an online dot, gigantic.

### Sound
- T 22.667: groove continues with a riser.
- T 24.000: sudden thinning: only the sub pulse and a held tension tone (high A5 sine, quiet). Footsteps stop.

---

## 13 button-press: The press

T 25.333 to 26.667, city plate, cut.

### Composition
Over his right shoulder, medium: his silhouette (≈ 1000 px tall) against the glowing button face, which fills the frame; the letters of ONLINE huge and cropped above. His right arm rises forward; his palm reaches the surface on the last frames.

### Forms
`kit.cartezz` back view, `arm` 0 → 1; `kit.city` (the button's face).

### Overlays
None.

### Motion
- T 25.333: arm begins to rise (arm 0 → 1 by 26.5, inOutCubic on twos).
- T 26.500 → 26.667: palm meets the surface; the glow brightens around the hand.

### Camera
Pos (1.4, 1.5, 216.9), yaw −0.28, pitch 0.18, f 1300; a tiny push.

### Enter and exit
From the pause. Exits one frame before the press — cut on the action.

### Subject
His hand, the button, the light.

### Sound
- T 25.333: a reverse swell (revSwell) rising to 26.667, the tension tone climbing a semitone.

---

## 14 freeze: Everything stops

T 26.667 to 28.000, city plate, `transitionIn: flash (hot, 0.083 s)`, grain held.

### Composition
A locked wide from the side of the plaza: the pressed ONLINE button, locked at full glow; Cartezz tiny at its base, palm on the face; around them every giant gift, notification pill and online dot hangs perfectly still; the searchlight beams stopped mid-sweep.

### Forms
`kit.city` at city time T_PRESS, `kit.cartezz` (arm 1).

### Overlays
None.

### Motion
None. That is the shot. (The only change is the press flash clearing.)

### Camera
Locked: pos (−16, 7.5, 186), yaw 0.42, pitch 0.02, f 1050.

### Enter and exit
Cut on the press. Exits into his look.

### Subject
The freeze: objects, lights, particles and grain all stopped.

### Sound
- T 26.667: **the press**: one huge tactile click (a deep `tock` + a mechanical clack + sub thump) — then almost everything is removed: silence, with only a very faint high room tone fading out over 1 s.

---

## 15 look: He looks at us

T 28.000 to 29.333, city plate, cut, grain held.

### Composition
Close, from behind: his shoulders and the back of his cap and hair (kit.head body 'back', s ≈ 520, centre ≈ (540, 820)) against the glowing ONLINE button face (the frozen world, huge letters partly visible behind). He turns his head over his left shoulder into profile facing screen left, and his eye slides to the camera: a side-glance straight into the lens. Calm, a little knowing.

### Forms
`kit.head` { dir: −1, body: 'back', turn 0 → 1, gaze 0 → 1, light.front −1 (lit from behind by the button), rim 1 }, `kit.city` behind at city time T_PRESS.

### Overlays
None.

### Motion
- T 28.000: still, facing the button (turn 0).
- T 28.333 (8th): the head turns over the shoulder (turn 0 → 1, on twos, 10 drawings, inOutCubic) to 28.833.
- T 28.833: the eye slides to the camera (gaze 0 → 1 over 3 drawings).
- T 29.083: a single blink (2 drawings). Hold.

### Camera
Slow push (s 500 → 540), inOutSine; background camera pos (−0.9, 1.62, 214.6), yaw 0.1, f 1100 so the button's letters read behind him.

### Enter and exit
From the frozen wide to his glance. Exits on his eye meeting ours.

### Subject
The world is frozen; he is not.

### Sound
- Silence (only the faint tone tail). T 28.833: a barely audible low sub breath as his eye lands (−30 dB).

---

## 16 pull-back: It was inside the avatar

T 29.333 to 32.000, city → screen, cut, grain held.

### Composition
The camera pulls back rapidly: up and back along the frozen street, the city opening up beneath — towers, giant gifts, the button's glow — until the view settles on `CAM_AVATAR`; then the frame itself shrinks into a circle: the avatar of the profile (G2 → G1). The full profile on G1: the six gift bubbles, `cartezz`, `2 online`, `12:14`. Hold.

### Forms
`kit.city` (frozen), then `kit.profile` with `kit.avatar` inside.

### Overlays
None.

### Motion
- T 29.333–30.500: 3D pull from the end of 15 to CAM_AVATAR (position and angles interpolated on a log-distance curve, inOutCubic: starts slow, then rushes, then lands).
- T 30.250–31.333: 2D zoom about the avatar centre (540, 540) from Z 6.882 to 1 (inOutCubic): the city shrinks into the avatar circle; the profile appears around it.
- T 31.333–32.000: hold on G1. The `2` of `2 online` stays exactly as it was.

### Camera
As above. Z = 1101.2 / 160 = 6.882 at the handoff (G2).

### Enter and exit
From his gaze. Exits on the profile — cut to black.

### Subject
The city was inside the avatar the whole time. Still `2 online`.

### Sound
- T 29.333: a rushing reverse-air whoosh rising, with a tape-rewind glide down (pitch dive) — landing at 31.333.
- T 31.333: the opening's quiet ambient pulse returns for the hold (bookend), very low.

---

## 17 end-title: CARTEZZ // @MURTHERED

T 32.000 to 34.667, black (`mode: 'none'`), cut.

### Composition
Black. The end title centred on x 540, baseline y 968 (art bible 9). A tiny online dot to the left of the title (x 540 − title half-width − 30, y 953).

### Forms
Title text, online dot.

### Overlays
None.

### Motion
- T 32.000: black.
- T 32.667 (beat 2): the title fades in over 8 frames with a 6 px rise (outExpo).
- T 33.333 (beat 3): the online dot pops (outBack, 3 frames) — synced with the ding.
- Hold to the end.

### Camera
Locked.

### Enter and exit
Hard cut to black from the profile. End of film (loops to 01's black).

### Subject
The name and the handle.

### Sound
- T 32.000: silence.
- T 33.333: **one clean notification sound** — the same E6→B6 ding as 5.333, dry, centred, with a short tail. Nothing else.

---

## Appendix: from doc to code

`src/timeline.js` carries the shots above with `start`/`end` as exact multiples of `B`, and the cue list:

| t | kind | note |
|---|---|---|
| 0.000 | open | ambient bed + heartbeat pulse every 2 beats |
| 0.333 | sfx | bracket tick |
| 0.667 | sfx | glass D4, phone frame |
| 1.333 | sfx | sine bloom A4, avatar ring |
| 2.000 | sfx | key clicks on 16ths (name) |
| 2.667 | cut | drone D2 enters |
| 3.333 | sfx | soft pulse A3, focus ring |
| 4.000 | sfx | blip E5 |
| 4.667 | sfx | blip B4 |
| 5.333 | hit | notification ding E6→B6 (first) |
| 6.667 | hit | ding 2 |
| 7.333 | hit | ding 3 |
| 7.667 | hit | ding 4 |
| 8.000 | cut | flood: dings on 16ths, hats, sub each beat |
| 9.333 | sfx | shimmer + glitch clicks |
| 10.000 | swell | reverse swell to 10.667 |
| 10.667 | hit | world break: sub drop, whump, crash, glass burst; groove starts |
| 12.000 | sfx | searchlight thoom |
| 13.333 | cut | bass ostinato + pad |
| 14.667 | sfx | arrival whoosh |
| 15.333 | sfx | first footstep |
| 16.000 | cut | walk groove |
| 17.333 | sfx | arrival whoosh |
| 18.000 | sfx | hologram flicker |
| 18.667 | hit | groove drops; Dmaj9 swell |
| 19.333 | sfx | glass shimmer |
| 20.000 | sfx | music-box ding motif |
| 20.667 | sfx | chord lifts |
| 21.333 | hit | full groove + crash |
| 22.667 | cut | riser |
| 24.000 | hit | thinning: sub pulse + tension tone |
| 25.333 | swell | reverse swell to the press |
| 26.667 | hit | the press: huge click, then silence |
| 28.833 | sfx | sub breath (very quiet) |
| 29.333 | swell | pull-back whoosh + rewind glide |
| 31.333 | sfx | ambient pulse returns |
| 32.000 | cut | silence |
| 33.333 | hit | one clean notification ding |
