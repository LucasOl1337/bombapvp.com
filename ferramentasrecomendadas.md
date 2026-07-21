# Ferramentas recomendadas (gap vs. uso atual)

Lista de ferramentas e recursos **úteis ao Bomba PvP** que o projeto **ainda não usa** (ou usa só de forma residual). Escrita para orientar prioridade sem obrigar adoção.

**Princípio:** custom = regra de jogo + feeling de champion.
**Reuso** = conteúdo genérico, pipeline, apresentação, online de transporte, QA e ops.

**Não é objetivo desta lista** substituir o kernel determinístico (`GameMechanics`) por Phaser/Unity/Godot.

## Baseline do que já existe

| Já tem | Gap principal |
| --- | --- |
| Vite + TypeScript + Vitest | Lib de render, áudio de jogo, netcode, packs de asset |
| Kernel determinístico custom | CI formal (ex.: GitHub Actions) |
| Canvas 2D no adaptador browser | Sprite atlas / audio sprite |
| Áudio custom no adapter | Packs SFX/UI de mercado + Howler |
| Champions com pipeline de PNG massivo | Telemetria, crash reporting |
| ADRs de online (servidor autoritativo, DO) | Matchmaking/server real no código |
| Deploy mental em Cloudflare | PartyKit / tooling de room |

---

## Tier S — extremo ROI

### 1. Assets prontos (conteúdo genérico)

