import type { AppIntent, AppSnapshot } from "./state.ts";
import { CITADEL_BREACH_MARKETING, type MarketingVisual } from "../../game-assets/marketing.ts";
import { createLabClient, type LabModelProfile } from "../lab/client.ts";
import {
  LAB_BOMB_MODEL,
  LAB_MAX_COMPETITORS,
  LAB_MIN_COMPETITORS,
  LAB_PINGO_MODEL,
  LAB_V1_MODEL,
  LAB_V2_MODEL,
  LAB_V3_MODEL,
} from "../lab/competitors.ts";

type Dispatch = (intent: AppIntent) => void;
type CharacterSnapshot = AppSnapshot["characters"][number];

function element<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tagName: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tagName);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(
  document: Document,
  label: string,
  className: string,
  intent: AppIntent,
  dispatch: Dispatch,
): HTMLButtonElement {
  const node = element(document, "button", className, label);
  node.type = "button";
  node.addEventListener("click", () => dispatch(intent));
  return node;
}

function addArrow(document: Document, target: HTMLButtonElement): void {
  const arrow = element(document, "span", "action__arrow", "→");
  arrow.setAttribute("aria-hidden", "true");
  target.append(arrow);
}

function createCharacterImage(
  document: Document,
  character: CharacterSnapshot | null,
  options: Readonly<{
    decorative?: boolean;
    width?: number;
    height?: number;
    className?: string;
    draggable?: boolean;
  }> = {},
): HTMLImageElement {
  const image = document.createElement("img");
  image.src = character?.assetPath ?? "";
  image.alt = options.decorative ? "" : (character?.name ?? "");
  image.width = options.width ?? 160;
  image.height = options.height ?? options.width ?? 160;
  if (options.className) image.className = options.className;
  if (options.draggable !== undefined) image.draggable = options.draggable;
  return image;
}

function renderFighterStage(
  document: Document,
  character: CharacterSnapshot,
  options: Readonly<{
    compact?: boolean;
    decorative?: boolean;
    mirrored?: boolean;
    delay?: number;
  }> = {},
): HTMLElement {
  const stage = element(
    document,
    "span",
    "fighter-stage fighter-stage--" + character.accent + (options.compact ? " fighter-stage--compact" : ""),
  );
  stage.style.setProperty("--float-delay", `${options.delay ?? 0}ms`);
  if (options.decorative) stage.setAttribute("aria-hidden", "true");

  const blueprint = element(document, "span", "fighter-stage__blueprint");
  blueprint.setAttribute("aria-hidden", "true");
  const image = createCharacterImage(document, character, {
    decorative: options.decorative ?? false,
    className: options.mirrored ? "is-mirrored" : "",
    draggable: false,
  });
  const baseline = element(document, "span", "fighter-stage__baseline");
  baseline.setAttribute("aria-hidden", "true");
  stage.append(blueprint, image, baseline);
  return stage;
}

function renderBrand(document: Document, snapshot: AppSnapshot, dispatch: Dispatch): HTMLElement {
  const header = element(document, "header", "brand");
  const productHeading = element(document, "h1", "sr-only", snapshot.brand);
  const home = button(
    document,
    "",
    "brand__home",
    { type: "back-to-launcher" },
    dispatch,
  );
  home.setAttribute(
    "aria-label",
    snapshot.locale === "pt-BR" ? "Ir para o início" : "Go to start",
  );
  const mark = element(document, "span", "brand__mark", "B");
  mark.setAttribute("aria-hidden", "true");
  const copy = element(document, "span", "brand__copy");
  copy.append(
    element(document, "span", "brand__eyebrow", "BROWSER BATTLE ARENA"),
    element(document, "span", "brand__name", snapshot.brand),
  );
  home.append(mark, copy);

  const languages = element(document, "div", "brand__languages");
  languages.setAttribute("role", "group");
  languages.setAttribute("aria-label", snapshot.locale === "pt-BR" ? "Idioma" : "Language");
  ([
    { locale: "pt-BR", shortLabel: "PT", label: "Português", href: "https://bombapvp.com" },
    { locale: "en", shortLabel: "EN", label: "English", href: "https://bombpvp.com" },
  ] as const).forEach((language) => {
    if (language.locale === snapshot.locale) {
      const active = element(document, "span", "brand__language is-active", language.shortLabel);
      active.setAttribute("aria-current", "page");
      active.setAttribute("aria-label", language.label);
      languages.append(active);
      return;
    }
    const link = element(document, "a", "brand__language", language.shortLabel);
    link.href = language.href;
    link.hreflang = language.locale;
    link.setAttribute("aria-label", language.label);
    languages.append(link);
  });

  header.append(productHeading, home, languages);
  return header;
}

