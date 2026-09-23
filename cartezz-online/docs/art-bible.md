# Art bible: CARTEZZ // ONLINE

The visual rules every scene follows.
Where this file and a scene brief disagree on a colour, weight or rule, this file wins.
Where this file and `docs/storyboard.md` disagree on a position or a time, the storyboard wins.

Sections 1 to 9 were rewritten from `docs/reference-analysis.md` (this film replaces the paper/blueprint house style with a dark late-night internet look). Sections 2.2 and 10 are the subject sections.

## 1. Frame

The canvas is 1080 px wide and 1920 px tall at 24 fps.
Every pixel value in this file assumes that size.
The origin is the top-left corner and y grows downward.

### 1.1 Shorts safe area

Anything the viewer must read (Cartezz, the profile card, the ONLINE button's word, notification counts, the end title) sits inside x 60 to 940 and y 220 to 1540.
Backgrounds, buildings, sky objects, fog, particles and grain run full bleed.
If a composition collides with the safe area, move the scenery — never the must-read content.

### 1.2 Composition for a tall frame

Compose for the height. The city is tall: towers rise out of the top of frame, the street runs up the middle to a vanishing point.
The frame centre line x = 540 is the default axis. City shots use one-point perspective with the vanishing point on x = 540.
Cartezz is either monumental (bust, 60–80% of frame height) or tiny against scale (3–12% of frame height). Nothing in between except the press.

## 2. Palettes

Names below are keys of `FILM.lib.pal`. Colour is mostly value: near-black to dark gray, lit by a few purple and white sources.
Gradients are allowed on this film (glows, fog, metal, light cones) — they are how light is drawn in the dark.

### 2.1 Engine palette

The paper and blueprint keys from the foundation stay in `lib.pal` for the tools, but no scene in this film uses the paper plate colours.
The only foundation keys a scene may use are `magenta` (never, see 2.2 `hot`) and none else — use the 2.2 names.

### 2.2 Subject palette (dark internet)

| Name | Hex | Use |
|---|---|---|
| void | #040306 | Base black of every frame |
| voidLift | #09080D | Upper-frame lift, card interior |
| haze | #15121D | Distance fog colour, far skyline |
| hazeViolet | #1D1430 | Fog near purple light sources |
| steel | #17161D | Building faces in shadow |
| steelLit | #25232D | Building faces toward light |
| steelEdge | #3A3746 | Hairline edges, UI outlines, grid |
| ash | #5E5A6B | Secondary UI bars, dim text |
| mist | #A7A2B8 | UI text, handle, "online" label |
| bone | #ECE8F4 | Primary text, brightest whites, window sparks |
| violetDeep | #3B1A78 | Deep purple (cap shadow, bow shadow) |
| violet | #7C3AED | Primary purple: the cap, the bow, the online dot core ring |
| violetMid | #9D6BFF | Neon trim, notification glow, rim light |
| violetHot | #C9A8FF | Brightest purple: glow cores, pressed ONLINE text halo |
| violetInk | #221040 | Purple-tinted black (shadows inside glows) |
| coat | #0C0B10 | Cartezz's coat and trousers |
| coatFold | #1C1A24 | Coat folds, seams, shoe tops |
| skinShadow | #2B2124 | Face in the cap's shadow |
| skinLit | #6E5A5C | Jaw / cheek catching rim light (front view only) |
| shirt | #1F1D26 | Shirt V under the lapels |
| hot | #F5EEFF | One-frame white-violet flashes (press, world break) |

### 2.3 Identity tints

- `violet` is Cartezz's identity (cap, bow tie, the online dot).
- `violetMid` is the world's light (neon, notifications, rim light).
- `bone` is information (text, UI sparks).
A frame never uses more than these three light colours plus `hot`.

## 3. Line

All widths are at 1080 px wide.

| Element | Width | Colour and opacity |
|---|---|---|
| UI hairline (card border, pills) | 1.5 px | steelEdge 100% |
| UI accent ring (avatar ring) | 2.5 px | violet 90% + outer 1 px violetMid 35% |
| Corner brackets ("classified" system) | 1.5 px, arms 22 px | ash 70% |
| Building edges | 1 px (scaled by distance, min 0.6) | steelEdge 60–90% |
| Neon trim | 2 px core + glow | violetMid 90% |
| Cartezz rim light | 2–3 px (at 400 px figure height) | violetMid, strongest on the side facing the light |

## 4. Tone

### 4.1 Light
Light comes from **the ONLINE button** (end of the street, low, purple-white) and from neon trim and UI glows.
Faces of buildings are lit by distance to the button: `steelLit` near it, `steel` far away, fading to `haze` with distance (fog).
Cartezz is always rim-lit from the direction of the button; in back views he is a silhouette with a violet outline.

### 4.2 Fog
Fog blends every 3D colour toward `haze` by `1 - exp(-d / 140)` (d = distance in metres), capped at 0.92.
Near the button the fog tints toward `hazeViolet`.

### 4.3 Grain and boil
`core` lays the fine dark schematic grain over every shot, re-seeded on the 12 fps boil clock.
From the press (T = 26.667) until the end of the pull-back the grain clock is **held** — the grain itself freezes (timeline `post: { holdAt }`).
Scenes do not add their own full-frame grain.

### 4.4 Glow
Glows are radial gradients drawn additively (`lighter`). A glow halo radius is 4–8× its core. Glows never cover more than a quarter of the frame except the ONLINE button in shots 12–15.

## 5. The two plates

### 5.1 Screen plate (shots 01–06, 16 end, 17)
Flat, orthographic. `void` base, a faint radial lift centred on the card (voidLift at 60% to void at the edges).
The phone world: a status row at y 250 (`3:07` left at x 120, three signal bars and a battery glyph right at x 960 − …), hairline corner brackets at the four corners of the safe area (the "classified system").
UI elements are crisp: no wobble. Faint scanline shimmer (1 px lines every 6 px at 3% alpha) over the card only.

### 5.2 City plate (shots 07–15, 16 start)
One shared 3D world (section 10.5) drawn by `FILM.kit.city`. Real perspective, fog, rim light. The UI language survives as architecture: towers of stacked cards, facades of list rows, antenna tips with online dots.

## 6. Overlays

Overlays are UI, never annotation. Allowed: corner brackets, tiny tick rails, focus rings around the thing that matters (1.5 px ash or violetMid, pop with outBack over 3 frames), count badges. At most two overlays at once. City shots carry almost none — the city *is* UI.

## 7. Motion

### 7.1 On twos
Cartezz moves on twos (`lib.onTwos`). Floating objects, lights, camera and UI pops run at 24 fps.

### 7.2 Timing
90 bpm: beat = 0.6667 s = 16 frames; 8th = 8 frames; 16th = 4 frames; bar = 2.6667 s = 64 frames.
Every pop, cut and hit lands on a beat, 8th or 16th, exactly on the frame. UI pops use outBack over 3 frames with 6–10% overshoot. Draw-ons use outExpo over 6 frames. Camera moves ease with inOutSine / inOutCubic and may run for a whole shot.
Floating objects drift slowly (spin ≤ 0.35 rad/s, bob ≤ 0.6 m at 0.2–0.4 Hz). Nothing bounces.

### 7.3 Determinism and the freeze
Seed every random choice from `lib.hash(...)`. All world motion is a function of **city time** `Tc = min(T, T_PRESS)` with `T_PRESS = 26.6667` (`FILM.kit.cityTime(T)`). After the press nothing that belongs to the world changes; only the camera moves.

## 8. Match cuts

- **G1 profile card** — shots 01, 04, 06 (start), 16 (end) put the card on exactly the same pixels.
- **G2 avatar content** — the avatar circle always shows the city from camera `CAM_AVATAR` at city time `Tc`. Shots 02 and 16 render it the same way.
- **G3 city layout** — every city shot draws the same `FILM.kit.city` world; only the camera changes.

## 9. Wordmark / end title

The end title is `CARTEZZ // @MURTHERED`, drawn with `lib.text`, 50 px, weight 500, letter-spacing 0.28 em, `bone` for `CARTEZZ`, `ash` for `//`, `violetMid` for `@MURTHERED`, centred on x = 540, baseline y = 968. It appears on shot 17 only.

## 10. Subject reference

Sources checked on 23 Sep 2026: the director's brief (written identity of Cartezz's profile). The profile screenshot referenced by the brief was not received; see `docs/reference-analysis.md`.

