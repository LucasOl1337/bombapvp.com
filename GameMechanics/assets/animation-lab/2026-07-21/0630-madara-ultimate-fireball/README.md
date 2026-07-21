# Madara — ultimate Fireball Jutsu candidate

Rodada `2026-07-21 06:30 -03:00`. Candidato de `ultimate` para o Champion existente `madara`, sem integração (`integration=false`) e sem alteração em `Champions/` ou no runtime.

## Entrega

- Fonte preservada: `source-generated-grid.png` (1254×1254 RGB, grade 4×4 magenta). A fonte bruta contém divisórias brancas desenhadas pelo gerador; isso não foi escondido nem usado como asset final.
- Chroma-key removido: `source-chromakey-removed.png`.
- Grade normalizada: `source-grid-1248.png` (1248×1248, células 312×312).
- Derivados: 16 frames RGBA em `frames-512/` (512×512) e `frames-256/` (256×256).
- Atlases: `spritesheet-512-4x4.png` (2048×2048) e `spritesheet-256-4x4.png` (1024×1024).
- Inspeção: `preview/contact-sheet.png`, `preview/preview.gif` e `preview/frame-order.txt`.

## Validação

Os 16 frames `frame-00` a `frame-15` estão ordenados, não vazios e uniformes. Após a limpeza segura dos derivados, nenhum frame toca a borda, inclusive em 256 px; a margem mínima é 2 px em ambas as escalas. Os atlases foram reconstruídos por cópia exata das células. A contact sheet está legível e o preview foi inspecionado em 16 frames de 110 ms. Não há halo magenta visível.

## Grok e origem

O Grok Worker foi executado em modo `act` com escopo exato deste diretório. Retornou `PASS` e removeu apenas poeira de chroma/alpha nas bordas dos derivados, reconstruiu os dois atlases e regenerou o GIF. As fontes, a contact sheet e a ordem dos frames permaneceram intactas.

Fonte interna produzida por `image_gen` integrado, usando referências internas de `Champions/madara/`. Grok Imagine não foi utilizado/disponível; não há recursos externos, packs ou downloads.

Próxima categoria: `death`.
