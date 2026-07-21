# Ranni — Victory Emote

## Candidato

Emote de vitória para o Champion `ranni`: cajado em elevação, constelação azul-gelo, floreio de capa, pose de vitória e retorno à calma. O candidato está isolado no laboratório e não está integrado ao runtime.

## Arquivos

- `source-generated-grid.png`: fonte original do `image_gen`, 1254×1254.
- `source-chromakey-removed.png`: fonte RGBA após remoção do fundo magenta.
- `source-grid-1248.png`: grade normalizada 4×4, com células de 312×312.
- `frames-512/`: 16 frames RGBA de 512×512.
- `frames-256/`: 16 derivados RGBA de 256×256.
- `spritesheet-512-4x4.png`: atlas 2048×2048.
- `spritesheet-256-4x4.png`: atlas 1024×1024.
- `preview/contact-sheet.png`: contact sheet legível, com ordem numerada.
- `preview/preview.gif`: preview em loop com 16 frames a 100 ms.
- `manifest.json`: prompt, origem, ferramenta, ordem, timing, dimensões, alpha, validações e integração.

## Validação

As 16 células foram verificadas como não vazias, com grade normalizada divisível e alpha RGBA sem contato com as bordas internas. O preview tem 16 frames a 100 ms; a contact sheet e o primeiro quadro do GIF foram inspecionados visualmente. O atlas fonte e o runtime-sized atlas foram conferidos pelo worker. A integração permanece `false` e o status permanece `Candidato`.

O `Invoke-GrokWorker.ps1` foi chamado em modo `act` com escopo exato deste diretório. O worker retornou PASS sem alterar assets; Grok Imagine não foi usado porque não era necessário para a organização/validação, e isso não é tratado como sucesso de geração.

Nenhum recurso externo foi baixado ou adotado. Nenhum asset final em `Champions/`, código de runtime, `package.json` ou `package-lock.json` foi alterado.
