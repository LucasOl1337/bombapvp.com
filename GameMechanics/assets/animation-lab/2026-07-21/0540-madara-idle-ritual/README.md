# Madara — Idle Ritual

## Candidato

Loop de idle para `madara`: respiração contida, balanço mínimo do cabelo/manto, relaxamento de uma mão e brilho sutil dos olhos vermelhos. O candidato está isolado no laboratório e não está integrado ao runtime.

## Arquivos

- `source-generated-grid.png`: fonte original do `image_gen`, 1254×1254.
- `source-chromakey-removed.png`: fonte RGBA após remoção do fundo ciano.
- `source-grid-1248.png`: grade normalizada 4×4, células de 312×312.
- `frames-512/`: 16 frames RGBA de 512×512.
- `frames-256/`: 16 derivados RGBA de 256×256.
- `spritesheet-512-4x4.png`: atlas 2048×2048.
- `spritesheet-256-4x4.png`: atlas 1024×1024.
- `preview/contact-sheet.png`: contact sheet legível, com ordem numerada.
- `preview/preview.gif`: preview em loop com 16 frames a 120 ms.
- `manifest.json`: prompt, origem, ferramenta, ordem, timing, dimensões, alpha, validações e integração.

## Validação

As 16 células foram verificadas como não vazias, com grade normalizada divisível e alpha sem contato com bordas internas. Os atlases, frames 512/256 e GIF 16×120 ms passaram a validação estrutural. A contact sheet e o primeiro quadro do preview foram inspecionados; nenhum spill ciano é perceptível. A integração permanece `false` e o status permanece `Candidato`.

O `Invoke-GrokWorker.ps1` foi chamado em modo `act` com escopo exato deste diretório. O worker terminou exit code 1 antes do veredito final; sua auditoria não é tratada como PASS, e as conclusões acima vêm da validação local e inspeção visual. Grok Imagine não foi utilizado.

Nenhum recurso externo foi baixado ou adotado. Nenhum asset final em `Champions/`, código de runtime, `package.json` ou `package-lock.json` foi alterado.
