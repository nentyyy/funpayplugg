# Art bible: CARTEZZ // ONLINE

The visual rules every scene follows.
Where this file and a scene brief disagree on a colour, weight or rule, this file wins.
Where this file and `docs/storyboard.md` disagree on a position or a time, the storyboard wins.

Sections 1 to 9 were rewritten from `docs/reference-analysis.md`: this film replaces the paper / blueprint house style with a dark, late-night internet look taken from Cartezz's Telegram profile. Sections 2.2 and 10 are the subject sections.

## 1. Frame

The canvas is 1080 px wide and 1920 px tall at 24 fps. Every pixel value assumes that size. Origin top-left, y down.

### 1.1 Shorts safe area

Anything the viewer must read (Cartezz, the profile UI text, the ONLINE button's word, notification counts, the end title) sits inside x 60–940 and y 220–1540.
Backgrounds, buildings, sky objects, fog, particles and grain run full bleed. Move scenery, never must-read content.

### 1.2 Composition for a tall frame

Compose for the height. The city is tall: towers leave the top of frame, the street runs up the middle to a vanishing point on x = 540.
Cartezz is either monumental (face / bust: 45–90% of frame height) or tiny against scale (3–15% of frame height). Only the press (shot 13) sits in between.

## 2. Palettes

Names are keys of `FILM.lib.pal`. Colour is mostly value — near-black to charcoal — lit by a few purple and white sources.
Gradients are allowed on this film (glows, fog, metal, light cones, the charcoal profile header): they are how light is drawn in the dark.

### 2.1 Engine palette

The paper and blueprint keys of the foundation stay in `lib.pal` for the tools only. No scene uses them.

### 2.2 Subject palette (sampled from the profile, then graded darker)

| Name | Hex | Use |
|---|---|---|
| void | #040306 | Base black of every frame |
| voidLift | #09080D | Lifted black, card interiors in the city |
| charcoal | #2A2A2C | Top of the profile header gradient (screenshot #2D2D2D) |
| charcoalLow | #151516 | Header gradient low end, action tiles (screenshot #161717) |
| tile | #1B1B1D | Username card, Edit / back buttons (screenshot #1C1C1C) |
| haze | #15121D | Distance fog colour, far skyline |
| hazeViolet | #1F1533 | Fog near purple light sources |
| steel | #17161D | Building faces in shadow |
| steelLit | #26242E | Building faces toward light |
| steelEdge | #3A3746 | Hairline edges, UI outlines, ground grid |
| ash | #5E5A6B | Secondary UI bars, dim text |
| mist | #A3A0AD | UI grey text (`online`, labels) |
| bone | #F2F0F6 | Primary text, brightest whites, window sparks |
| link | #5186EF | `@murthered` and the QR glyph only (screenshot link blue) |
| violetDeep | #34186E | Deep purple: cap shadow, bow-tie shadow |
| violet | #6B2FD6 | Primary purple: caps, online dot ring, trim cores |
| violetMid | #9A6BFF | Neon trim, notification glow, rim light |
| violetHot | #D2B8FF | Brightest purple: glow cores, pressed ONLINE halo |
| violetInk | #1E0E3A | Purple-tinted black inside glows |
| bowtie | #432E74 | Bow-tie fabric (screenshot #422E72) |
| bowtieLight | #6A4FC4 | Bow-tie pattern / highlight |
| bowtieDark | #22174A | Bow-tie folds |
| star | #EDE25A | Gold star on the bow-tie knot (screenshot #ECF456, warmed) |
| gold | #DCBD3F | Gold collectible badge next to the name |
| capPurple | #6A2598 | Purple cap crown (screenshot #682397) |
| capPurpleLit | #9A5BD0 | Purple cap lit panel |
| capWhite | #C9CED6 | White cap crown (screenshot #B5BCBD, lit) |
| capWhiteShade | #7E8594 | White cap shade |
| tama | #DCDCE0 | Tamagotchi shell (screenshot #D8D8D8) |
| tamaShade | #8E8F99 | Tamagotchi shell shade |
| tamaScreen | #B9C2A8 | Tamagotchi LCD |
| tamaPixel | #2A2E24 | Tamagotchi LCD pixels ("20 25") |
| glowPink | #94657F | Glow disc behind purple gifts (screenshot) |
| glowSlate | #5A6788 | Glow disc behind white gifts (screenshot slate #333B4F, lifted) |
| coat | #0C0B10 | Cartezz's coat and trousers |
| coatFold | #1C1A24 | Coat folds, seams, shoe tops |
| hair | #0A0809 | Cartezz's long dark hair |
| hairLit | #2C2430 | Hair sheen in rim light |
| skin | #C9B7BC | Pale skin, lit (graded toward violet) |
| skinShade | #6C5660 | Skin in shade |
| skinDeep | #2E2328 | Skin in deep shadow |
| lips | #7A4E5C | Lips |
| eye | #140E12 | Iris / lash line (dark eye makeup) |
| hot | #F7F0FF | One-frame white-violet flashes (press, world break) |

### 2.3 Light colours

- `violet` / `violetMid` / `violetHot` — the world's light and Cartezz's identity.
- `bone` — information (text, UI sparks).
- `link` — only the handle.
- `star` / `gold` — only on the bow-tie star and the name badge (small).
A frame uses no other saturated colour except the gift objects' own fills (caps, tamagotchi).

## 3. Line

| Element | Width | Colour and opacity |
|---|---|---|
| UI hairline (phone frame, pills) | 1.5 px | steelEdge 100% |
| Avatar ring | 2.5 px | violet 90% + outer 1 px violetMid 35% |
| Corner brackets | 1.5 px, arms 22 px | ash 70% |
| Building edges | 1 px (scaled by distance, min 0.6) | steelEdge 60–90% |
| Neon trim | 2 px core + glow | violetMid 90% |
| Cartezz rim light | ≈ 0.6% of figure height, min 1.5 px | violetMid, strongest toward the light |

## 4. Tone

### 4.1 Light
The key light of the city is **the ONLINE button** at the end of the street. Building faces: `steelLit` near it, `steel` far away, fog toward `haze`. Neon trim and UI sparks are secondary. Cartezz is rim-lit from the button's direction; in back views he is a silhouette with a violet outline; in the awe close-up his face is lit cool-white-violet by the profile hologram above.

### 4.2 Fog
Every 3D colour blends toward `haze` by `1 − exp(−d / 150)` (d metres), capped at 0.9; toward `hazeViolet` within 60 m of the button.

### 4.3 Grain and boil
`core` lays the fine dark schematic grain over every shot on the 12 fps boil clock. From the press (T 26.6667) to the end of the film the grain clock is **held** (timeline `post: { hold: 26.6667 }`) — the grain freezes with the world. Scenes add no full-frame grain.

### 4.4 Glow
Glows are additive radial gradients, halo 4–8× the core. No glow covers more than a quarter of the frame except the ONLINE button (shots 12–15) and the awe light (shot 10).

## 5. The two plates

### 5.1 Screen plate (shots 01–06, end of 16)
The Telegram profile, redrawn (G1 in the storyboard): charcoal header gradient over `void`, the faint leaf-icon pattern (4% alpha), crisp UI. The phone world floats in darkness: a hairline rounded phone frame, the lower UI fading into `void`, corner brackets of the "classified system" at the safe-area corners. Faint scanlines (1 px every 6 px, 3% alpha) over the screen.

### 5.2 City plate (shots 07–15, start of 16)
The one shared 3D world `FILM.kit.city` (10.6). Perspective, fog, rim light. The profile's UI language as architecture: towers of stacked dark tiles with rounded-rect windows arranged like chat feeds, antenna tips with online dots, neon trim in `violetMid`.

## 6. Overlays

Overlays are UI, never annotation: corner brackets, count badges, a focus ring (1.5 px, pops outBack over 3 frames). At most two at once. City shots carry almost none — the city is UI.

## 7. Motion

### 7.1 On twos
Cartezz moves on twos (`lib.onTwos`). Floating objects, lights, camera and UI run at 24 fps.

### 7.2 Timing
90 bpm: beat = 0.6667 s = 16 frames; 8th = 8 frames; 16th = 4 frames; bar = 2.6667 s = 64 frames.
Pops, cuts and hits land on a beat, 8th or 16th, on the frame. UI pops: outBack over 3 frames, 6–10% overshoot. Draw-ons: outExpo over 6 frames. Camera: inOutSine / inOutCubic, may span a shot. Floating objects drift slowly (spin ≤ 0.35 rad/s, bob ≤ 0.8 m at 0.15–0.4 Hz). Nothing bounces.

### 7.3 Determinism and the freeze
Seed every random choice from `lib.hash(...)`. All world motion uses **city time** `Tc = FILM.kit.cityTime(T) = min(T, 26.6667)`. After the press nothing in the world changes; only the camera moves.

## 8. Match cuts

- **G1 profile screen** — shots 01, 04 and the end of 16 draw `FILM.kit.profile` with identical geometry.
- **G2 avatar content** — the avatar always shows the city from `FILM.kit.CAM_AVATAR` at city time Tc (`FILM.kit.avatar`).
- **G3 city** — every city shot draws `FILM.kit.city`; only the camera changes.

## 9. End title

`CARTEZZ // @MURTHERED`: `lib.text`, 50 px, weight 500, tracking 0.28 em; `CARTEZZ` in `bone`, `//` in `ash`, `@MURTHERED` in `violetMid`; centred on x 540, baseline y 968. Shot 17 only.

## 10. Subject reference

Sources checked on 23 Sep 2026: the director's brief; `.tmp/research/profile.png` (Cartezz's Telegram profile, dark mode). See `docs/reference-analysis.md`.

