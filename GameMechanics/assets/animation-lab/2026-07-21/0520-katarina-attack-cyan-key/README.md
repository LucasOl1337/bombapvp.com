# Katarina — Attack Windup (cyan-key)

## Candidato

Sequência de ataque para `katarina`: saque das duas lâminas, cortes alternados, cruzamento duplo com arcos vermelhos contidos e recuperação. A versão aceita é a v2, usando chroma-key ciano para evitar contaminação do cabelo vermelho e dos olhos verdes. O candidato está isolado no laboratório e não está integrado ao runtime.

## Arquivos aceitos

- `source-generated-grid.png`: fonte original do `image_gen`, 1254×1254.
- `source-chromakey-removed-v2.png`: fonte RGBA com remoção de ciano, `edge-contract 1`, soft matte e despill.
- `source-grid-1248-v2.png`: grade normalizada 4×4, células de 312×312.
- `frames-512-v2/`: 16 frames RGBA de 512×512.
- `frames-256-v2/`: 16 derivados RGBA de 256×256.
- `spritesheet-512-4x4-v2.png`: atlas 2048×2048.
- `spritesheet-256-4x4-v2.png`: atlas 1024×1024.
- `preview-v2/contact-sheet.png`: contact sheet legível, com ordem numerada.
- `preview-v2/preview.gif`: preview em loop com 16 frames a 80 ms.
- `manifest.json`: prompt, origem, ferramenta, ordem, timing, dimensões, alpha, validações e integração.

## Validação

As 16 células foram verificadas como não vazias, com grade normalizada divisível e alpha sem contato com bordas internas. Os atlases têm dimensões divisíveis 4×4; o GIF tem 16 frames a 80 ms. A contact sheet e o primeiro frame do preview foram inspecionados. Não há bleed entre células nem halo ciano perceptível na versão v2; realces metálicos e antialiasing de baixa intensidade permanecem registrados, sem serem confundidos com fundo.

O `Invoke-GrokWorker.ps1` foi chamado em modo `act` com escopo exato deste diretório. O worker terminou exit code 1 após a auditoria, mas reportou estrutura limpa e residual ciano apenas em alpha≈1; a validação local confirmou as dimensões, alpha, atlases e GIF. Grok Imagine não foi utilizado.

Nenhum recurso externo foi baixado ou adotado. Nenhum asset final em `Champions/`, código de runtime, `package.json` ou `package-lock.json` foi alterado.
