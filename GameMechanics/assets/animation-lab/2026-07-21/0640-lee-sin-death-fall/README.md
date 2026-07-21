# Lee Sin — death/fall candidate

Rodada `2026-07-21 06:40 -03:00`. Candidato de `death` para o Champion existente `lee-sin`, sem integração (`integration=false`) e sem alteração em `Champions/` ou no runtime.

## Entrega preservada

- Fonte: `source-generated-grid.png` (1254×1254 RGB, grade 4×4 ciano).
- Chroma-key: `source-chromakey-removed.png`, seguido de `source-grid-1248.png` (1248×1248, células 312×312).
- Derivados: 16 frames RGBA em `frames-512/` e `frames-256/`, com limpeza de borda iniciada pelo worker.
- Atlases e preview: `spritesheet-512-4x4.png`, `spritesheet-256-4x4.png`, `preview/contact-sheet.png`, `preview/preview.gif` e `preview/frame-order.txt`.
- Evidência preservada pelo worker: `_audit_debug/`.

## Validação e decisão

A extração inicial mostrou alpha na borda inferior dos frames 08–15. O Grok identificou que parte era bleed desconectado, limpou/ajustou os frames e deixou as bordas isoladas. Porém, encerrou com código 1 durante a reconstrução: as duas atlases ficaram inconsistentes com todos os frames discretos, e o GIF não recebeu uma confirmação final. O status é `Descartado`; nenhum reparo adicional ou exclusão foi feito.

## Grok e origem

O Grok Worker foi executado em modo `act` com escopo exato deste diretório. Resultado `INCONCLUSIVO (exit 1)`: houve ação parcial nos derivados, mas não um pacote verificável. A fonte veio de `image_gen` integrado, com referência interna de `Champions/lee-sin/`. Grok Imagine não foi utilizado/disponível e não há recursos externos.

Próxima categoria: `death com margem interna segura`.