### 10.1 Cartezz (the character)

He is 1.85 m tall and drawn only by the kit:
- `FILM.kit.cartezz(ctx, x, y, h, pose)` — full figure; (x, y) = screen point between the feet, h = figure height in px. `pose.view`: `'back'` or `'front'`; `pose.walk` (stride phase, cycles per stride pair) or null; `pose.arm` 0..1 (right arm raised forward to press); `pose.light` = screen direction of the light (−1 left … 1 right).
- `FILM.kit.head(ctx, x, y, s, o)` — the head-and-shoulders close-up, a noir **profile**; s = head height in px; `o.dir` (+1 faces screen right, −1 left), `o.turn` (0 back of head … 1 profile), `o.pitch` (up +), `o.body` ('side' | 'back'), `o.expr` = { brows, eyes, mouth, smile, blink } in 0..1, `o.gaze` (0 forward … 1 eye turned to the camera), `o.light` { front, amt }, `o.glint`, `o.rim`, `o.wash`.

| Part | Rule (fractions of full height h, from the feet up) |
|---|---|
| Coat | long black coat (`coat`), hem at 0.30, shoulders at 0.80 and 0.25 wide, hem 0.27 wide, raised collar to 0.86 |
| Legs | trousers `coat` 0.30 → 0.035; shoes 0.035 tall, `coatFold` |
| Head | 0.12 tall, 0.085 wide, crown at 0.985 |
| Hair | dark (`hair`), straight, medium length: from under the cap to the nape and jaw (0.80), messy tips; a sheen of `hairLit` on the lit side |
| Cap | purple baseball cap (`capPurple`), crown 0.93–1.0, 0.10 wide, brim 0.07 forward, `violetDeep` under the brim, white paper-plane logo on the front panel, top button |
| Bow tie | indigo bow tie (`bowtie`) with a gold `star` knot, at the collar (front / face views), 0.06 wide |
| Face | **a young man**: pale (`skin`), calm; strong brow ridge, straight thick brows, a straight prominent nose, thin muted lips, square chin, defined jaw angle, Adam's apple, a faint stubble shadow; no makeup. Mostly in the cap's shadow in city light |
| Rim light | `violetMid` outline toward the light |

