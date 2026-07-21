# Katarina

A Lâmina Sinistra, inspirada na Katarina de League of Legends — cabelo carmesim longo, cicatriz no olho esquerdo, couro preto/vermelho e duas adagas. Skill de dois estágios: arremesso de adaga + blink.

- Identidade e cooldown: `definition.ts`
- Bouncing Blade → Shunpo (throw + blink + slash): `skill.ts`
- Adaga cravada no mundo e FX do slash: `visuals.ts`
- Retrato e sprites densos 160×160: `assets/`
- Fontes hi-res / keyframes / pipeline: `rebuild/` (local, fora do runtime)

## Skill — Bouncing Blade

**Estágio 1 (arremesso, 180 ms):** a adaga voa em linha cardinal (até 4 tiles) e crava no último tile livre antes de parede/caixa/bomba. Jogadores não bloqueiam a adaga — ela crava sob eles. Fica armada por **5 s** (anel carmesim drena o tempo no chão; HUD mostra "ADAGA x.xs"). Durante a janela armada Katarina se move e planta bombas normalmente.

**Estágio 2 (reconjurar = Shunpo):** blink instantâneo para o tile da adaga (ou o tile livre adjacente mais próximo, se ocupado) + **slash letal** em todos os inimigos num raio Chebyshev 1 da adaga. Cooldown cheio (8 s).

**Expiração:** se a adaga expirar sem reconjurar, cooldown reduzido (4 s). Se a linha estiver totalmente bloqueada no arremesso, fizzle com cooldown de 1,5 s.

## Asymmetry markers (identity lock)

| Detail | Character side | Front (viewer) | Right profile | Back (viewer) |
| --- | --- | --- | --- | --- |
| Face scar | LEFT eye | RIGHT | hidden | hidden |
| Hair flow | back/right | LEFT-heavy | trailing back | full cover |

## Animation density (shipped)

| Slot | Frames / dir | Notes |
| --- | --- | --- |
| idle | 8 | bob sintético sobre base identity-locked (south/east/north reais) |
| walk | 8 | keyframes reais por direção; ciclo de 8 fases |
| cast | 6 | arremesso da adaga real por direção (wind-up → release → extensão → recover) |
| attack | 4 | gesto de plantar, mão vazia — sem bomba no PNG |
| death | 4 | colapso one-shot, hold no último frame |

Final cell size: **160×160** RGBA. Bundle: 120 frames de animação + 4 estáticos + retrato 256². **West = espelho horizontal do east** em todos os slots (permitido por `docs/sprites.md`).

## Pipeline (rebuild/)

Motor de imagem: **GPT (codex CLI `image_gen.imagegen`)** — primeira personagem do roster gerada com GPT em vez de Grok. Mesma técnica de keyframes identity-locked do Thresh:

1. Bases 1254² via imagegen com style lock (`prompt-bases.txt`); east/north/cast derivados por edição da base south.
2. Keyframes por ação/direção via edição encadeada (`prompt-keyframes-*.txt`).
3. `pipeline.py install`: key preto estrito (thr 18) → bbox → fit foot-anchored 160×160 → west espelhado → estáticos + retrato. Idle = bob sintético sobre as bases.
4. QA: GIFs por ação/direção em `rebuild/sheets/final/`.

## Honest defects / next polish

1. **West espelhado** em tudo — a cicatriz do olho esquerdo aparece no olho direito no west (assimetria invertida).
2. **cast-east/north**: frames de extensão incluem a adaga voadora no bbox → leve variação de escala no auge do arremesso (fit por bbox).
3. **idle** é bob sintético (sem arte de respiração autoral por direção).
4. **run** não existe — engine cai no walk (padrão dos outros campeões sem run).
5. **Slash sem hit visual separado por vítima** — o FX do Shunpo é um anel único no tile da adaga.
