# Thresh

Carcereiro espectral inspirado no Thresh de League of Legends — caveira verde com chamas, lanterna e gancho com corrente. Ultimate de puxão em linha reta.

- Identidade e cooldown: `definition.ts`
- Death Sentence (skill-shot hook + pull): `skill.ts`
- Animação de cast e FX da corrente espectral: `visuals.ts`
- Retrato e sprites densos 160×160: `assets/`
- Fontes hi-res / keyframes / pipeline: `rebuild/` (local, fora do runtime)

## Skill — Sentença de Morte

Arremessa o gancho em linha cardinal (até 4 tiles, voo de 300 ms). O gancho é um **projétil vivo**: estende a cada tick e agarra o primeiro inimigo tocado já no contato (puxão instantâneo). Paredes e caixas bloqueiam; bombas não. A vítima é puxada para o tile livre mais próximo do Thresh (adjacente preferido). Acerto = cooldown cheio (8 s); erro = metade (4 s). Efeito de mundo: corrente espectral verde com elos pulsantes, cabeça de gancho e flash no alvo.

## Asymmetry markers (identity lock)

| Detail | Character side | Front (viewer) | Right profile | Back (viewer) |
| --- | --- | --- | --- | --- |
| Spectral lantern | LEFT hand | RIGHT | far/near varia | LEFT* |
| Hook + chain | RIGHT hand | LEFT | near/far varia | RIGHT* |

\* A geração da vista de costas (north) manteve lanterna à esquerda do viewer e gancho à direita — inconsistente com o lock de mãos (ver defeitos).

## Animation density (shipped)

| Slot | Frames / dir | Notes |
| --- | --- | --- |
| idle | 8 | bob sintético sobre base identity-locked (south/east/north reais) |
| walk | 8 | keyframes `image_edit` reais por direção; ciclo de 8 fases |
| cast | 6 | hook-throw real por direção (wind-up → whirl → release → extensão → recover) |
| attack | 4 | gesto de plantar, mão vazia — sem bomba no PNG |
| death | 4 | colapso one-shot, hold no último frame |

Final cell size: **160×160** RGBA. Bundle: 120 frames de animação + 4 estáticos + retrato 256². **West = espelho horizontal do east** em todos os slots (permitido por `docs/sprites.md`).

## Pipeline (rebuild/)

1. Bases 1024² via Grok `image_gen`/`image_edit` com style lock (`prompt-bases.txt`).
2. Keyframes por ação/direção via `image_edit` encadeado (`prompt-keyframes-*.txt`) — vídeo (`image_to_video`/API direta) foi tentado e **rejeitado**: drift severo de identidade (rosto humanoide) e fundo claro.
3. `pipeline.py install`: key preto estrito (thr 18, flood dos cantos) → `content_bbox` → fit **foot-anchored** 160×160 → west espelhado → estáticos + retrato.
4. QA: GIFs por ação/direção em `rebuild/sheets/final/`.

## Honest defects / next polish

1. **West espelhado** em tudo — lanterna/gancho trocam de mão no west (assimetria invertida).
2. **North (costas)** mantém lanterna à esquerda do viewer, inconsistente com o lock de mãos da frente.
3. **cast-east/north**: frames de extensão incluem a corrente esticada no bbox → personagem encolhe levemente no auge do arremesso (fit por bbox). Lê como antecipação/impacto, mas é variação de escala real.
4. **walk-south** frame 4: lanterna e gancho aparecem em mãos trocadas (fase espelhada do ciclo gerada pelo modelo); em 160px lê como swing de braços.
5. **idle** é bob sintético (sem arte de respiração por direção); east/north idle são o mesmo bob sobre a base estática.
6. **run** não existe — engine cai no walk (padrão dos outros campeões sem run).
