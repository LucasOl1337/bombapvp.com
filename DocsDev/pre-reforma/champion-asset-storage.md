# Armazenamento de assets de autoria

O Git normal do BombPVP guarda somente o que torna um Champion reproduzível e executável:

- `Champions/<slug>/assets/` com retrato, animações e efeitos finais;
- `README.md`, `DESIGN.md`, manifests, índices, checksums e receitas de geração;
- código e testes do módulo vertical.

Vídeos, bases opacas, frames extraídos, outputs temporários e rebuilds binários não entram em novos commits. Eles podem continuar localmente em `Champions/<slug>/experiments/` ou `Champions/<slug>/rebuild/`; o `.gitignore` protege os binários e permite somente `README.md`, `DESIGN.md`, `manifest.json`, `*-INDEX.md`, `CHECKSUMS.*`, `recipe.*` e `receita.*`. Quando os brutos precisarem ser compartilhados, deve-se escolher armazenamento de arte ou Git LFS em uma decisão dedicada, preservando checksums e a relação com o manifest.

Os binários históricos já rastreados permanecem intactos. Esta política não autoriza apagar arquivos, reescrever histórico nem migrar blobs existentes sem uma tarefa explícita.
