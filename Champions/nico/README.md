# Nico

- Identidade e cooldown: `definition.ts`
- Contrato do efeito de mundo `NicoBeamEffect`: `contracts.ts`
- Arcane Beam, impacto e tiles atingidos: `skill.ts`
- Ciclo de vida do beam, preview, desenho e animação de cast: `visuals.ts`
- Retrato e 130 sprites: `assets/`
- Grimório privado: `assets/effects/nico-grimoire.png`, registrado como `NICO_ASSETS.effects.grimoire` e ainda sem consumidor no runtime

O protocolo preserva o campo legado `magicBeams` para compatibilidade de snapshots, mas o engine o trata apenas como `ChampionWorldEffect`. A criação, duração, remoção e apresentação continuam pertencendo à Nico.
