# CARTEZZ // ONLINE

A 34.7-second vertical procedural short about Cartezz (@murthered), built with the
[procedural-film](https://github.com/kuhnhomeuk-cell/procedural-film) skill: every pixel is drawn by
JavaScript on a canvas and every sound is synthesised in Web Audio — zero media assets.

- **Watch:** `exports/cartezz-online-phone.mp4` (720×1280) or `exports/cartezz-online-preview.mp4` (1080×1920).
- **Interactive player:** download `dist/cartezz-online.html` and open it in a browser — click or space to play with sound,
  arrow keys step frames, `?shot=<id>` loops one shot, `?t=<seconds>` shows a still.
- **Shot list / captions:** `exports/cartezz-online-shots.md`.

## How it is made

| Path | What |
|---|---|
| `docs/reference-analysis.md` | The look, analysed from Cartezz's Telegram profile screenshot and the brief |
| `docs/art-bible.md` | Palette (sampled from the profile), the character, the gifts, the city, mistakes to avoid |
| `docs/storyboard.md` | 17 shots on a 90 bpm grid, shared geometry, cameras, sound cues |
| `src/kit.js` | The shared world: the 3D city of interface, the ONLINE button, the hologram, the four gifts, the profile screen, the avatar, Cartezz |
| `src/scenes/NN-*.js` | One file per shot |
| `src/music.js` | The score and sound design, scheduled on the cues |
| `tools/` | The skill's gate (`check.cjs`), stills (`snap.cjs`), renderer (`render.cjs`), player build (`build.cjs`), audio analysis |

## Rebuild

Requires Node 20+, ffmpeg on the PATH and Chromium for Playwright.

```bash
npm install --prefix tools
export CHROMIUM_PATH=/path/to/chromium   # only if Playwright's bundled browser is not installed
node tools/check.cjs                     # the six-check gate
node tools/render.cjs                    # exports/cartezz-online.mp4 (master)
node tools/build.cjs                     # dist/cartezz-online.html
```
