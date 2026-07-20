# Lee Sin

Monge cego inspirado no Lee Sin de League of Legends — visual marcial vermelho/ouro e ultimate de chute.

- Identidade e cooldown: `definition.ts`
- Dragon's Rage (dash + knockback): `skill.ts`
- Animação de cast e FX dourado: `visuals.ts`
- Retrato e sprites densos 160×160: `assets/`
- Fontes hi-res / vídeo / harvest: `rebuild/` (local, fora do runtime)

## Skill — Fúria do Dragão

Avança até 3 tiles na direção atual. No impacto (ou no fim do dash), o primeiro inimigo na linha cardinal é arremessado até 3 tiles no mesmo eixo. Se o caminho estiver bloqueado, tenta só o chute estacionário com cooldown curto.

## Asymmetry markers (identity lock)

| Detail | Character side | Front (viewer) | Right profile | Back (viewer) |
| --- | --- | --- | --- | --- |
| Dragon arm wrap/tattoo | RIGHT arm | LEFT | near | RIGHT |
| Prayer beads hang | LEFT chest | RIGHT | far | LEFT |
| Headband knot tails | back of head | (hidden) | rear | center-leftish |

## Animation density (shipped)

| Slot | Frames / dir | Notes |
| --- | --- | --- |
| idle | 7–8 | breath + headband; north/west synthesized from still |
| walk | 6–8 | south/east/north/west real sheets |
| run | 6–8 | east is true sprint sheet; others reuse walk |
| cast | 7 | Dragon's Rage kick — **authored south**, copied to other dirs |
| attack | 6 | plant gesture, no bomb in PNG — **south authored**, copied |
| death | 8 | collapse hold last — **south authored**, copied |

Final cell size: **160×160** RGBA. The shipped bundle contains 175 animation frames plus four static sprites. Hi-res bases 1024² in `rebuild/base/`. Sheet sources in `rebuild/sheets/`; the current curated output came from `rebuild/install_v3.py`.

## Honest defects / next polish

1. **cast / attack / death** still use south art for north/east/west — walk/idle/run have real direction coverage.
2. Video pipeline (`image_to_video`) was blocked (rate limit / ZDR upload URL); frames came from horizontal sprite sheets + PIL key/crop.
3. **2026-07-19 fix:** first install used tight fit + compact sheet cells → looked legless/cropped. Rebuilt with longer-leg bases, foot-anchored fit (`rebuild/reprocess_fit.py`), and spaced run sheet + peak slice.
4. Walk-south sheet drifted to shorter martial pants (more loincloth) vs baggy idle pants — same character, slight outfit variance across actions.