He walks calmly: one step per beat (0.6667 s), a stride pair every 2 beats, 1.45 m/s, 1% bob, arms swinging slightly, coat hem swaying. He never runs, never bounces, never pulls a cartoon face.

**The awe expression (shot 10):** brows lift 0.6, eyes widen 0.7, mouth opens slightly (0.3), then a small admiring smile (0.5). The face is lit by his own profile.

### 10.2 Bow tie (gift and costume)

From the screenshot: a butterfly bow tie in indigo-purple fabric (`bowtie`) with a darker paisley-like pattern and lighter highlights (`bowtieLight`), pleated wings (3 folds each), a wrapped knot in the middle carrying a small five-point gold `star`. Wing span 1.0, height 0.55, knot 0.2 × 0.3. Drawn only by `FILM.kit.bowtie(ctx, x, y, s, rot, o)`.

### 10.3 Caps (gift and costume)

A baseball cap: six-panel crown (half-ellipse 1.0 wide × 0.62 tall), two visible seams, top button, curved brim (0.9 × 0.28) that swings around with yaw, and a white paper-plane logo on the front panel. Two colourways: `capPurple` (lit `capPurpleLit`) and white (`capWhite`, shade `capWhiteShade`). `FILM.kit.cap(ctx, x, y, s, yaw, o)` with `o.white`.

