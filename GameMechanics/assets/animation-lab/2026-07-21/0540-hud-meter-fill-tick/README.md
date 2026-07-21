# HUD Meter Fill Tick — candidato de animação curta de HUD

## Entrega

Animação de 16 frames para uma barra de recurso: três segmentos chanfrados preenchem em sequência, recebem brilho teal/dourado e retornam ao contorno ocioso. O pacote permanece como `Candidato` e não foi conectado ao runtime.

## Arquivos

- `source-generated-grid.png` — fonte nativa do image_gen, 1536x1024, grade 4x4 retangular.
- `source-chromakey-removed.png` — fonte com alpha após remoção do fundo verde.
- `source-upscaled-2048.png` — derivado proporcional em 2048x1365; não é resolução nativa.
- `source-grid-1536x1024.png` — grade normalizada preservando o formato nativo.
- `frames-312-v2/frame-00.png` ... `frame-15.png` — frames fonte centralizados, 312x312, em ordem row-major.
- `frames-runtime-256-v2/frame-00.png` ... `frame-15.png` — derivados de runtime, 256x256.
- `spritesheet-source-4x4-312-v2.png` — atlas fonte 1248x1248.
- `spritesheet-runtime-4x4-256-v2.png` — atlas runtime 1024x1024.
- `preview/contact-sheet-v2.png` — contact sheet 1024x1024 para inspeção visual.
- `preview/hud-meter-fill-tick-preview-v2.gif` — preview em loop, 60ms por frame.
- `manifest.json` — prompt, origem, pipeline, ordem, timing, validações e licença.

## Pipeline e validação

O image_gen integrado gerou uma grade nativa retangular; `remove_chroma_key.py` aplicou auto-key na borda, soft matte, despill e contração de borda. ImageMagick preservou o aspecto da grade ao extrair células 384x256, centralizando cada barra em 312x312 e produzindo os derivados. A tentativa do Grok em modo `act`, limitada a este diretório, terminou com exit code 1 e nenhum arquivo; Grok Imagine não estava disponível, então o fallback local foi usado e registrado no manifesto.

Validação concluída: 16 frames, todos 312x312, vazios `0`, alpha nas bordas internas `0`, atlas fonte 1248x1248, atlas runtime 1024x1024, contact sheet 1024x1024 e GIF com 16 frames a 6 centésimos (60ms) por frame.

Nenhum recurso externo foi baixado ou adotado. `status: Candidato`; integração de runtime: `false`.
