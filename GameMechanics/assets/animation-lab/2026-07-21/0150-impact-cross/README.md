# Impact Cross — candidato de hit VFX

Rodada do laboratorio noturno do Bomba PvP na categoria de impacto direcional. O efeito e uma explosao em cruz de quatro eixos, pensada para feedback de hit de bomba ou dano em uma celula da arena.

## Entrega selecionada

- `source-generated-grid.png`: fonte nativa gerada em grade 4x4 de 1254x1254.
- `source-upscaled-2048.png`: derivado ampliado para estudo; nao e fonte nativa 2048.
- `frames-312-v4/`: 16 frames de 312x312 com padding transparente para manter as bordas livres.
- `frames-runtime-256-v4/`: derivados de 256x256.
- `spritesheet-source-4x4-312-v4.png`: atlas 1248x1248.
- `spritesheet-runtime-4x4-256-v4.png`: atlas 1024x1024.
- `preview/contact-sheet-v4.png`: contato visual inspecionado.
- `preview/impact-cross-preview-v4.gif`: preview com 16 frames a 60 ms por frame.
- `manifest.json`: origem, prompt, pipeline, gates e limitações.

## Validação e ressalvas

Os 16 frames têm dimensões esperadas, conteúdo alpha visível e zero hits de alpha nas quatro bordas internas. A grade é divisível: 4x312 = 1248 e 4x256 = 1024. O GIF foi conferido com 16 frames e timing de 6 centissegundos.

Os frames centrais da fonte gerada têm braços muito largos; a variante v4 preserva padding transparente e fica como `Candidato`, não integrada ao runtime, até uma revisão visual de escala. O Grok Worker foi acionado em modo `act` com escopo único, mas não gravou arquivos dentro da janela curta. A transformação e a validação foram concluídas localmente com ImageMagick. Nenhum recurso externo foi adotado.
