# Power-up Prism Ascension — candidato de power-up

Power-up curto para o Bomba PvP: um fragmento prismático ciano-violeta reúne três motas douradas, sobe por uma coluna triangular, se abre em uma coroa cristalina, pulsa com um núcleo branco e retorna ao estado compacto. A silhueta angular separa o efeito de chama, velocidade, escudo, orbe de carga, portal, regeneração e tesseract.

## Conteúdo

- `source-generated-grid.png`: fonte do image_gen em 1254x1254 com grade 4x4 e chroma-key verde.
- `source-chromakey-removed.png`: fonte com alpha derivado pelo `remove_chroma_key.py`.
- `source-upscaled-2048.png`: derivado proporcional de alta resolução; não é fonte nativa 2048px.
- `frames-312-v2/`: 16 frames transparentes de 312x312, em ordem row-major.
- `frames-runtime-256-v2/`: 16 derivados de runtime de 256x256.
- `spritesheet-source-4x4-312-v2.png`: atlas 1248x1248.
- `spritesheet-runtime-4x4-256-v2.png`: atlas de runtime 1024x1024.
- `preview/contact-sheet-v2.png`: contact sheet 1024x1024 sobre fundo escuro.
- `preview/powerup-prism-ascension-preview-v2.gif`: preview de 16 frames a 60ms por frame.

## Validação e origem

Todos os 16 frames têm 312x312, não há células vazias e nenhum pixel alpha toca as quatro bordas internas. Os atlas e o contact sheet têm dimensões divisíveis e o contact sheet foi inspecionado visualmente. O preview mantém 16 frames com timing de 6 centésimos (60ms) por frame.

O Grok foi chamado em modo `act` com escopo exclusivo nesta pasta para conferir a grade e a organização. Não produziu arquivos neste turno; a extração, o alpha, o atlas, o contact sheet e o GIF foram concluídos localmente com ImageMagick. Grok Imagine não estava disponível e não foi alegado como usado.

Status: **Candidato**. Não conectado ao runtime.
