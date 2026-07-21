# Nico — alternate ultimate candidate

Round `2026-07-21 07:50 -03:00`. Candidate for the existing `nico` Champion, with `integration=false`; no final Champion asset or runtime file was changed.

## Delivery

- Preserved source: `source-generated-grid.png` (1254×1254 RGB, 4×4 cyan-key grid).
- Chroma removed: `source-chromakey-removed.png`, followed by `source-grid-1248.png` (1248×1248 RGBA, 312×312 cells).
- Production derivatives: 16 ordered 512px frames in `frames-512-v2/`, 16 ordered 256px frames in `frames-256-v2/`, `spritesheet-512-4x4-v2.png`, `spritesheet-256-4x4-v2.png`, `preview-v2/contact-sheet.png`, `preview-v2/preview.gif`, and `preview-v2/frame-order.txt`.
- The initial extraction remains untouched as WIP.

## Validation

Both selected frame sets contain 16 non-empty square RGBA PNGs. Cell dimensions divide the 4×4 atlases exactly; each selected atlas cell matches its discrete frame byte-for-byte. Alpha does not touch frame borders, with minimum content margins of 2 px at 512 and 1 px at 256. The contact sheet and 16-frame preview were inspected; preview timing is 100 ms per frame. The south-facing shadow-grimoire ultimate reads through sigil, orbiting pages, violet beam flare, dissipation and recovery, with no bomb or explosive object.

## Grok and origin

Grok Worker ran in `act` mode with the exact scope of this directory but exited with code 1 before a final verdict. The result is `INCONCLUSIVE`, not `PASS`; no production files or audit artifacts were left. Grok Imagine was unavailable/not used.

The source was generated with integrated `image_gen` from the internal Nico reference. There are no external resources, packs or downloads. This candidate is not integrated into the runtime.

Next category: `emote alternativo`.
