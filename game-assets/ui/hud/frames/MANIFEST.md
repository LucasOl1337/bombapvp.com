# HUD chrome frames (9-slice) — G4

Blank text-ready match UI panels. Dark charcoal metal + warm gold accents
aligned with **Tournament Clean** arena language (not full Citadel cyan).
Pixel-tech chrome, one contract across the set. No lettering.

## Style contract

| Property | Value |
| --- | --- |
| Family | Tournament charcoal + warm gold |
| Metal | `#161412` outer → `#342e28` mid → `#443c34` inner |
| Gold (normal) | `#cca448` / bright `#f2d076` |
| Gold (ult-ready) | hotter `#f2c040` / `#ffe88c` |
| Dead | desaturated ash metal, muted bronze rivets |
| Interior | dark charcoal fill, blank for text/icons |
| Ornament | L-bracket + rivets **only in corners** |
| Edges | continuous gold rail + solid metal — stretch-safe |

## 9-slice margins

| Asset family | Size (W×H) | Margin (L/R/T/B) | Corner region |
| --- | --- | --- | --- |
| Rival slot | 512 × 160 | **24** px all sides | 24×24 ornaments |
| Local player panel | 512 × 384 | **32** px all sides | 32×32 ornaments |
| Match center | 512 × 160 | **24** px all sides | 24×24 ornaments |

Engine slice guide (CSS `border-image` / canvas 9-slice):

```
slice = margin  // 24 or 32 depending on family
// top-left corner:     [0,0] → [slice, slice]
// top edge:            [slice, 0] → [W-slice, slice]   (stretches X)
// center fill:         [slice, slice] → [W-slice, H-slice]  (stretches XY)
```

Corners carry rivets and L-bracket gold. Edge strips are **uniform** (no
mid-edge bolts) so stretch does not elongate discrete ornaments.

## Files

| File | Catalog id | State |
| --- | --- | --- |
| `frame-rival-normal.png` | `ui.hud.frame.rival.normal` | alive / default |
| `frame-rival-dead.png` | `ui.hud.frame.rival.dead` | eliminated |
| `frame-rival-ult-ready.png` | `ui.hud.frame.rival.ult-ready` | ultimate ready |
| `frame-local-normal.png` | `ui.hud.frame.local.normal` | alive / default |
| `frame-local-dead.png` | `ui.hud.frame.local.dead` | eliminated |
| `frame-local-ult-ready.png` | `ui.hud.frame.local.ult-ready` | ultimate ready |
| `frame-match-center.png` | `ui.hud.frame.match-center` | timer / match strip |

**Skipped:** `frame-rival-self.png` — rival strip does not need a self-highlight
variant (local panel already owns the player).

## State variants

Geometry is **identical** within each size class (alpha silhouette matches).
Only palette / gold intensity changes:

- **normal** — warm gold rails + rivet cores
- **dead** — ash grey metal, dim bronze accents
- **ult-ready** — brighter gold rails + corner spark ticks + outer rim boost

## Contact sheet

`contact-sheet-hud-frames.png` — all seven frames side by side.

## Regen

```
python game-assets/ui/hud/frames/_gen_frames.py
```

## Consumer note

G2 owns HUD layout in `game-app`. Wire via `resolveGameAsset("ui.hud.frame.*")`
and draw with 9-slice using the margins above. Do not hardcode file paths.
