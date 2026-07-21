# Champions

`Champions/` é o módulo canônico de conteúdo dos personagens jogáveis. Ele preserva
identidade estável, definições, metadados de apresentação, perfis de bots e assets finais.

## Estrutura

- `membership.ts`: fonte única de slug, UUID, skill ID e ordem do elenco.
- `catalog.ts`: descoberta das definições `*/definition.ts`.
- `assets.ts` e `assets-catalog.ts`: parser e catálogo dos bundles finais.
- `bots.ts`: perfis canônicos Bomb, Pingo, V1, V2 e V3.
- `<slug>/identity.ts`: identidade local derivada do membership.
- `<slug>/definition.ts`: textos e metadados de apresentação.
- `<slug>/assets.ts` e `<slug>/assets/`: sprites, retrato e efeitos finais.

## Limite de ownership

`Champions/` não contém runtime de gameplay, `SkillContext`, `skill.ts`, `visuals.ts` nem
uma segunda implementação das habilidades. Toda regra executável pertence a
`GameMechanics/src/modules/skills/`; o browser adapter em `GameMechanics/src/browser/`
transforma o conteúdo visual em apresentação local.

## Adicionando um personagem

1. Leia `docs/sprites.md`.
2. Registre a identidade em `membership.ts`.
3. Crie `identity.ts`, `definition.ts`, `assets.ts` e os PNGs finais.
4. Implemente a mecânica exclusivamente em `GameMechanics/src/modules/skills/`.
5. Adicione os testes em `GameMechanics/tests/`.
