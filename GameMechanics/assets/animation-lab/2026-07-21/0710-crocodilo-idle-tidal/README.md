# Crocodilo Arcano — alternate idle candidate

Rodada `2026-07-21 07:10 -03:00`. Candidato de `idle alternativo` para o Champion existente `crocodilo-arcano`, sem integração (`integration=false`) e sem alteração em `Champions/` ou no runtime.

## Entrega

- Fonte preservada: `source-generated-grid.png` (1254×1254 RGB, grade 4×4 magenta).
- Chroma-key removido: `source-chromakey-removed.png`, seguido de `source-grid-1248.png` (1248×1248, células 312×312).
- Derivados 512: 16 frames em `frames-512/` e `spritesheet-512-4x4.png`.
- Derivados 256/preview escolhidos: `frames-256-v2/`, `spritesheet-256-4x4-v2.png`, `preview-v2/contact-sheet.png`, `preview-v2/preview.gif` e `preview-v2/frame-order.txt`.
- O atlas 256 original, alterado durante a tentativa do worker, permanece como WIP em `spritesheet-256-4x4.png`; não foi sobrescrito nem apagado.

## Validação

Os 16 frames de 512 e 256 são quadrados, não vazios e sem alpha nas bordas. As margens mínimas são 42 px e 22 px, respectivamente. Os atlases escolhidos correspondem exatamente às células discretas. A contact sheet está legível; o preview foi inspecionado em 16 frames de 120 ms. O idle é deliberadamente sutil, com respiração, brilho do visor, microajustes de ombro/cauda e um sparkle curto; a inspeção local considerou a variação coerente para um candidato alternativo.

## Grok e origem

O Grok Worker foi executado em modo `act` com escopo exato deste diretório. O wrapper encerrou com código 1 antes do veredito final e deixou `_audit_tmp.py`; durante a tentativa, o atlas 256 original ficou inconsistente. O resultado é `INCONCLUSIVO`, não `PASS`. A versão v2 foi reconstruída localmente a partir dos frames discretos sem alterar o WIP original.

Fonte interna produzida por `image_gen` integrado, usando referências internas de `Champions/crocodilo-arcano/`. Grok Imagine não foi utilizado/disponível; não há recursos externos, packs ou downloads.

Próxima categoria: `attack alternate`.
