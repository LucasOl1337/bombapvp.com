# TypeScript canonico

## Question

Qual linguagem deve implementar o runtime compartilhado de gameplay?

## Decision

Usar TypeScript strict para kernel, composicao, browser e servidor. A escolha e
nova e deliberada: permite executar a mesma simulacao no navegador, nos testes
e no Cloudflare Worker sem uma ponte entre linguagens.

Posicao, tempo e quantidades sensiveis ao replay usam representacoes inteiras ou
fixed-point. Rust/Wasm pode substituir um hotspot isolado somente se um
benchmark demonstrar necessidade real.

## Consequences

- Python, Go e Rust nao entram no caminho principal da gameplay.
- Nao existe segunda implementacao server-side das regras.
- Otimizacao parte de evidencia, nao de antecipacao.
