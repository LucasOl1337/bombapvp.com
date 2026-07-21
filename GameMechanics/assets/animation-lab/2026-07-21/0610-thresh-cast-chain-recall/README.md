# Thresh — cast chain-recall candidate

Rodada `2026-07-21 06:10 -03:00`. Candidato experimental de `cast` para o Champion existente `thresh`, sem integração (`integration=false`) e sem alteração em `Champions/` ou no runtime.

## Entrega preservada

- Fonte: `source-generated-grid.png` (1254×1254 RGB, grade 4×4 magenta).
- Chroma-key: `source-chromakey-removed.png`, seguido de `source-grid-1248.png` (1248×1248, células 312×312).
- Derivados: 16 frames RGBA em `frames-512/` (512×512) e `frames-256/` (256×256).
- Atlases: `spritesheet-512-4x4.png` (2048×2048) e `spritesheet-256-4x4.png` (1024×1024).
- Inspeção: `preview/contact-sheet.png`, `preview/preview.gif` e `preview/frame-order.txt`.

## Validação e decisão

Os 16 frames estão ordenados, não vazios, quadrados e com alpha. A contact sheet e o preview de 16 frames a 110 ms foram inspecionados; não há halo magenta visível. Porém, os frames 03, 06, 07, 08, 09, 12 e 13 têm alpha acima do limiar de auditoria tocando uma borda da célula, por causa de chamas espectrais e do anel de chão. Isso seria arriscado em um atlas de runtime, então o status é `Descartado`.

O Grok Worker foi executado em modo `act` no escopo exato deste diretório. Retornou `FAIL`, não modificou arquivos e confirmou que uma limpeza simples cortaria efeitos intencionais. A fonte e os derivados permanecem apenas para auditoria; nenhuma exclusão ou sobrescrita foi feita.

Fonte interna produzida por `image_gen` integrado, usando referências internas de `Champions/thresh/`. Grok Imagine não foi utilizado/disponível e não há recursos externos.

Próxima categoria: `cast com margem interna segura`.
