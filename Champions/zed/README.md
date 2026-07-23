# Zed

Assassino de sombra com presença dupla — máscara clássica, fendas âmbar, placas preto/carmesim e lâminas gêmeas. Vertical slice **Living Shadow** para playtest local.

- Identidade, skill e cooldown: `../membership.ts` e `definition.ts`
- Regras e seleção local: [`docs/gameplay.md`](../../docs/gameplay.md)
- Mecânica executável: `GameMechanics/src/modules/skills/` (`zed-living-shadow`)
- Apresentação dual-body allowlisted: `GameMechanics/src/browser/main.ts`
- Retrato 256² + sprites densos 160×160: `assets/`

## Animation density (installed)

Pacote 160×160 com poses limpas, fundo transparente e fases de membro legíveis
(edit-chain a partir da identidade aprovada). QA exige energia de movimento e
integridade single-pose em `GameMechanics/tests/zed-sprite-assets.test.ts`.

| Slot | Frames / dir | Notes |
| --- | --- | --- |
| idle | 6 | S/E/N/W, bob / micro-fase |
| walk | 8 | S/E/N/W, passadas alternadas legíveis |
| run | 8 | S/E/N/W, ciclo acelerado |
| cast | 8 | S/E/N/W, antecipação → ação → recuperação |
| attack | 8 | S/E/N/W, plantio/golpe sem sprite de bomba |
| death | 8 | S/E/N/W, queda / dissipação |

Living Shadow: projeção fixa no tile, carmesim no canvas, espelha facing e
família de ação do corpo (idle/walk/run/cast/plant/recovery) sem transladar.
Eco de bomba no tile da sombra enquanto canaliza — ver `docs/gameplay.md`.

## Posture

Protótipo fan restrito e não monetizado. Deploy, divulgação ou monetização
exigem autorização separada do capitão.
