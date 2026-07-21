# Arena Rally Beacon — candidato de feedback de arena

## Entrega

Feedback visual de arena para uma convocação/confirmação de zona: um beacon ciano e âmbar no piso, quatro chevrons direcionais e anéis concêntricos que se expandem até um pulso branco central antes de contrair. O motivo é novo em relação ao retículo de perigo e ao pulso territorial existentes.

## Arquivos

- `source-generated-grid.png`: grade original do `image_gen` integrado, 1254×1254 nativos.
- `source-upscaled-2048.png`: derivado ampliado para referência; não é uma fonte nativa 2048px.
- `source-grid-1248.png`: fonte normalizada com chroma-key removido.
- `frames-312-v2/`: 16 frames com alpha, 312×312.
- `frames-runtime-256-v2/`: derivados de runtime, 16 frames 256×256.
- `spritesheet-source-4x4-312-v2.png`: atlas 1248×1248.
- `spritesheet-runtime-4x4-256-v2.png`: atlas runtime 1024×1024.
- `preview/contact-sheet-v2.png`: contact sheet 4×4 legível.
- `preview/arena-rally-beacon-preview-v2.gif`: preview em loop.
- `manifest.json`: prompt, origem, pipeline, timing, validações e status.

## Validação

ImageMagick verificou 16 frames: `312×312`, nenhum frame vazio, zero alpha tocando as bordas internas, atlas fonte `1248×1248`, atlas runtime `1024×1024`, contact sheet `1024×1024` e GIF com 16 frames a 6 centésimos por frame (60 ms). A contact sheet foi inspecionada visualmente.

O wrapper `Invoke-GrokWorker.ps1` foi chamado em modo `act`, restrito a este diretório, mas retornou exit code 1 após a mensagem inicial e não produziu arquivos. O ambiente não ofereceu Grok Imagine; a conversão e a checagem foram concluídas localmente com ImageMagick.

Nenhum recurso externo foi baixado ou adotado. Status: **Candidato**; não conectado ao runtime.
