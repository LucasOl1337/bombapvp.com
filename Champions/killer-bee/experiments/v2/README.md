# Killer Bee v2 — animation experiment (Grok 4.5)

**Status:** laboratório privado do Champion. Não substitui automaticamente os assets canônicos em `../../assets/animations/`.

**Date:** 2026-07-18

**Pipeline:** `image_edit` base → `image_to_video` (6s, 720p) → `ffmpeg` harvest @12fps → manual pick → 124×124 + sheets

## Which pack to use

| Pack | Path | Use for |
| --- | --- | --- |
| **Bomber (gameplay)** | [`bomber-actions/`](./bomber-actions/) | Walk, bomb plant, Wing Dash cast — matches bomb meta |
| **Combat (archived)** | this folder root (`selected/`, `sheets/`, `video/`) | Sword slash / combat — kept for possible future skills, **not** current game |

## Root pack (combat prototype — preserved)

| Clip | Motion | Frames selected | Engine size |
| --- | --- | --- | --- |
| Idle south | Wing flutter + light hover | 8 | 124×124 |
| Attack south | Wind-up → slash (with arc FX) → follow | 8 | 124×124 |
| Run east | In-place sprint gait | 8 | 124×124 |

## Folder map

```
base/           hi-res stills (idle / attack wind-up / run pose)
video/          source MP4s (idle-south, attack-south, run-east)
frames/*-raw/   full 73-frame harvest per clip
frames/*-contact.png
selected/       game-sized frames + @256 previews
sheets/         horizontal sprite sheets + looping GIF previews
ref/            original in-game reference sprites
```

### Quick preview

- GIFs: `sheets/idle-south-preview.gif`, `attack-south-preview.gif`, `run-east-preview.gif`
- Sheets 256px: `sheets/*-sheet-256.png`
- Full motion: `video/*.mp4`

## Identity notes (honest)

**Kept:** black/yellow bee warrior, red compound eyes, antennae, gold translucent wings, dagger, chibi game proportions, solid black isolation.

**Drift from original 124px sprites (flagged):** armor reads more high-tech (silver trim, chest plate); often one primary blade instead of dual; face/helmet slightly more “mask” than the original. Treat this as a **style-up reimagining**, not a drop-in pixel-perfect reskin.

## Motion quality (flip-test)

| Clip | Loop / continuity | Notes |
| --- | --- | --- |
| Idle | Good wing open↔close | Subtle bob; some adjacent frames near-duplicates |
| Attack | One-shot (hold last) | Strong arc FX on frames 3–5; body twists off pure south mid-slash |
| Run | Usable cycle | Clear leg alternation; raw harvest has occasional wing/head ghosts — curated set is cleaner |

## Engine-ready defaults applied

- Isolated subject, solid black background (matches current game sprites)
- Centered framing, no ground plane
- Uniform 124×124 cells for sheets
- Naming: `{action}-{dir}-{index}.png` (e.g. `idle-south-0.png`)

## Not done in this test

- North / west / full 4-dir coverage
- Walk, cast (Wing Dash), death
- Transparent alpha (game currently uses black-backed PNGs)
- Drop-in replace into `6ee8baa5-…` or loader wiring
- Pixel-perfect identity lock to original micro-sprite

## Suggested next experiments

1. **Identity lock:** edit-chain every pose from one approved base only; freeze armor silhouette.
2. **Full directional set:** south idle/attack → mirror east/west; regenerate north.
3. **Skill cast:** dedicated “Wing Dash” wind-up + blur trail frames.
4. **Integrate:** copy curated 124s into a side-by-side folder and A/B in arena without deleting originals.
5. **VFX split:** keep slash arc as separate overlay so body frames stay clean for collision silhouette.
