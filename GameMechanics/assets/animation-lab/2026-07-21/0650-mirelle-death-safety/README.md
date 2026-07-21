# Mirelle — death water-petal safety candidate

Rodada `2026-07-21 06:50 -03:00`. Candidato de `death` para o Champion existente `mirelle`, sem integração (`integration=false`) e sem alteração em `Champions/` ou no runtime.

## Entrega

- Fonte preservada: `source-generated-grid.png` (1254×1254 RGB, grade 4×4 magenta).
- Chroma-key removido: `source-chromakey-removed.png`, seguido de `source-grid-1248.png` (1248×1248, células 312×312).
- Derivados: 16 frames RGBA em `frames-512/` (512×512) e `frames-256/` (256×256).
- Atlases: `spritesheet-512-4x4.png` (2048×2048) e `spritesheet-256-4x4.png` (1024×1024).
- Inspeção: `preview/contact-sheet.png`, `preview/preview.gif` e `preview/frame-order.txt`.

## Validação

Os 16 frames estão ordenados, não vazios e uniformes. O alpha está presente e não toca as bordas; a margem mínima é 16 px nos frames de 512 e 7 px nos de 256. Os atlases correspondem exatamente às células discretas. A contact sheet está legível e o preview foi inspecionado em 16 frames de 110 ms. Não há halo magenta visível; o worker registrou apenas fringe de baixíssimo alpha, sem efeito perceptível.

## Grok e origem

O Grok Worker foi executado em modo `act` com escopo exato deste diretório. O wrapper encerrou com código 1 antes do veredito final, então o resultado é `INCONCLUSIVO`; deixou `_audit_check.py`, `_audit_gif.py` e `_audit_mag_sample.py` como evidência local. Os arquivos de produção permaneceram inalterados.

Fonte interna produzida por `image_gen` integrado, usando referências internas de `Champions/mirelle/`. Grok Imagine não foi utilizado/disponível e não há recursos externos.

Próxima categoria: `emote`.
