# Killer Bee — Run Jetstep (descartado)

## Resultado

Esta tentativa foi descartada. A fonte magenta gerou 16 poses de corrida coerentes e os derivados passaram as checagens estruturais, mas a remoção de chroma deixou uma franja púrpura/magenta visível nas asas e na armadura. A v2 aplicou `edge-contract 1` e limpeza seletiva de spill, sem remover o halo de modo visualmente aceitável.

## Arquivos preservados

- `source-generated-grid.png`: fonte original do `image_gen`, 1254×1254.
- `source-chromakey-removed-v2.png`: última fonte RGBA processada.
- `source-grid-1248-v2.png`: grade normalizada 4×4, células de 312×312.
- `frames-512-v2/` e `frames-256-v2/`: 16 frames derivados em 512²/256².
- `spritesheet-*-v2.png`: atlases derivados.
- `preview-v2/contact-sheet.png` e `preview-v2/preview.gif`: última inspeção visual.
- `manifest.json`: prompt, origem, validações, falha e decisão.

O `Invoke-GrokWorker.ps1` foi chamado em modo `act` com escopo exato deste diretório. Terminou exit code 1 durante a auditoria e não confirmou reparo. Grok Imagine não foi utilizado.

Nenhum asset final em `Champions/`, código de runtime, `package.json` ou `package-lock.json` foi alterado; `integration=false` permanece registrado.