function renderRosterPanel(document: Document, snapshot: AppSnapshot): HTMLElement {
  const panel = element(document, "aside", "roster-panel");
  panel.setAttribute("aria-label", snapshot.copy.charactersLabel);
  const fighters = element(document, "div", "roster-panel__fighters");

  snapshot.characters.forEach((character, index) => {
    const fighter = element(document, "div", "roster-panel__fighter");
    fighter.append(
      renderFighterStage(document, character, {
        compact: true,
        decorative: true,
        delay: index * 450,
      }),
      element(document, "span", "roster-panel__name", character.name),
    );
    fighters.append(fighter);
  });

  const footer = element(document, "div", "roster-panel__footer");
  const dots = element(document, "span", "roster-panel__dots");
  dots.setAttribute("aria-hidden", "true");
  snapshot.characters.forEach((character) => {
    dots.append(element(document, "i", "roster-panel__dot roster-panel__dot--" + character.accent));
  });
  footer.append(element(document, "span", "roster-panel__label", snapshot.copy.charactersLabel), dots);
  panel.append(fighters, footer);
  return panel;
}

function createCitadelVisual(
  document: Document,
  visual: MarketingVisual,
  className: string,
): HTMLImageElement {
  const image = document.createElement("img");
  image.src = visual.url;
  image.alt = "";
  image.className = className;
  image.loading = "lazy";
  image.decoding = "async";
  image.draggable = false;
  image.dataset.assetId = visual.id;
  return image;
}

function renderCitadelFeature(document: Document, snapshot: AppSnapshot): HTMLElement {
  const isPortuguese = snapshot.locale === "pt-BR";
  const feature = element(document, "section", "citadel-feature");
  feature.setAttribute("aria-label", "Citadel Breach");

  const media = element(document, "div", "citadel-feature__media");
  media.setAttribute("aria-hidden", "true");
  // Launcher-only marketing bundle — never import full citadel catalog here.
  media.append(
    createCitadelVisual(document, CITADEL_BREACH_MARKETING.banner, "citadel-feature__banner"),
    createCitadelVisual(document, CITADEL_BREACH_MARKETING.keyArt, "citadel-feature__key-art"),
  );

  const copy = element(document, "div", "citadel-feature__copy");
  copy.append(
    element(document, "p", "citadel-feature__kicker", isPortuguese ? "PACOTE VISUAL INTEGRADO" : "INTEGRATED VISUAL PACK"),
    element(document, "h3", "citadel-feature__title", "Citadel Breach"),
    element(
      document,
      "p",
      "citadel-feature__description",
      isPortuguese
        ? "Nova linguagem visual para a Cidadela Arcana: piso, obstáculos, reator, alertas, HUD e efeitos agora fazem parte do build do jogo."
        : "A new visual language for the Arcane Citadel: floor, obstacles, reactor, alerts, HUD, and effects are now part of the game build.",
    ),
  );
  const tags = element(document, "p", "citadel-feature__tags");
  for (const label of isPortuguese
    ? ["ARENA", "COMBATE", "HUD", "EFEITOS"]
    : ["ARENA", "COMBAT", "HUD", "EFFECTS"]) {
    tags.append(element(document, "span", "citadel-feature__tag", label));
  }
  const link = element(
    document,
    "a",
    "action action--primary citadel-feature__action",
    isPortuguese ? "Entrar na Cidadela" : "Enter the Citadel",
  );
  link.href = "/arena/?mode=training&bot=v3&arenaTheme=arcane-citadel";
  const arrow = element(document, "span", "action__arrow", "→");
  arrow.setAttribute("aria-hidden", "true");
  link.append(arrow);
  copy.append(tags, link);

  feature.append(media, copy);
  return feature;
}

