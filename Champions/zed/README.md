# Zed

Assassino de sombra com presença dupla — máscara clássica, fendas âmbar, placas preto/carmesim e lâminas gêmeas. Vertical slice **Living Shadow** para playtest local.

- Identidade, skill e cooldown: `../membership.ts` e `definition.ts`
- Regras e seleção local: [`docs/gameplay.md`](../../docs/gameplay.md)
- Mecânica executável: `GameMechanics/src/modules/skills/` (`zed-living-shadow`)
- Apresentação dual-body allowlisted: `GameMechanics/src/browser/main.ts`
- Retrato 256² + sprites densos 160×160: `assets/`

## Animation density (installed)

O pacote parte de `bombpvp-highframe-league-roster-v1`; as lacunas direcionais
foram preenchidas e normalizadas no bundle final.

| Slot | Frames / dir | Notes |
| --- | --- | --- |
| idle | 6 | S/E/N/W, normalizado sobre os estáticos direcionais aprovados |
| walk | 8 | S/E/N/W, ciclo direcional normalizado |
| run | 8 | S/E/N/W, ciclo direcional acelerado |
| cast | 8 | S/E/N/W, pulso direcional da projeção |
| attack | 8 | S/E/N/W, avanço direcional sem bomba |
| death | 8 | S/E/N/W, queda direcional com dissipação |

A apresentação de Living Shadow recolore os frames do corpo em carmesim no
canvas, sem um segundo PNG de identidade. Frames de ataque/plantio não contêm a
bomba, que é desenhada pela engine.

## Posture

Protótipo fan restrito e não monetizado. Deploy, divulgação ou monetização
exigem autorização separada do capitão.
