# Powerup Portal Rift — candidato de power-up

## Entrega

Portal de pickup ciano e dourado: um diamante central convoca quatro brackets angulares, abre um rift oval luminoso com flash branco e fecha de volta ao diamante. O motivo amplia a família de power-ups sem repetir chama, velocidade, escudo ou orb de carga.

## Arquivos

- `source-generated-grid.png`: grade original do `image_gen` integrado, 1254×1254 nativos.
- `source-chromakey-removed.png`: fonte com chroma-key removido pelo helper local.
- `source-upscaled-2048.png`: derivado ampliado para referência; não é uma fonte nativa 2048px.
- `source-grid-1248.png`: fonte normalizada com alpha limpo.
- `frames-312-v2/`: 16 frames com alpha, 312×312.
- `frames-runtime-256-v2/`: derivados de runtime, 16 frames 256×256.
- `spritesheet-source-4x4-312-v2.png`: atlas 1248×1248.
- `spritesheet-runtime-4x4-256-v2.png`: atlas runtime 1024×1024.
- `preview/contact-sheet-v2.png`: contact sheet 4×4 legível.
- `preview/powerup-portal-rift-preview-v2.gif`: preview em loop.
- `manifest.json`: prompt, origem, pipeline, timing, validações e status.

## Validação

ImageMagick verificou 16 frames: `312×312`, nenhum frame vazio, zero alpha tocando as bordas internas, atlas fonte `1248×1248`, atlas runtime `1024×1024`, contact sheet `1024×1024` e GIF com 16 frames a 6 centésimos por frame (60 ms). A contact sheet foi inspecionada visualmente após corrigir o chroma-key com `remove_chroma_key.py` usando auto-key, soft matte, despill e `edge-contract 1`.

O wrapper `Invoke-GrokWorker.ps1` foi chamado em modo `act`, restrito a este diretório, mas retornou exit code 1 após a mensagem inicial e não produziu arquivos. O ambiente não ofereceu Grok Imagine; a conversão e a checagem foram concluídas localmente com ImageMagick.

Nenhum recurso externo foi baixado ou adotado. Status: **Candidato**; não conectado ao runtime.
