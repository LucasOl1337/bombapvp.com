# HUD Streak Pop — candidato de feedback

Rodada de 21/07/2026 para um pop de streak/combinação sem texto: três marcas ciano e âmbar orbitam um diamante central, abrem em uma estrela curta e retornam ao agrupamento. O asset é isolado para compor em diferentes posições do HUD.

## Entrega

- Fonte visual: `source-generated-grid.png` (1254x1254 nativo do `image_gen`), com `source-upscaled-2048.png` como derivado de alta resolução.
- Frames candidatos: `frames-312-v2/` e `frames-runtime-256-v2/`.
- Atlases: `spritesheet-source-4x4-312-v2.png` e `spritesheet-runtime-4x4-256-v2.png`.
- Preview: `preview/contact-sheet-v2.png` e `preview/hud-streak-pop-preview-v2.gif`.
- Timing: 60 ms por frame, 960 ms por ciclo, loop.

## Validação

Os 16 frames têm 312x312, não há células vazias e nenhuma das quatro bordas contém alpha. Os atlases medem 1248x1248 e 1024x1024; o GIF contém 16 frames com timing de 6 centésimos por frame. O contact sheet foi inspecionado visualmente e mostra órbita, pop e retorno coerentes.

## Delegação e origem

O `Invoke-GrokWorker.ps1` foi chamado em modo `act`, com escopo exclusivo neste diretório e timeout de 25 s. O wrapper retornou exit code 1 depois da mensagem inicial e não gravou arquivos; Grok Imagine não estava disponível. A extração, organização, previews e validação foram concluídas localmente com ImageMagick.

Nenhum pack ou recurso externo foi baixado/adotado. O conteúdo foi gerado pelo `image_gen` integrado desta thread. Status: **Candidato**; não conectado ao runtime.
