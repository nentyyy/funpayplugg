# Scene agent brief (shared)

You are a scene agent on the procedural film **CARTEZZ // ONLINE** (a 34.67 s vertical film about Cartezz, @murthered, drawn entirely in JavaScript on a canvas). The project lives at `/home/user/funpayplugg/cartezz-online`.

## Read first (in this order)

1. `docs/CONTRACT.md` — rules (no media, determinism, stateless frames, **file ownership**).
2. `docs/art-bible.md` — the look, the palette names, the character, the mistakes to avoid. It wins on colour and style.
3. `docs/storyboard.md` — Conventions, Shared geometry (G1–G4) and **your shot entries**. It wins on positions and times.
4. `docs/reference/scene-anatomy.md` — how a scene file is built (skeleton, timing helpers, traps).
5. `src/kit.js` — the shared world. Read the header and the doc comments of every function you use. Everything recurring **must** be drawn through `FILM.kit`: `profile`, `avatar`, `presence`, `notif`, `badge`, `giftBubble`, `gift`/`bowtie`/`cap`/`tama`, `onlineDot`, `sparkle`, `city`, `cam`, `lerpCam`, `figure`, `cartezz`, `cartezzAt`, `head`, `planeImage`, `projPoly`, `glow`, `text`, `brackets`, `CAM_AVATAR`, `BUTTON`, `HOLO`, `T_PRESS`, `cityTime`, `B`.
6. `src/timeline.js` — your shots' exact start/end and briefs, and the cue list.

## Rules

- Edit **only** the files you own (named in your task). Never touch `src/kit.js`, `src/lib.js`, `src/core.js`, `src/timeline.js`, `src/music.js`, tools, docs or other scenes. If the kit lacks something or has a bug, write a local helper in your own file and **report it** in your final message.
- No `Math.random`, `Date`, `performance.now`. Randomness from `FILM.lib.rng(FILM.lib.hash(ID, ...))`. A frame depends only on `t` / `info`. Clamp `t` to `[0, info.dur]` first.
- Colours only from `FILM.lib.pal` names (the gate warns on literal hex in scenes).
- Must-read content inside x 60–940, y 220–1540.
- Cartezz is **a young man** (composed, dignified; never goofy).
- Purple is an accent against black and charcoal, never a wash. Every small light is an online dot, a UI spark or a notification — no generic particles.
- World motion uses `FILM.kit.cityTime(info.T)`; after the press (T 26.667) nothing in the world moves.
- Beat: `B = FILM.kit.B = 2/3 s` (16 frames). Events land exactly on beat / 8th / 16th frames; use a `lead` so an event is visible ON its beat frame (scene-anatomy timing helpers).
- Frame cost: keep every frame under ~150 ms at scale 1 (the city is the heavy part; don't draw it twice per frame unless needed).

## Workflow

```bash
export CHROMIUM_PATH=/opt/pw-browsers/chromium
cd /home/user/funpayplugg/cartezz-online
node tools/snap.cjs --shot <id> --only --samples 6 --sheet     # frames in .frames/<id>-T*.png, sheet .frames/<id>-sheet.png
node tools/snap.cjs --shot <id> --only --times 0,0.5,1.2        # specific shot-local times
node tools/check.cjs                                            # the whole-film gate (run at the end)
```

`--only` loads core, lib, kit, timeline and your one scene, so you can work while other agents edit theirs. **Look at the frames** (Read the PNGs) after every change — reading the pixels is the review. Iterate until the shot is beautiful and on-brief: at least three rounds. Check the first and last frames especially (cuts). The bar: a serious, cinematic, prestige sci-fi short — dense, deliberate, lit.

When `check.cjs` fails only because of another agent's half-written shot, say so; your own shots must draw without errors.

## Final message

Reply with: what each of your shots shows (2–3 lines each), what you verified on frames, frame cost observed, and any kit issue you worked around.
