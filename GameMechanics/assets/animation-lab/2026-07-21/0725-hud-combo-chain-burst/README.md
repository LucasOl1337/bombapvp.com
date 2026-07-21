# HUD Combo Chain Burst — candidato de animação curta de HUD

Confirmação de combo para o Bomba PvP. Um badge diamante ciano recebe dois chevrons, ganha uma corrente violeta, confirma três ticks dourados e comprime num brilho branco-azul.

## Conteúdo

- `source-generated-grid.png`: fonte gerada em grade 4x4, 1254x1254.
- `source-chromakey-removed.png`: fonte com o chroma-key removido e alpha preparado.
- `source-upscaled-2048.png`: derivado de alta resolução, 2048x2048.
- `frames-312-v2/`: 16 frames RGBA, 312x312, ordem row-major.
- `frames-runtime-256-v2/`: derivados de runtime, 16 frames 256x256.
- `spritesheet-source-4x4-312-v2.png`: atlas 1248x1248.
- `spritesheet-runtime-4x4-256-v2.png`: atlas de runtime 1024x1024.
- `preview/contact-sheet-v2.png`: contact sheet 1024x1024 sobre fundo de arena escuro.
- `preview/hud-combo-chain-burst-preview-v2.gif`: preview em loop, 60ms por frame.

## Processamento e validação

O chroma-key foi removido pelo helper local `remove_chroma_key.py`; os frames foram recortados com margem interna para evitar alpha na borda. A validação retornou `16` frames, `empty=0`, `edgeHits=0`, dimensões de atlas `1248x1248` e `1024x1024`, contact sheet `1024x1024` e GIF com 16 frames a 6 centésimos por frame. O contact sheet foi inspecionado visualmente.

O Grok foi invocado em modo `act` com escopo exclusivo deste diretório, mas o wrapper encerrou com falha após receber o escopo e não produziu arquivos; o fallback local concluiu o processamento. Grok Imagine não estava disponível.

Nenhum recurso externo foi adotado. Status: `Candidato`; não conectado ao runtime.
