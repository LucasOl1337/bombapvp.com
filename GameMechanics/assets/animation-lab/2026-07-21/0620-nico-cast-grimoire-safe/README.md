# Nico — cast grimoire safe-margin candidate

Rodada `2026-07-21 06:20 -03:00`. Candidato de `cast` para o Champion existente `nico`, sem integração (`integration=false`) e sem alteração em `Champions/` ou no runtime.

## Entrega

- Fonte preservada: `source-generated-grid.png` (1254×1254 RGB, grade 4×4 ciano).
- Chroma-key removido: `source-chromakey-removed.png`, com matte suave, despill e `edge-contract 1`.
- Grade normalizada: `source-grid-1248.png` (1248×1248, células 312×312).
- Derivados: 16 frames RGBA em `frames-512/` (512×512) e `frames-256/` (256×256).
- Atlases: `spritesheet-512-4x4.png` (2048×2048) e `spritesheet-256-4x4.png` (1024×1024).
- Inspeção: `preview/contact-sheet.png`, `preview/preview.gif` e `preview/frame-order.txt`.

## Validação

Os 16 frames `frame-00` a `frame-15` estão ordenados, não vazios e uniformes. O alpha está presente e nenhum frame toca a borda acima de `a=8`; a margem mínima é 16 px nos frames de 512 (7 px nos de 256). As dimensões da grade e dos atlases são divisíveis em 4×4. A contact sheet está legível e o preview foi inspecionado em 16 frames de 100 ms. Não há halo ciano perceptível.

## Grok e origem

O Grok Worker foi executado em modo `act` com escopo exato deste diretório. O wrapper encerrou com código 1 antes do veredito final, portanto o resultado é `INCONCLUSIVO`; os quatro arquivos `_audit_gif_00.png`, `_audit_gif_13.png`, `_audit_gif_14.png` e `_audit_gif_15.png` foram deixados no diretório como evidência da inspeção. Nenhum arquivo de produção foi alterado pelo worker.

Fonte interna produzida por `image_gen` integrado, usando referências internas de `Champions/nico/`. Grok Imagine não foi utilizado/disponível; não há recursos externos, packs ou downloads.

Próxima categoria: `ultimate`.
