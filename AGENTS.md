# Contrato do repositorio

Este checkout contem o site Bomba PvP. Push na `main` publica o mesmo produto no Cloudflare em `bombapvp.com` (PT-BR) e `bombpvp.com` (EN).

- So faca commit, push ou deploy com ordem explicita do dono.
- Nunca use `git clean`, `git reset --hard`, `git checkout --` ou `git stash` neste checkout compartilhado.
- Nunca grave segredo, chave ou token no repositorio.
- Consulte INDEX.md para onde esta cada coisa e quando ler cada documento.

## Personagens (Grok / agentes de asset)

Ao **criar, regenerar ou plugar** um personagem (sprites, ultimate, roster, lab pack):

1. Leia **`docs/champion-sprite-pipeline.md`** antes de gerar frames ou registrar no catalogo.
2. Siga o modulo vertical em **`Champions/README.md`** (definition / skill / visuals / assets + registries).
3. Respeite o meta de bombas: plant **sem bomba no PNG**, ultimate unica, **4 direcoes reais**, alpha transparente com key cuidadoso (fuzz baixo nos cantos — nao coma armadura escura).