function renderLauncher(document: Document, snapshot: AppSnapshot, dispatch: Dispatch): HTMLElement {
  const region = element(document, "section", "experience-region");
  region.setAttribute("aria-label", snapshot.copy.experiencesLabel);

  const hero = element(document, "div", "launcher-hero");
  const intro = element(document, "header", "page-intro page-intro--launcher");
  intro.append(
    element(document, "p", "page-intro__kicker", snapshot.copy.launcherKicker),
    element(document, "h2", "page-intro__title", snapshot.copy.launcherTitle),
    element(document, "p", "page-intro__description", snapshot.copy.launcherIntroduction),
  );
  hero.append(intro, renderRosterPanel(document, snapshot));

  const grid = element(document, "div", "experience-grid");
  snapshot.experiences.forEach((experience, index) => {
    const article = element(
      document,
      "article",
      "experience-card experience-card--" + String(index + 1),
    );
    article.dataset.experience = experience.id;
    article.style.setProperty("--reveal-delay", `${340 + index * 90}ms`);
    const number = element(
      document,
      "span",
      "experience-card__number",
      String(index + 1).padStart(2, "0"),
    );
    number.setAttribute("aria-hidden", "true");
    const meta = element(document, "div", "experience-card__meta");
    meta.append(element(document, "p", "experience-card__journey", experience.journeyLabel), number);
    const copy = element(document, "div", "experience-card__copy");
    copy.append(
      element(document, "h3", "experience-card__name", experience.name),
      element(document, "p", "experience-card__description", experience.description),
    );
    const action = button(
      document,
      experience.actionLabel,
      "action action--card",
      { type: "open-experience", experienceId: experience.id },
      dispatch,
    );
    addArrow(document, action);
    article.append(meta, copy, action);
    grid.append(article);
  });
  region.append(hero, grid, renderCitadelFeature(document, snapshot));
  return region;
}

function renderCharacterSelection(
  document: Document,
  snapshot: AppSnapshot,
  dispatch: Dispatch,
): HTMLElement {
  const region = element(document, "section", "selection");
  region.setAttribute("aria-label", snapshot.copy.selectionTitle);

  const navigation = element(document, "div", "page-navigation");
  navigation.append(
    button(
      document,
      "← " + snapshot.copy.backLabel,
      "text-action",
      { type: "back-to-launcher" },
      dispatch,
    ),
    element(document, "p", "page-navigation__destination", snapshot.activeExperience?.name ?? ""),
  );

  const intro = element(document, "header", "page-intro");
  intro.append(
    element(document, "p", "page-intro__kicker", snapshot.copy.selectionKicker),
    element(document, "h2", "page-intro__title", snapshot.copy.selectionTitle),
    element(document, "p", "page-intro__description", snapshot.copy.selectionIntroduction),
  );

  const characterGrid = element(document, "div", "character-grid");
  characterGrid.setAttribute("role", "group");
  characterGrid.setAttribute("aria-label", snapshot.copy.charactersLabel);
  snapshot.characters.forEach((character) => {
    const selected = snapshot.selectedCharacter?.id === character.id;
    const card = button(
      document,
      "",
      "character-card character-card--" + character.accent + (selected ? " is-selected" : ""),
      { type: "select-character", characterId: character.id },
      dispatch,
    );
    card.setAttribute("aria-pressed", String(selected));
    card.setAttribute(
      "aria-label",
      character.name + ", " + (selected ? snapshot.copy.selectedLabel : snapshot.copy.chooseLabel),
    );

    const portrait = element(document, "span", "character-card__portrait");
    portrait.setAttribute("aria-hidden", "true");
    const image = createCharacterImage(document, character, { decorative: true });
    portrait.append(image);

    const copy = element(document, "span", "character-card__copy");
    copy.append(
      element(document, "span", "character-card__label", character.label),
      element(document, "strong", "character-card__name", character.name),
      element(document, "span", "character-card__description", character.description),
    );
    const state = element(
      document,
      "span",
      "character-card__state",
      selected ? snapshot.copy.selectedLabel : snapshot.copy.chooseLabel,
    );
    card.append(portrait, copy, state);
    characterGrid.append(card);
  });

  const confirmation = element(document, "div", "selection-confirmation");
  const selectionSummary = element(document, "div", "selection-confirmation__summary");
  if (snapshot.selectedCharacter) {
    const avatar = element(
      document,
      "span",
      "selection-confirmation__avatar selection-confirmation__avatar--" + snapshot.selectedCharacter.accent,
    );
    const image = createCharacterImage(document, snapshot.selectedCharacter, {
      decorative: true,
      width: 48,
    });
    avatar.append(image);
    selectionSummary.append(avatar);
  }
  const selectionCopy = element(document, "div", "selection-confirmation__copy");
  selectionCopy.append(
    element(
      document,
      "span",
      "selection-confirmation__label",
      snapshot.selectedCharacter ? snapshot.copy.selectedLabel : snapshot.copy.noSelectionLabel,
    ),
    element(
      document,
      "strong",
      "selection-confirmation__name",
      snapshot.selectedCharacter?.name ?? "—",
    ),
  );
  selectionSummary.append(selectionCopy);
  const confirm = button(
    document,
    snapshot.copy.continueLabel,
    "action action--primary action--confirm",
    { type: "confirm-character" },
    dispatch,
  );
  confirm.disabled = !snapshot.selectedCharacter;
  addArrow(document, confirm);
  if (
    snapshot.activeExperience?.id === "bot-training"
    || snapshot.activeExperience?.id === "continuous-room"
  ) {
    const opponentField = element(document, "label", "training-bot-field");
    const opponentLabel = element(
      document,
      "span",
      "training-bot-field__label",
      snapshot.locale === "pt-BR" ? "BOT ADVERSÁRIO" : "BOT OPPONENT",
    );
    const opponent = document.createElement("select");
    opponent.setAttribute(
      "aria-label",
      snapshot.locale === "pt-BR" ? "Bot adversário" : "Bot opponent",
    );
    snapshot.bots.forEach(({ id, label }) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = label;
      opponent.append(option);
    });
    opponent.value = snapshot.selectedBot;
    opponent.addEventListener("change", () => {
      const selectedBot = snapshot.bots.find(({ id }) => id === opponent.value);
      if (!selectedBot) return;
      dispatch({ type: "select-bot", botId: selectedBot.id });
    });
    opponentField.append(opponentLabel, opponent);
    confirmation.append(selectionSummary, opponentField, confirm);
  } else {
    confirmation.append(selectionSummary, confirm);
  }

  region.append(navigation, intro, characterGrid, confirmation);
  return region;
}

