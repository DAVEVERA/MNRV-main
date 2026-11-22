# Freedoom in MNRV 98

Chocolate Doom compiled to WebAssembly, running the free Freedoom game data
inside the MNRV retro desktop. Everything is served from the same MNRV origin;
the player does not fetch third-party scripts or game data.

Open the **Freedoom** icon, choose **KLIK OM TE STARTEN**, and play. Touch controls are laid out below the
viewport. A keyboard works too (arrows to move and turn, Ctrl to fire, Space to
open doors, `,` / `.` to strafe, number keys to switch weapons).

First load pulls about 35 MB. After that the browser cache serves it.

---

## What is in here, and who owns it

This repository contains two independently licensed things. They are kept
separate on purpose.

### The engine — GPLv2

| File | What |
|---|---|
| `websockets-doom.wasm` | Chocolate Doom compiled to WebAssembly |
| `websockets-doom.js` | Emscripten loader/glue for the above |

id Software released the Doom engine source under the GNU GPL v2, and Chocolate
Doom inherits that license. The full license text is in [`COPYING`](COPYING).

**Corresponding source.** These binaries are unmodified build artifacts. They
were taken from the published GitHub Pages deployment of:

- Deployment commit: `Saketh-Chandra/doom-wasm-pwa@5b1e1fe7385b6f0b19d60dece6adbf88f6842e20` (branch `gh-pages`, 2023-03-09)
- Built from source revision: <https://github.com/Saketh-Chandra/doom-wasm-pwa/tree/a77edfd8bbc7>
- Which is a fork of: <https://github.com/cloudflare/doom-wasm> (declared GPL-2.0)
- Which is a WebAssembly port of: <https://github.com/chocolate-doom/chocolate-doom>

The complete corresponding source for these binaries is the tree at
`Saketh-Chandra/doom-wasm-pwa@a77edfd8bbc7`, publicly available at the URL above.

No modifications were made to the engine. The only original code in this
repository is `index.html`.

### The game data — BSD 3-clause

| File | What |
|---|---|
| `../freedoom1.wad` | Freedoom: Phase 1 game data |
| `FREEDOOM-COPYING.txt` | Freedoom's BSD 3-clause license |
| `FREEDOOM-CREDITS.txt` | Freedoom contributor credits |

[Freedoom](https://freedoom.github.io/) is a free-content replacement for Doom's
game assets — original levels, sprites, sounds, and music, written from scratch.
It contains **no id Software content**. Taken unmodified from the official
`freedoom-0.13.0.zip` release.

The IWAD lives one directory above the player so MNRV stores only one copy.

### The page — `index.html`

Based on the original doom-web wrapper. The MNRV version loads
`../freedoom1.wad` into the Emscripten virtual filesystem before `main()` runs,
uses Dutch start controls and retains the touch-control layer that synthesizes
keyboard events. This WebAssembly build starts with `-nomusic` to avoid its
blocking browser MIDI path; in-game sound effects remain available.

---

## What is deliberately not here

No `doom1.wad`, `doom.wad`, or `doom2.wad`. Those are id Software's copyrighted
game data and are not redistributable. Freedoom exists precisely so that none of
them are needed.

---

## Running it locally

```bash
node ../../../scripts/serve-static.mjs
```

Then open <http://127.0.0.1:4173/?retro=1>. Any static file server works — there
is no build step and no backend.
