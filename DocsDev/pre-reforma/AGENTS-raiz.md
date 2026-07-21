# Contrato do repositorio

Este checkout contem o site Bomba PvP. Push na `main` publica o mesmo produto no Cloudflare em `bombapvp.com` (PT-BR) e `bombpvp.com` (EN). Nao ha espelho/staging separado: o que sobe na `main` e o que o publico joga.

- So faca commit, push ou deploy com ordem explicita do dono.
- Nunca use `git clean`, `git reset --hard`, `git checkout --` ou `git stash` neste checkout compartilhado.
- Nunca grave segredo, chave ou token no repositorio.
- Nunca apague blob historico de asset nem reescreva historico git sem tarefa explicita do dono.
- Consulte INDEX.md para onde esta cada coisa e quando ler cada documento.
