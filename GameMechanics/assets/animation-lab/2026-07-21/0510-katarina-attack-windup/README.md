# Katarina — Attack Windup (descartado)

## Resultado

Esta rodada foi descartada. A fonte 4×4 gerou 16 poses coerentes e os derivados passaram as checagens estruturais, mas o fundo verde deixou um halo oliva/verde visível no cabelo e nas lâminas. Foram tentadas quatro derivações: remoção básica, `edge-contract 1`, limpeza seletiva de spill e limpeza estrita por célula. Nenhuma ficou visualmente limpa o bastante para promoção.

## Arquivos preservados

- `source-generated-grid.png`: fonte original do `image_gen`, 1254×1254.
- `source-chromakey-removed-v*.png`: variantes RGBA de remoção de chroma-key.
- `source-grid-1248-v*.png`: grades normalizadas 4×4.
- `frames-512-v4/` e `frames-256-v4/`: última tentativa, 16 frames em 512²/256².
- `spritesheet-*-v4.png`: atlases derivados.
- `preview-v4/contact-sheet.png` e `preview-v4/preview.gif`: última inspeção visual.
- `manifest.json`: prompt, origem, validações, falha e decisão.

O `Invoke-GrokWorker.ps1` foi chamado em modo `act` com escopo exato deste diretório. Terminou com exit code 1 durante a auditoria do halo; não confirmou sucesso. Grok Imagine não foi usado e nenhum sucesso foi inventado.

Nenhum asset final em `Champions/`, código de runtime, `package.json` ou `package-lock.json` foi alterado; `integration=false` permanece registrado.
