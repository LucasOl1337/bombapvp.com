# Killer Bee — run/jetstep cyan-key candidate

Rodada `2026-07-21 06:00 -03:00`. Candidato de `walk/run` para o Champion existente `killer-bee`, sem integração (`integration=false`) e sem alteração em `Champions/` ou no runtime.

## Entrega

- Fonte preservada: `source-generated-grid.png` (1254×1254 RGB, grade 4×4).
- Chroma-key removido: `source-chromakey-removed.png`, com matte suave, despill e `edge-contract 1`.
- Grade normalizada: `source-grid-1248.png` (1248×1248, células 312×312).
- Derivados: 16 frames RGBA em `frames-512/` (512×512) e `frames-256/` (256×256).
- Atlases: `spritesheet-512-4x4.png` (2048×2048) e `spritesheet-256-4x4.png` (1024×1024).
- Inspeção: `preview/contact-sheet.png`, `preview/preview.gif` e `preview/frame-order.txt`.

## Validação

Os 16 frames `frame-00` a `frame-15` estão ordenados, não vazios e com dimensões uniformes. O alpha está presente, não toca as bordas internas e mantém margem mínima de 22 px nos frames de 512 (11 px nos de 256). A contact sheet está legível e o preview foi inspecionado em 16 frames de 100 ms. Não há halo ciano visível; os poucos resíduos medidos no thruster são subvisíveis e foram mantidos para não degradar o antialiasing da chama.

## Recurso e auditoria

Fonte interna produzida por `image_gen` integrado, usando como referência o portrait e um frame de corrida de `Champions/killer-bee/`. Não foram usados packs externos, downloads ou tokens no repositório; Grok Imagine não foi utilizado/disponível.

O Grok Worker foi executado em modo `act` com escopo exato deste diretório. Retornou `PASS`, não modificou arquivos e confirmou estrutura, alpha, spill, contato e timing.

Próxima categoria: `cast`.
