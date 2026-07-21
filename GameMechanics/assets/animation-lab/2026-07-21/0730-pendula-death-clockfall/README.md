# Pendula — alternate death candidate

Round `2026-07-21 07:30 -03:00`. Adopted candidate for the existing `pendula` Champion, with `runtimeIntegration=true` for the south-facing death sequence only.

## Delivery

- Preserved source: `source-generated-grid.png` (1254×1254 RGB, 4×4 magenta-key grid).
- Chroma removed: `source-chromakey-removed.png`, followed by `source-grid-1248.png` (1248×1248 RGBA, 312×312 cells).
- Production derivatives: 16 ordered 512px frames in `frames-512-v5/`, 16 ordered 256px frames in `frames-256-v5/`, `spritesheet-512-4x4-v5.png`, `spritesheet-256-4x4-v5.png`, `preview-v5/contact-sheet.png`, `preview-v5/preview.gif`, and `preview-v5/frame-order.txt`.
- Runtime derivative: 16 `124×124` RGBA files at `Champions/pendula/assets/animations/death-south-0.png` through `death-south-15.png`.
- Earlier extraction variants remain in the directory as WIP and were not deleted.

## Validation

Both selected lab frame sets contain 16 non-empty square RGBA PNGs. Cell dimensions divide the 4×4 atlases exactly; each selected atlas cell matches its discrete frame byte-for-byte. Alpha does not touch frame borders, with minimum content margins of 6 px at 512 and 3 px at 256. The contact sheet and 16-frame preview were inspected; preview timing is 120 ms per frame. The runtime derivative contains 16 non-empty `124×124` frames with no alpha on the outer border. The sequence reads as a south-facing sway, collapse, platform settle and dim final pose, with no bomb or explosive object.

## Grok and origin

Grok Worker ran in `act` mode with the exact scope of this directory and returned `PASS`. It removed one semi-transparent magenta residual from `frames-512-v5/frame-12.png` and rebuilt `spritesheet-512-4x4-v5.png`; local validation after that action still passed all checks. Grok Imagine was unavailable/not used.

The source was generated with integrated `image_gen` from the internal Pendula reference. There are no external resources, packs or downloads. The existing `import.meta.glob` loader discovers the new files automatically; no runtime loader or deterministic kernel change was needed.

Next category: `ultimate alternativo`.
