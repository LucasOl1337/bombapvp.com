# Lee Sin — Hit Reaction (descartado)

## Resultado

Esta tentativa foi descartada. A fonte 4×4 gerada pelo `image_gen` contém bleed entre células: os frames 08–11 carregam um fragmento da cabeça da pose seguinte e os frames 12–15 ficam cortados no topo. O reencaixe dos derivados deixou as dimensões corretas, mas não corrige uma fonte visualmente inválida.

## Arquivos preservados

- `source-generated-grid.png`: fonte original, 1254×1254.
- `source-chromakey-removed.png`: fonte RGBA após remoção do chroma-key.
- `source-grid-1248.png`: grade normalizada 4×4, células de 312×312.
- `frames-512/` e `frames-256/`: derivados mantidos para auditoria, não para integração.
- `spritesheet-512-4x4.png` e `spritesheet-256-4x4.png`: atlases derivados.
- `preview/contact-sheet.png`: contact sheet inspecionada e usada para detectar o bleed.
- `preview/preview.gif`: preview não promovido.
- `manifest.json`: falha, origem, timing, validações e decisão.

O `Invoke-GrokWorker.ps1` foi chamado em modo `act` com escopo exato deste diretório. Terminou com exit code 1 após a mensagem inicial e não confirmou reparo. Grok Imagine ficou indisponível e não foi usado.

Nenhum asset final em `Champions/`, código de runtime, `package.json` ou `package-lock.json` foi alterado; `integration=false` permanece registrado.
