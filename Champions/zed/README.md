# Zed

- Identidade e definição: `identity.ts`, `definition.ts`
- Assets finais: `assets/` (retrato 256², animações 160²)
- Regras e apresentação de Living Shadow: [`docs/gameplay.md`](../../docs/gameplay.md)
- Implementação: `GameMechanics/src/modules/skills/` e `GameMechanics/src/browser/main.ts`

## Pack visual (gate v2)

Substitui o pack genérico rejeitado pelo pacote aprovado no scout
`bombpvp-zed-visual-redesign-gate-v2` (identidade angular + animação de pose real).

- `idle` 6 · `walk`/`run`/`cast`/`attack`/`death` 8 frames · 4 direções
- Convenções dos arquivos finais: [`docs/sprites.md`](../../docs/sprites.md)
- QA de integridade single-pose: `GameMechanics/tests/zed-sprite-assets.test.ts`

Protótipo fan restrito e não monetizado. Deploy, divulgação ou monetização
não autorizados sem ordem explícita do dono.
