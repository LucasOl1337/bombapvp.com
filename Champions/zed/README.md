# Zed

Assassino de sombra com presença dupla — máscara clássica, fendas âmbar, placas preto/carmesim e lâminas gêmeas. Vertical slice **Living Shadow** para playtest local.

- Identidade e cooldown de sucesso: `definition.ts` / `membership.ts`
- Mecânica executável: `GameMechanics/src/modules/skills/` (`zed-living-shadow`)
- Apresentação dual-body (clone carmesim): `GameMechanics/src/browser/main.ts` (somente se o seat usa a skill de Zed)
- Retrato 256² + sprites densos 160×160: `assets/`

## Skill — Living Shadow

Primeiro `R`: projeta sombra no tile cardinal livre mais distante (alcance 3; sólidos/caixas param o raio; bombas não bloqueiam). Corpo livre por 2000 ms **sem** imunidade de canalização. Segundo `R`: troca para a projeção se válida (CD 7000 ms); falha, timeout ou morte limpam a projeção e usam CD 4000 ms. A sombra não causa `skill-hit` nem planta bomba.

## Animation density (installed)

| Slot | Frames / dir | Notes |
| --- | --- | --- |
| idle | 6 | S/E/N/W, normalizado sobre os estáticos direcionais aprovados |
| walk | 8 | S/E/N/W, ciclo direcional normalizado |
| run | 8 | S/E/N/W, ciclo direcional acelerado |
| cast | 8 | S/E/N/W, pulso direcional da projeção |
| attack | 8 | S/E/N/W, avanço direcional sem bomba |
| death | 8 | S/E/N/W, queda direcional com dissipação |

Living Shadow presentation uses canvas crimson recolor of body frames (not a second identity PNG). Attack/plant frames must not draw a bomb (engine draws the bomb).

## Posture

Restricted non-monetized fan prototype. Selectable via character select or `?p1=zed` for local playtest. Not a default public seat and not authorized for deploy/monetize without separate captain authority.
