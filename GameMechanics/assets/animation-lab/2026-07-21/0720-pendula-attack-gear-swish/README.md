# Pendula — alternate attack candidate

Round `2026-07-21 07:20 -03:00`. Candidate for the existing `pendula` Champion, with `integration=false`; no final Champion asset or runtime file was changed.

## Delivery

- Preserved source: `source-generated-grid.png` (1254×1254 RGB, 4×4 cyan-key grid).
- Chroma removed: `source-chromakey-removed.png`, followed by `source-grid-1248.png` (1248×1248 RGBA, 312×312 cells).
- Production derivatives: 16 ordered 512px frames in `frames-512-v2/`, 16 ordered 256px frames in `frames-256-v2/`, `spritesheet-512-4x4-v2.png`, `spritesheet-256-4x4-v2.png`, `preview-v2/contact-sheet.png`, `preview-v2/preview.gif`, and `preview-v2/frame-order.txt`.
- The original frames, atlases and preview remain untouched as prior WIP after the worker's incomplete atlas repair.

## Validation

Both selected frame sets contain 16 non-empty square RGBA PNGs. Cell dimensions divide the 4×4 atlases exactly; each selected atlas cell matches its discrete frame byte-for-byte. Alpha does not touch frame borders, with minimum content margins of 21 px at 512 and 10 px at 256. The contact sheet and 16-frame preview were inspected; preview timing is 90 ms per frame. The attack uses a gear/slash effect and contains no bomb or explosive object.

## Grok and origin

Grok Worker ran in `act` mode with the exact scope of this directory. It attempted to repair the atlases but exited with code 1 before a final verdict, leaving `_audit_temp.py` and `_fix_and_verify.py`; the result is `INCONCLUSIVE`, not `PASS`. Grok Imagine was unavailable/not used.

The source was generated with integrated `image_gen` from the internal Pendula reference. There are no external resources, packs or downloads. This candidate is not integrated into the runtime.

Next category: `death alternativo`.
