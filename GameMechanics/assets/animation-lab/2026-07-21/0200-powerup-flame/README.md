# Power-up Flame — candidato de coleta

Rodada do laboratorio noturno do Bomba PvP na categoria de power-up. O efeito apresenta uma chama pulsando sobre uma base metalica, com brilho e particulas; nos frames finais a base some, sugerindo a coleta do item.

## Entrega selecionada

- `source-generated-grid.png`: fonte nativa gerada em grade 4x4 de 1254x1254.
- `source-upscaled-2048.png`: derivado ampliado para estudo; nao e fonte nativa 2048.
- `frames-312-v2/`: 16 frames de 312x312 com padding transparente.
- `frames-runtime-256-v2/`: derivados de 256x256.
- `spritesheet-source-4x4-312-v2.png`: atlas 1248x1248.
- `spritesheet-runtime-4x4-256-v2.png`: atlas 1024x1024.
- `preview/contact-sheet-v2.png`: contato visual inspecionado.
- `preview/powerup-flame-preview-v2.gif`: preview com 16 frames a 60 ms por frame.
- `manifest.json`: origem, prompt, pipeline, gates e limitações.

## Validação

Os 16 frames têm dimensões esperadas, conteúdo alpha visível e zero hits de alpha nas quatro bordas internas. A grade é divisível: 4x312 = 1248 e 4x256 = 1024. O GIF foi conferido com 16 frames e timing de 6 centissegundos.

O Grok Worker foi acionado em modo `act` com escopo único, mas não gravou arquivos dentro da janela curta. A extração, limpeza do chroma, padding, atlas, preview e validação foram concluídos localmente com ImageMagick. Nenhum recurso externo foi adotado e o candidato não está conectado ao runtime.
