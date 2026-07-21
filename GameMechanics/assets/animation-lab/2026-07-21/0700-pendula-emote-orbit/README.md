# Pendula — emote clock-orbit candidate

Rodada `2026-07-21 07:00 -03:00`. Candidato de `emote` para o Champion existente `pendula`, sem integração (`integration=false`) e sem alteração em `Champions/` ou no runtime.

## Entrega

- Fonte preservada: `source-generated-grid.png` (1254×1254 RGB, grade 4×4 ciano).
- Chroma-key removido: `source-chromakey-removed.png`, seguido de `source-grid-1248.png` (1248×1248, células 312×312).
- Derivados de produção v4: 16 frames RGBA em `frames-512-v4/` (512×512) e `frames-256-v4/` (256×256).
- Atlases v4: `spritesheet-512-4x4-v4.png` (2048×2048) e `spritesheet-256-4x4-v4.png` (1024×1024).
- Inspeção v4: `preview-v4/contact-sheet.png`, `preview-v4/preview.gif` e `preview-v4/frame-order.txt`.
- WIPs anteriores `v2` e `v3` permanecem preservados e não foram sobrescritos.

## Validação

Os 16 frames v4 estão ordenados, não vazios, quadrados e com alpha sem toque nas bordas. A margem mínima é 2 px em ambas as escalas. Os atlases correspondem exatamente às células discretas. O v4 remove somente um fragmento desconectado no rodapé dos frames 08–11, sem cortar Pendula ou o relógio-orbe. A contact sheet está legível e o preview foi inspecionado em 16 frames de 100 ms. Não há spill ciano perceptível.

## Grok e origem

O Grok Worker foi executado em modo `act` com escopo exato deste diretório. Retornou `PASS`, confirmou a limpeza de seam, os atlases, alpha, ordem e timing, e normalizou RGB invisível nos frames v4 sem alteração visual.

Fonte interna produzida por `image_gen` integrado, usando referências internas de `Champions/pendula/`. Grok Imagine não foi utilizado/disponível; não há recursos externos, packs ou downloads.

Próxima categoria: `idle alternativo`.
