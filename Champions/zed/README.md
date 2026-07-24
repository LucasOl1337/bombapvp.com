# Zed

- Identidade e definição: `identity.ts`, `definition.ts`
- Assets finais: `assets/` (retrato 256², animações 160²)
- Mecânica executável: `GameMechanics/src/modules/skills/` (`zed-living-shadow`)
- Apresentação Living Shadow (spectral crimson, cast/swap/cancel timing):
  `GameMechanics/src/browser/main.ts` — mecânica de kernel inalterada neste pack visual

## Pack visual (gate v2)

Substitui o pack genérico rejeitado pelo pacote aprovado no scout
`bombpvp-zed-visual-redesign-gate-v2` (identidade angular + animação de pose real).

- `idle` 6 · `walk`/`run`/`cast`/`attack`/`death` 8 frames · 4 direções
- `attack` = plant de bomba (frames sem bomba desenhada; a engine desenha a bomba)
- Living Shadow reutiliza os mesmos frames do corpo com tratamento espectral no render
- QA de integridade single-pose: `GameMechanics/tests/zed-sprite-assets.test.ts`

Protótipo fan restrito e não monetizado. Deploy, divulgação ou monetização
não autorizados sem ordem explícita do dono.
