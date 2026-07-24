# Changelog — bombpvp

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [2026-07-24] — safe commit (merge upstream + site)

### Added
- **Zed — Living Shadow** (via upstream #24/#25/#26): champion jogável em
  `Champions/zed/`, selecionável por character select ou `?p1=zed` / `?p2=zed`.
  Primeiro `R` posiciona projeção fixa no tile cardinal livre mais distante (alcance 3);
  segundo `R` troca o corpo pela projeção. Cooldown de 7000 ms na troca válida e 4000 ms
  na falha. Plantio de bomba durante a canalização gera plantio-eco no tile da sombra sem
  consumir slot extra de `maxBombs`.
- **Bot mastery determinístico** (#23) com perfis documentados em
  `GameMechanics/training/bot-mastery-v1/` (crocodilo-arcano, killer-bee, ranni, thresh).
- **Laboratório de IA bot-vs-bot** (#21) restaurado na landing, com controle de
  velocidade de playback e gravação de experiência estruturada em memória.
- **Ranni — Ice Blink com wall-phasing** (#22): projeção espectral atravessa terreno,
  corpo físico sustenta o frame de prisão de gelo, janela de 2,5 s a meia velocidade.
- **`Site/`**: site institucional novo (Vite + TypeScript) com páginas de champions e
  guia, preview de arena e assets próprios.
- Suítes de teste novas: `zed-living-shadow-presentation`, `zed-sprite-assets`,
  `bot-mastery`, `browser-bot-drivers`, `browser-match-mode`.
- `docs/sprite-generation.md` documentando o pipeline de geração de sprites.

### Changed
- Apresentação dual-body generalizada: `RANNI_ICE_BLINK_SKILL_ID` → conjunto
  `DUAL_BODY_PROJECTION_SKILL_IDS`, agora cobrindo Ranni e Zed pelo mesmo caminho.
- `docs/gameplay.md` reescrito com os três modos da landing (duelo local, treino vs bot,
  laboratório de IA) e o contrato de URL (`p1`, `p2`, `bot1`, `bot2`, `skipSelect`, `dev`).
- `GameMechanics/src/modules/skills/index.ts` ampliado (+177 linhas) para acomodar a
  mecânica de sombra viva.

### Removed
- Abordagem local `holdFrameIndex` para pose congelada da ultimate da Ranni — substituída
  pelo modelo de `buildMs` do upstream, que é validado por teste explícito.

### Fixed
- Divergência de 6 commits entre o clone local e `origin/main`, com 8 arquivos em
  conflito reconciliados.

### Known issues
- Rótulo `aria-label` do roster ficou fixo em inglês (`"P1 roster"`), perdendo a
  localização PT-BR que existia na linha local. Candidato a issue.