function renderGameLaunch(document: Document, snapshot: AppSnapshot, dispatch: Dispatch): HTMLElement {
  const region = element(document, "section", "ready-state");
  region.setAttribute("aria-label", snapshot.locale === "pt-BR" ? "Abrindo arena" : "Opening arena");
  const portrait = element(
    document,
    "div",
    "ready-state__portrait ready-state__portrait--" + (snapshot.selectedCharacter?.accent ?? "blue"),
  );
  const image = createCharacterImage(document, snapshot.selectedCharacter);
  portrait.append(image);

  const copy = element(document, "div", "ready-state__copy");
  copy.append(
    element(document, "p", "page-intro__kicker", snapshot.locale === "pt-BR" ? "GAMEPLAY ORIGINAL" : "ORIGINAL GAMEPLAY"),
    element(document, "h2", "page-intro__title", snapshot.locale === "pt-BR" ? "Abrindo arena" : "Opening arena"),
    element(document, "p", "ready-state__choice", (snapshot.selectedCharacter?.name ?? "") + " · " + (snapshot.activeExperience?.name ?? "")),
    element(document, "p", "page-intro__description", snapshot.locale === "pt-BR" ? "Carregando o motor original de Bomba PvP." : "Loading the original Bomba PvP engine."),
  );
  const actions = element(document, "div", "ready-state__actions");
  actions.append(
    button(
      document,
      snapshot.copy.reviseLabel,
      "action action--primary",
      { type: "back-to-selection" },
      dispatch,
    ),
    button(
      document,
      snapshot.copy.backToLauncherLabel,
      "action action--secondary",
      { type: "back-to-launcher" },
      dispatch,
    ),
  );
  copy.append(actions);
  region.append(portrait, copy);
  return region;
}