### 10.1 Cartezz (the character)

Height 1.85 m. Drawn only by `FILM.kit.cartezz(ctx, x, y, h, pose)` where (x, y) is the screen point between the feet and h the figure height in px.

| Part | Rule (fractions of h, measured from the feet up) |
|---|---|
| Coat | long black coat (`coat`), hem at 0.30, shoulders at 0.80, shoulder width 0.25, hem width 0.26, raised collar to 0.86 |
| Legs | trousers `coat`, visible from 0.30 to 0.035; shoes 0.035 tall, `coatFold` tops |
| Head | 0.115 tall, 0.085 wide, top of skull at 0.985 |
| Cap | purple baseball cap (`violet`), dome from 0.93 to 1.0, 0.1 wide; brim 0.075 long pointing forward; `violetDeep` under-brim; a thin `violetHot` highlight on the dome's lit side; small button on top |
| Bow tie | `violet` bow tie at the collar (front view only), 0.055 wide, knot `violetDeep` |
| Face | always in the cap's shadow: `skinShadow`; only the jaw and one cheek take `skinLit` in front view |
| Rim light | `violetMid` outline, stronger on the side toward the light |

Poses: `back` (walking away), `front` (standing, facing camera), `bust` (front, chest up, head turn and eye glints for shot 15). He walks with a calm 0.9 s stride cycle (2.2 steps/s), arms swinging slightly, no bounce beyond a 1% bob.