### 10.4 Tamagotchi 2025 (the strange digital gift)

An egg-shaped white shell (`tama`, height 1.0, width 0.86), a keyring loop and a ball-chain arc on top-right, a square LCD (`tamaScreen`, 0.46 wide) showing pixel digits `20` over `25` in `tamaPixel`, three buttons below (triangle, circle, triangle). `FILM.kit.tama(ctx, x, y, s, rot, o)`.

### 10.5 Profile UI glyphs

- **Gift bubble** (as on the profile): a soft glow disc (`glowPink` behind purple gifts, `glowSlate` behind white ones), the gift inside, and 3–5 small four-point `bone` sparkles. `FILM.kit.giftBubble`.
- **Presence** `2 online`: a white rounded square with a black `2`, then `online` in `mist`. `FILM.kit.presence`.
- **Notification pill**: a dark rounded pill (`tile`, 1.5 px `steelEdge` border), a gift icon at left in a bubble, two `ash` bars and a `violetMid` unread dot, soft `violetMid` glow under it. `FILM.kit.notif`.
- **Online dot**: `violet` core, `violetHot` centre, 1 px `violetMid` ring at 1.8 r, halo 5 r. `FILM.kit.onlineDot`.
- **Count badge**: `violet` pill with `bone` digits.

### 10.6 The city (shared 3D world)

Metres. x right, y up, z forward down the street (toward the button). Ground y = 0.
- **Street**: centreline x = 0, road half-width 9 m, sidewalks to 12 m, running from z −80 to the plaza at z 196.
- **Towers**: both sides from |x| 13 to 70, z −80 to 250, heights 18–150 m, seeded. Each is a stack of dark tile slabs with thin gaps. Street-facing faces carry chat-feed windows (a dot and two bars per row). Some tops carry an antenna with an online dot. Some slab edges carry `violetMid` neon.
- **Plaza and button**: at z 196 the street opens into a plaza. **The ONLINE button** stands on the centreline, face plane z = 220: a pill 24 m wide × 10 m tall, bottom at y 0.6, inside a dark bezel 26 × 12 m, 3 m deep. The word `ONLINE` is 4.2 m tall in `bone` with a `violetHot` halo; a 1.4 m online dot sits left of the word. Before the press it breathes on every beat; pressed, the face recesses 0.5 m and the glow locks at full.
- **Hologram profile**: from T 18.0 (flickering on, full at 18.667) a giant hologram of his profile (G1 content) hangs over the street, centre (0, 40, 140), 30 m wide × 53.3 m tall, facing −z.
- **Sky**: `void` → `voidLift`, far skyline blocks in `haze`, and a faint enormous ring arc (the avatar's edge seen from inside) at 5% alpha.
- **Searchlights**: four beams from tower tops, sweeping slowly; they freeze with the world.
- **Floating gifts**: 72 seeded objects — bow ties, purple caps, white caps, tamagotchis, notification pills — in x −45..45, y 12..95, z −30..215. Each has an arrival time between T 10.9 and 24.2 (glitch-slice materialize); later arrivals are larger (up to 28 m). Plus ~120 small online dots (0.4–1.1 m) drifting upward as the only particles.
- **Cartezz in the city**: the shot owns his street position (storyboard).

### 10.7 Mistakes to avoid

- A purple-filled frame or purple sky — **purple is light and motif only**; the frame stays black and charcoal.
- A goofy Cartezz (big cartoon eyes, grin, bouncing walk, stubby proportions) — **tall, composed, face calm, dark hair under the purple cap**. Awe is widened eyes and a small smile, not a gag face.
- A feminine Cartezz (eyeliner, full coloured lips, long flowing hair, soft jaw) — **he is a guy**: strong jaw and brow, muted lips, medium-length hair.
- Generic gift boxes, stars, confetti or random sparkle fields — **only the four profile gifts, notification pills and online dots**; sparkles only as the profile's four-point gift sparkles.
- Different cap / bow-tie / tamagotchi drawings in different shots — **always call the kit**.
- A city that changes between shots — **always `FILM.kit.city`**; move the camera, not the buildings.
- Anything moving after the press (spinning gifts, blinking windows, drifting dots, searchlights, boiling grain) — **use `kit.cityTime(T)`**; only the camera moves in shots 14–16.
- Reproducing the real avatar photo — **the avatar is the city seen from `CAM_AVATAR`**, dark with a purple glow at its heart.
- Must-read text outside x 60–940, y 220–1540.