function renderLaboratory(document: Document, snapshot: AppSnapshot, dispatch: Dispatch): HTMLElement {
  const region = element(document, "section", "laboratory");
  region.setAttribute("aria-label", snapshot.copy.labTitle);

  const navigation = element(document, "div", "page-navigation");
  navigation.append(
    button(
      document,
      "← " + snapshot.copy.backLabel,
      "text-action",
      { type: "back-to-launcher" },
      dispatch,
    ),
  );
  const layout = element(document, "div", "laboratory__layout");
  const copy = element(document, "div", "laboratory__copy");
  copy.append(
    element(document, "p", "page-intro__kicker", snapshot.copy.labKicker),
    element(document, "h2", "page-intro__title", snapshot.copy.labTitle),
    element(document, "p", "page-intro__description", snapshot.copy.labIntroduction),
  );

  const isPortuguese = snapshot.locale === "pt-BR";
  const form = element(document, "form", "laboratory__form");
  const playerCount = document.createElement("select");
  for (let count = LAB_MIN_COMPETITORS; count <= LAB_MAX_COMPETITORS; count += 1) {
    const option = document.createElement("option");
    option.value = String(count);
    option.textContent = String(count);
    playerCount.append(option);
  }
  playerCount.setAttribute(
    "aria-label",
    isPortuguese ? "Quantidade de jogadores" : "Number of players",
  );
  const modelSelects = Array.from({ length: LAB_MAX_COMPETITORS }, (_, index) => {
    const select = document.createElement("select");
    select.disabled = true;
    select.setAttribute(
      "aria-label",
      isPortuguese ? `Modelo do jogador ${index + 1}` : `Player ${index + 1} model`,
    );
    return select;
  });
  const status = element(
    document,
    "p",
    "laboratory__status",
    isPortuguese ? "Consultando modelos disponíveis…" : "Checking available models…",
  );
  const start = element(
    document,
    "button",
    "action action--primary laboratory__start",
    isPortuguese ? "Iniciar Bot vs Bot" : "Start Bot vs Bot",
  );
  start.type = "submit";
  start.disabled = true;
  const field = (label: string, select: HTMLSelectElement): HTMLElement => {
    const wrapper = element(document, "label", "laboratory__field");
    wrapper.append(element(document, "span", "laboratory__label", label), select);
    return wrapper;
  };
  const modelFields = modelSelects.map((select, index) => (
    field(isPortuguese ? `Jogador ${index + 1}` : `Player ${index + 1}`, select)
  ));
  let optionsReady = false;
  const updateVisibleSlots = (): void => {
    const count = Number(playerCount.value);
    modelFields.forEach((modelField, index) => {
      const visible = index < count;
      modelField.hidden = !visible;
      modelSelects[index]!.disabled = !optionsReady || !visible;
    });
  };
  playerCount.addEventListener("change", updateVisibleSlots);
  updateVisibleSlots();

  form.append(
    field(isPortuguese ? "Jogadores na sala" : "Players in the room", playerCount),
    ...modelFields,
    status,
    element(
      document,
      "p",
      "laboratory__note",
      isPortuguese
        ? "Bomb, Pingo, V1, V2 e V3 rodam localmente; credenciais de LLM ficam somente no backend."
        : "Bomb, Pingo, V1, V2, and V3 run locally; LLM credentials stay on the backend.",
    ),
    start,
  );

  const populate = (profiles: LabModelProfile[]): void => {
    const llmProfiles = profiles.filter(({ route }) => (
      route !== LAB_BOMB_MODEL
      && route !== LAB_PINGO_MODEL
      && route !== LAB_V1_MODEL
      && route !== LAB_V2_MODEL
      && route !== LAB_V3_MODEL
    ));
    const competitors = [
      {
        id: LAB_BOMB_MODEL,
        label: isPortuguese ? "Bomb v2 · Pressão agressiva" : "Bomb v2 · Aggressive pressure",
        route: LAB_BOMB_MODEL,
      },
      {
        id: LAB_PINGO_MODEL,
        label: isPortuguese ? "Pingo v2 · Caça tática" : "Pingo v2 · Tactical hunter",
        route: LAB_PINGO_MODEL,
      },
      {
        id: LAB_V3_MODEL,
        label: isPortuguese ? "V3 · Bombardeiro de fase" : "V3 · Phase bomber",
        route: LAB_V3_MODEL,
      },
      {
        id: LAB_V2_MODEL,
        label: isPortuguese ? "V2 · Bot determinístico agressivo" : "V2 · Aggressive deterministic bot",
        route: LAB_V2_MODEL,
      },
      {
        id: LAB_V1_MODEL,
        label: isPortuguese ? "V1 · Bot determinístico" : "V1 · Deterministic bot",
        route: LAB_V1_MODEL,
      },
      ...llmProfiles,
    ];
    for (const [index, select] of modelSelects.entries()) {
      select.replaceChildren(...competitors.map((profile) => {
        const option = document.createElement("option");
        option.value = profile.route;
        option.textContent = profile.label;
        option.dataset.labLabel = profile.route === LAB_BOMB_MODEL
          ? "Bomb"
          : profile.route === LAB_PINGO_MODEL ? "Pingo" : profile.route === LAB_V1_MODEL ? "V1"
          : profile.route === LAB_V2_MODEL ? "V2" : profile.route === LAB_V3_MODEL ? "V3" : profile.label;
        return option;
      }));
      select.selectedIndex = Math.min(index, competitors.length - 1);
    }
    optionsReady = true;
    updateVisibleSlots();
    start.disabled = false;
    status.textContent = isPortuguese
      ? `Bomb, Pingo, V1, V2 e V3 locais + ${llmProfiles.length} perfis autorizados do 9Router.`
      : `Local Bomb, Pingo, V1, V2, and V3 + ${llmProfiles.length} approved 9Router profiles.`;
  };

  populate([]);
  status.textContent = isPortuguese
    ? "Bomb, Pingo, V1, V2 e V3 disponíveis. Consultando modelos do 9Router…"
    : "Bomb, Pingo, V1, V2, and V3 are available. Checking 9Router models…";

  void createLabClient().listProfiles().then((profiles) => {
    populate(profiles);
  }).catch(() => {
    status.textContent = isPortuguese
      ? "Bomb, Pingo, V1, V2 e V3 disponíveis. O laboratório não conseguiu alcançar o 9Router."
      : "Bomb, Pingo, V1, V2, and V3 are available. The lab could not reach 9Router.";
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const selected = modelSelects.slice(0, Number(playerCount.value));
    const models = selected.map((select) => select.value);
    const labels = selected.map((select) => select.selectedOptions[0]?.dataset.labLabel ?? select.value);
    if (models.some((model) => !model)) return;
    dispatch({ type: "start-lab-match", models, labels });
  });

  const arena = element(document, "div", "laboratory__arena");
  arena.setAttribute("aria-hidden", "true");
  const firstFighter = snapshot.characters[0];
  const secondFighter = snapshot.characters.at(-1);
  if (firstFighter && secondFighter) {
    arena.append(
      renderFighterStage(document, firstFighter, { decorative: true }),
      element(document, "span", "laboratory__versus", "VS"),
      renderFighterStage(document, secondFighter, {
        decorative: true,
        mirrored: true,
        delay: 700,
      }),
    );
  }

  layout.append(copy, form);
  region.append(navigation, layout, arena);
  return region;
}