| Fonte | Uso no Bomba |
| --- | --- |
| [Kenney.nl](https://kenney.nl) | Tiles, UI, SFX, bombs/explosions genéricos (free, commercial OK) |
| [OpenGameArt](https://opengameart.org) | Packs top-down / bomb / explosion CC0 |
| [itch.io free assets](https://itch.io/game-assets/free) | UI, power-ups, HUD |
| [Game-icons.net](https://game-icons.net) | Ícones de power-up / HUD |
| [Freesound](https://freesound.org) / Sonniss GDC packs | Biblioteca SFX de combate/arena |
| [jsfxr](https://sfxr.me) / sfxr | SFX 8-bit de placeholder (planta, tick, boom) |

### 2. Pipeline de asset

| Ferramenta | Por quê |
| --- | --- |
| [Aseprite](https://www.aseprite.org) (ou LibreSprite) | Frame-a-frame, export de sheet, tags idle/walk |
| [TexturePacker](https://www.codeandweb.com/texturepacker) ou free-tex-packer | Atlas JSON + 1 PNG (em vez de dezenas de requests por champion) |
| [Sharp](https://sharp.pixelplumbing.com) | Trim alpha, resize, batch (contrato em `docs/sprites.md`) |
| [ImageMagick](https://imagemagick.org) | Keying de fundo / flood fill dos cantos em batch |
| [Piskel](https://www.piskelapp.com) | Placeholder pixel rápido |

Contrato de sprites: `docs/sprites.md` (trim, 4 direções, naming). Isso é script + atlas, não regeneração manual de PNG solto.

### 3. Áudio de jogo

| Ferramenta | Por quê |
| --- | --- |
| [Howler.js](https://howlerjs.com) | Pool, mute, volume, audio sprites, overlap — padrão browser game |
| audiosprite (npm) | 1 arquivo com SFX curtos → menos I/O e glitch |
| jsfxr / ChipTone / Bfxr | Placeholder até pack final |

Encaixe: só no adaptador de áudio (`GameMechanics/src/browser/`), nunca no kernel.

### 4. Online (alinhado aos ADRs)

Decisões: `docs/adr/0001-servidor-autoritativo-por-partida.md`, `docs/adr/0002-primeiro-pvp-online-e-duelo-1v1.md`.

| Ferramenta | Encaixe |
| --- | --- |
| Cloudflare Durable Objects + WebSockets | Caminho canônico no ADR 0001 |
| [PartyKit](https://docs.partykit.io) | DX de room/WebSocket no edge Cloudflare |
| Wrangler | Workers / DO / Pages unificados |
| msgpackr ou protobuf-es | Comandos/snapshots compactos (melhor que JSON gordo no tick) |
| [bitECS](https://github.com/NateTheGreatt/bitECS) | Só se o estado crescer; **não** obrigatório no 1v1 atual |

**Evitar por enquanto:** Colyseus full stack (outro modelo de server), PeerJS host-authoritative (conflita com ADR).

### 5. QA visual e regressão

| Ferramenta | Por quê |
| --- | --- |
| Playwright | Smoke: carrega arena, planta bomba, screenshot |
| [pixelmatch](https://github.com/mapbox/pixelmatch) / odiff | Diff de frames da arena |
| GitHub Actions | `npm run check` + screenshots em todo push |

---

## Tier A — alto valor, próximo ciclo

### Render / feel (sem trocar o kernel)

| Ferramenta | Uso |
| --- | --- |
| [PixiJS](https://pixijs.com) | WebGL, batch de sprites, particles — **só no browser adapter** |
| [GSAP](https://gsap.com) (ou CSS) | HUD, banners sudden death, pop de power-up |
| Canvas-confetti / particle libs leves | Explosão / UI juice |
| [screenfull](https://github.com/sindresorhus/screenfull) | Fullscreen one-tap |

### Input / mobile

| Ferramenta | Uso |
| --- | --- |
| [nipplejs](https://yoannmoi.net/nipplejs/) | Joystick virtual touch |
| [hotkeys-js](https://github.com/jaywcjlove/hotkeys-js) | Atalhos sem spaghetti de `keydown` |
| Gamepad API (nativo) + helper mínimo | Controle no sofá |

### Observabilidade e produto

| Ferramenta | Uso |
| --- | --- |
| [PostHog](https://posthog.com) ou Plausible | Funil play → round → win |
| Sentry (browser) | Crash no adapter/canvas |
| Cloudflare Web Analytics | Deploy já no ecossistema CF |
| OpenTelemetry (depois, Worker/DO) | Latência de tick / matchmaking |

### Dev experience / qualidade de código

| Ferramenta | Uso |
| --- | --- |
| ESLint + typescript-eslint | Lint formal |
| Prettier + husky / lint-staged | Diff limpo entre agentes |
| [fast-check](https://github.com/dubzzz/fast-check) | Property tests no kernel (determinismo, restore, commands) |
| [ts-pattern](https://github.com/gvergnaud/ts-pattern) | Match de `GameEvent` / commands |
| [zod](https://zod.dev) ou valibot | Validar `restore(raw)` e config na fronteira |
| [Biome](https://biomejs.dev) | Lint + format em uma tool |

### Build / perf de assets no Vite

| Ferramenta | Uso |
| --- | --- |
| vite-plugin-image-optimizer / Sharp no build | PNG de champion sem matar bundle |
| Script pré-build de spritesheet | 1 atlas por champion |

---

## Tier B — conteúdo, marca, crescimento

| Ferramenta | Uso |
| --- | --- |
| Figma / Penpot | HUD, launcher, painéis |
| Open Design (ambiente local do dono) | Prototipar launcher/menus sem poluir o kernel |
| Lottie (só UI, não arena) | Animações de menu / win screen |
| ffmpeg (local) | Extrair frames de vídeo de champion → pipeline |
| Rive | UI interativa (só se menu for prioridade visual) |

---

## Tier C — bots e balance

| Ferramenta | Uso |
| --- | --- |
| Replay recorder (seed + commands) | Formato próprio em cima do kernel determinístico |
| fast-check em cenários de skill | Escala melhor que só casos manuais |
| ngraph.path / A* mínimo | Se bots forem além de policy reativa |

**Não** priorizar TensorFlow no browser agora (overkill vs. perfis Bomb/Pingo/v1–v3).

---

## Explicitamente não priorizar

| Evitar | Motivo |
| --- | --- |
| Phaser / Unity / Godot como engine principal | Quebra o modelo kernel-determinístico + deploy estático atual |
| React/Vue na arena (canvas loop) | VDOM não ajuda o hot path; shell de UI talvez, arena não |
| Colyseus “full game” | Duplica o que kernel + Durable Object devem ser |
| Three.js | Jogo é 2D top-down tile |
| Gerar mais champions com IA antes de atlas + SFX + online | Multiplica dívida de conteúdo |

---

## Mapa gap × ferramenta

```text
CONTEÚDO     → Kenney / itch / Freesound / jsfxr
PIPELINE     → Aseprite + TexturePacker/free-tex-packer + Sharp
ÁUDIO        → Howler + audiosprite
APRESENTAÇÃO → Pixi (opcional) / GSAP / particles leves
INPUT        → nipplejs + gamepad
ONLINE       → CF Durable Objects (+ PartyKit DX) + msgpack
QA           → Playwright + pixelmatch + GitHub Actions
CONTRATO     → zod/valibot + fast-check
OPS          → Sentry + PostHog/Plausible
NÃO TOCAR    → GameMechanics kernel (só adaptadores consomem libs)
```

---

## Top 10 de adoção sugerida

1. Pack SFX + Howler — feeling imediato
2. Atlas de sprites (TexturePacker ou script Sharp) — performance e sanidade
3. Kenney/itch para arena/UI placeholders unificados
4. GitHub Actions = `npm run check`
5. Playwright smoke da arena
6. zod/valibot no `restore` / match config
7. Durable Object + WebSocket (PartyKit se quiserem DX)
8. msgpack nos frames de rede
9. Joystick mobile (nipplejs)
10. Sentry + analytics leve

---

## Veredito

O buraco não é “falta de engine de jogo”. É **industrializar asset/áudio**, **fechar o adaptador online que o ADR já descreve**, e **colar CI + regressão visual** em cima do kernel que já é o ativo certo.

Atualize esta lista quando uma ferramenta for adotada (mova para “em uso”) ou rejeitada com motivo.
