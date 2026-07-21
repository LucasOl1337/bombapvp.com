# Nix Ember — Ember Vault

## Candidato

Animação de habilidade especial para o Champion `nix-ember`. A sequência reúne brasas, abre as asas, lança o personagem em arco, marca o ápice com faíscas e termina em pouso controlado. O candidato está isolado no laboratório e não está integrado ao runtime.

## Arquivos

- `source-generated-grid.png`: fonte original do `image_gen`, 1254×1254.
- `source-chromakey-removed.png`: fonte RGBA após remoção do fundo verde.
- `source-grid-1248.png`: grade normalizada 4×4, com células de 312×312.
- `frames-512/`: 16 frames RGBA de 512×512.
- `frames-256/`: 16 derivados RGBA de 256×256.
- `spritesheet-512-4x4.png`: atlas 2048×2048.
- `spritesheet-256-4x4.png`: atlas 1024×1024.
- `preview/contact-sheet.png`: contact sheet 4×4 legível, com ordem numerada.
- `preview/preview.gif`: preview em loop com 16 frames a 90 ms.
- `manifest.json`: origem, prompt, ferramenta, ordem, timing, dimensões, alpha, validações e integração.

## Validação

As 16 células foram verificadas como não vazias, com grade divisível e alpha RGBA sem contato com as bordas internas. O preview tem 16 frames a 90 ms; a contact sheet e o primeiro quadro do preview foram inspecionados visualmente. A integração permanece `false` e o status permanece `Candidato`.

O `Invoke-GrokWorker.ps1` foi chamado em modo `act` com escopo exato deste diretório. O worker corrigiu a escala da pasta `frames-512` e regenerou atlases/previews, mas terminou com exit code 1 na validação final; isso está registrado no manifest. Grok Imagine ficou indisponível e não foi usado.

Nenhum recurso externo foi baixado ou adotado. Nenhum asset final em `Champions/`, código de runtime, `package.json` ou `package-lock.json` foi alterado.