function renderFooter(document: Document, snapshot: AppSnapshot): HTMLElement {
  const footer = element(document, "footer", "app-footer");
  footer.append(element(document, "p", "app-footer__product", snapshot.copy.footerLabel));
  return footer;
}

export function renderApp(root: HTMLElement, snapshot: AppSnapshot, dispatch: Dispatch): void {
  const document = root.ownerDocument;
  const previousScreen = (root.firstElementChild as HTMLElement | null)?.dataset.screen;
  const main = element(document, "main", "app-shell app-shell--" + snapshot.screen);
  if (previousScreen === snapshot.screen) main.classList.add("app-shell--screen-update");
  main.lang = snapshot.locale;
  main.dataset.screen = snapshot.screen;
  const backdrop = element(document, "div", "app-shell__backdrop");
  backdrop.setAttribute("aria-hidden", "true");
  const content = element(document, "div", "app-shell__content");

  if (snapshot.screen === "launcher") content.append(renderLauncher(document, snapshot, dispatch));
  if (snapshot.screen === "character-selection") {
    content.append(renderCharacterSelection(document, snapshot, dispatch));
  }
  if (snapshot.screen === "game-launch") content.append(renderGameLaunch(document, snapshot, dispatch));
  if (snapshot.screen === "laboratory") content.append(renderLaboratory(document, snapshot, dispatch));

  main.append(backdrop, renderBrand(document, snapshot, dispatch), content, renderFooter(document, snapshot));
  root.replaceChildren(main);
}
