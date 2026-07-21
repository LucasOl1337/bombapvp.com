# Madara

O Uchiha renascido, inspirado em Madara de Naruto — cabelo preto espetado, Sharingan vermelho, armadura carmesim/preto com o símbolo do leque Uchiha. Skill: Fireball Jutsu que queima caixas em linha reta e deixa chamas laterais no fim.

- Identidade e cooldown: `definition.ts`
- Fireball Jutsu (canalização, quebra de caixas, chamas laterais): `skill.ts`
- Bola de fogo viajando e flash de detonação: `visuals.ts`
- Retrato e sprites densos 160×160: `assets/`
- Fontes hi-res / keyframes / pipeline: `rebuild/` (local, fora do runtime)

## Skill — Fireball Jutsu

**Canalização (220 ms):** Madara faz selos de mão e cuspirá uma bola de fogo na direção cardinal desejada.

**Resolução:** a bola de fogo viaja em linha reta por até **4 tiles**:
- Quebra até **3 caixas** (`breakable`) no caminho, revelando itens normalmente.
- Para ao atingir um jogador (morte instantânea), uma parede sólida, uma bomba ou o limite de caixas.
- No tile final (detonação) espalha **chamas laterais** (tile final + tiles imediatamente à esquerda e à direita relativos à direção do disparo) por **2,5 s**.

**Fizzle:** se o tile imediatamente à frente for parede sólida, bomba ou fora da arena, a skill falha com cooldown reduzido (1,5 s).

## Asymmetry markers (identity lock)

| Detail | Character side | Front (viewer) | Right profile | Back (viewer) |
| --- | --- | --- | --- | --- |
| Uchiha fan crest | back | hidden | hidden | center of coat |
| Hair part/spikes | symmetrical | symmetrical | swept back/right | full volume |

## Animation density (shipped)

| Slot | Frames / dir | Notes |
| --- | --- | --- |
| idle | 8 | bob sintético sobre base identity-locked (south/east/north reais) |
| walk | 8 | keyframes reais por direção; ciclo de 8 fases |
| cast | 6 | sequência de selos/inspiração/exalação de fogo |
| attack | 4 | gesto de plantar, mão vazia — sem bomba no PNG |
| death | 4 | colapso one-shot, hold no último frame |

Final cell size: **160×160** RGBA. Bundle: 120 frames de animação + 4 estáticos + retrato 256². **West = espelho horizontal do east** em todos os slots (permitido por `docs/sprites.md`).

## Pipeline (rebuild/)

Motor de imagem: **GPT (codex CLI `image_gen.imagegen`)** — mesma técnica de keyframes identity-locked usada na Katarina:

1. Bases 1254² via imagegen com style lock (`prompt-bases.txt`); east/north/cast derivados por edição da base south.
2. Keyframes por ação/direção via edição encadeada (`prompt-keyframes-*.txt`).
3. `pipeline.py install`: key preto estrito (thr 18) → bbox → fit foot-anchored 160×160 → west espelhado → estáticos + retrato. Idle = bob sintético sobre as bases.
4. QA: GIFs por ação/direção em `rebuild/sheets/final/`.

## Honest defects / next polish

1. **West espelhado** em tudo — o brasão Uchiha aparece invertido no west.
2. **cast** inclui chamas/ember no PNG em alguns frames → podem ser cortadas ou escaladas pelo fit de bbox.
3. **idle** é bob sintético (sem arte de respiração autoral por direção).
4. **run** não existe — engine cai no walk.
5. **Chamas da ultimate** são tiles do engine (`addFlame`), não sprites de fogo desenhados no personagem.
