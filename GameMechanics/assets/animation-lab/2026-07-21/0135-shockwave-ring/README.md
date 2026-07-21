# Shockwave Ring — candidato VFX

Rodada visual do laboratorio noturno do Bomba PvP. O efeito representa uma onda de choque circular de bomba, expandindo do nucleo brilhante para um anel de energia e particulas.

## Entrega

- `source-generated-grid.png`: fonte nativa gerada em uma grade 4x4 de 1254x1254.
- `source-upscaled-2048.png`: derivado ampliado para estudo; nao e uma fonte nativa 2048.
- `frames-312-v3/`: 16 frames com celulas de 312x312.
- `frames-runtime-256-v3/`: 16 frames derivados para uso de runtime.
- `spritesheet-source-4x4-312-v3.png`: atlas 1248x1248.
- `spritesheet-runtime-4x4-256-v3.png`: atlas 1024x1024.
- `preview/contact-sheet-v3.png`: contato visual inspecionado.
- `preview/shockwave-ring-preview-v3.gif`: preview de 16 frames, 60 ms por frame.
- `manifest.json`: prompt, origem, pipeline, timing e gates.

## Validação

Todos os 16 frames têm dimensões esperadas, conteúdo alpha visível e zero hits de alpha nas quatro bordas internas. A grade é divisível: 4x312 = 1248 e 4x256 = 1024. O GIF foi conferido com 16 frames e timing de 6 centissegundos por frame.

O Grok Worker foi acionado em modo `act`, mas excedeu o timeout de 240 segundos e não gravou arquivos. A extração, limpeza do chroma, atlas, preview e validação foram concluídas localmente com ImageMagick. Nenhum recurso externo foi adotado e o candidato não está conectado ao runtime.