### 10.2 The purple bow (motif)

A ribbon bow: two rounded loops (each 0.42 of total width, tilted 12° up), a knot square 0.16 wide, two tails hanging 0.45 below at ±20° with a V-notch. Fill `violet`, inner loops `violetDeep`, a `violetHot` highlight stripe along the top of each loop. Drawn only by `FILM.kit.bow`.

### 10.3 The purple cap (motif)

A baseball cap seen at any yaw: dome (half-ellipse 1.0 wide × 0.62 tall), six-panel seams (two visible), top button, brim (ellipse 0.9 × 0.25) that swings around with yaw. Fill `violet`, brim underside `violetDeep`. Drawn only by `FILM.kit.cap`.

### 10.4 UI glyphs

- **Profile card** — G1 in the storyboard.
- **Notification pill** — rounded pill 520 × 96 px at scale 1, `voidLift` fill, 1.5 px `steelEdge` border, a 36 px `violet` bell circle at left with a white bell glyph, two `ash` bars (240 and 150 px), a 10 px `violetMid` unread dot at right, and a soft `violetMid` glow under it. `FILM.kit.notif`.
- **Online dot** — core `violet` r, bright centre `violetHot`, 1 px ring `violetMid` at 1.8 r, halo 5 r. `FILM.kit.onlineDot`.
- **Gift** — a cube box (`steelLit` faces, `violet` ribbon cross) with a bow on top. `FILM.kit.gift`.
- **Bell** — a notification bell glyph in `bone` or `violetMid`. `FILM.kit.bell`.
- **Count badge** — `violet` pill, `bone` digits, 30 px text.

### 10.5 The city (shared 3D world)

World units are metres. x right, y up, z forward down the street (away from the opening camera). Ground at y = 0.
- **Street**: centreline x = 0, road half-width 9 m, sidewalks to 12 m. The street runs from z = −60 to the plaza at z = 200.
- **Towers**: both sides of the street from |x| = 12 to 60, z −60 to 250, heights 18–140 m, seeded. Each tower is a stack of card slabs (4–9 m tall) with 0.8 m gaps. Street-facing faces carry a feed of list rows (dot + long bar + short bar) every 2.6 m. Some tops carry an antenna with an online dot. Some slabs carry a 2 px neon edge in `violetMid`.
- **Plaza and button**: the street opens at z 200 into a plaza. The **ONLINE button** stands on the centreline, face plane at z = 220, a pill 24 m wide × 10 m tall, bottom at y = 0.6, in a dark bezel 26 × 12 m, 3 m deep. The word ONLINE is 4.4 m tall, `bone` with `violetHot` halo; a 1.4 m online dot left of the word. Before the press the face glows and breathes on every beat; pressed, the face recesses 0.6 m and the glow locks at full.
- **Sky**: `void` to `voidLift`, a faint enormous ring arc (the avatar's edge, seen from inside) at 4% alpha, far skyline blocks in `haze`.
- **Searchlights**: four beams from tower tops sweeping slowly; freeze with the world.
- **Floating objects**: 64 seeded objects (bows, caps, notification pills, gifts, bells, online dots) in the volume x −40..40, y 10..90, z −20..215. Each has an arrival time between T 10.9 and 24.0 (they materialize with a glitch-slice pop); later arrivals are larger (up to 30 m bows). Online dots (small, 0.5–1.2 m) drift upward as particles.
- **Cartezz in the city**: shot-owned position on the street (see storyboard), always on the ground at x ≈ 0.

### 10.6 Mistakes to avoid

- A purple-filled frame or purple sky — **purple is only light and motif**; the frame stays black and gray.
- A goofy Cartezz (big eyes, grin, cartoon proportions, bouncing walk) — **he is a composed, tall silhouette, face in shadow, calm stride**.
- Random particle fields — **every small light is an online dot, a UI spark in a window, or a notification**; nothing is generic sparkle.
- Different cap or bow drawings in different shots — **always call the kit functions**.
- A city that changes between shots — **always draw `FILM.kit.city`**; move the camera, not the buildings.
- Anything moving after the press (spinning objects, blinking windows, drifting particles, boiling grain) — **use `kit.cityTime(T)` and the held grain**; only the camera moves in shots 14–16.
- The avatar looking like a portrait in the opening — **it is a dark round window with a few points of light**; it must read as abstract until the reveal.
