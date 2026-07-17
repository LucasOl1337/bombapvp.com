import type { AppIntent, AppSnapshot } from "./state.ts";
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
import { mountArenaField } from "./arena-field.ts";

type Dispatch = (intent: AppIntent) => void;
type CharacterSnapshot = AppSnapshot["characters"][number];

type LandingCopy = Readonly<{
  navArena: string;
  navFighters: string;
  navLab: string;
  heroTitle: string;
  heroBody: string;
  heroPrimary: string;
  heroSecondary: string;
  modesTitle: string;
  mechanicsTitle: string;
  mechanics: readonly Readonly<{ number: string; title: string; body: string }>[];
  upgradesLabel: string;
  upgrades: readonly string[];
  fightersTitle: string;
  fighterSkills: readonly Readonly<{ skill: string; body: string }>[];
  labTitle: string;
  labBody: string;
  labSupport: string;
  labViews: readonly Readonly<{ name: string; body: string }>[];
  telemetry: readonly string[];
  labAction: string;
  closingTitle: string;
  closingBody: string;
  closingPrimary: string;
  closingSecondary: string;
  scrollLabel: string;
}>;

function landingCopy(locale: AppSnapshot["locale"]): LandingCopy {
  if (locale === "en") {
    return {
      navArena: "Arena",
      navFighters: "Fighters",
      navLab: "Lab",
      heroTitle: "Every bomb redraws the arena.",
      heroBody: "A game of confrontation, routes, and timing. Break cover. Open a path. Survive the closing walls.",
      heroPrimary: "Enter the arena",
      heroSecondary: "See how it works",
      modesTitle: "Three doors. One arena.",
      mechanicsTitle: "The arena changes before you do.",
      mechanics: [
        { number: "01", title: "Detonate", body: "Plant bombs and control the timing of the blast." },
        { number: "02", title: "Break through", body: "Destroy crates, reveal upgrades, and open new routes." },
        { number: "03", title: "Survive", body: "When sudden death closes the map, space becomes advantage." },
      ],
      upgradesLabel: "Tactical upgrades",
      upgrades: ["More bombs", "Flame", "Speed", "Shield", "Remote", "Kick", "Short fuse", "Bomb pass"],
      fightersTitle: "Four bodies. Four ways to break the map.",
      fighterSkills: [
        { skill: "Ice blink", body: "Project a route and reappear at its endpoint." },
        { skill: "Wing dash", body: "Cross up to three tiles in one advance." },
        { skill: "Emerald surge", body: "Break crates and ignite all four axes." },
        { skill: "Arcane beam", body: "Charge and fire in a straight line across the arena." },
      ],
      labTitle: "The fight can also be observed.",
      labBody: "In the lab, two to four competitors enter the same authoritative GameApp. Mix Bomb, Pingo, V1, V2, V3, and approved 9Router models.",
      labSupport: "Model credentials stay in the backend. Bomb, Pingo, V1, V2, and V3 run locally.",
      labViews: [
        { name: "Arena", body: "A full view of the live field." },
        { name: "Split", body: "Two cameras side by side." },
        { name: "Data", body: "Decision and system telemetry." },
      ],
      telemetry: ["Last action", "LLM/s", "Motor/s", "Safe", "Latency", "Tokens", "Kills", "Wins", "Deaths"],
      labAction: "Configure a duel",
      closingTitle: "The arena is already moving.",
      closingBody: "Choose your entry. The map handles the rest.",
      closingPrimary: "Play now",
      closingSecondary: "Train against bots",
      scrollLabel: "Scroll",
    };
  }

  return {
    navArena: "Arena",
    navFighters: "Combatentes",
    navLab: "Lab",
    heroTitle: "Cada bomba redesenha a arena.",
    heroBody: "Um jogo de confronto, rota e tempo. Destrua a cobertura. Abra caminho. Sobreviva ao fechamento.",
    heroPrimary: "Entrar na arena",
    heroSecondary: "Ver como funciona",
    modesTitle: "Três portas. A mesma arena.",
    mechanicsTitle: "A arena muda antes de você.",
    mechanics: [
      { number: "01", title: "Detone", body: "Plante bombas e controle o tempo da explosão." },
      { number: "02", title: "Rompa", body: "Quebre caixas, revele upgrades e abra novas rotas." },
      { number: "03", title: "Sobreviva", body: "Quando a morte súbita fecha o mapa, espaço vira vantagem." },
    ],
    upgradesLabel: "Upgrades táticos",
    upgrades: ["Mais bombas", "Chama", "Velocidade", "Escudo", "Controle remoto", "Chute", "Pavio curto", "Passa-bomba"],
    fightersTitle: "Quatro corpos. Quatro formas de quebrar o mapa.",
    fighterSkills: [
      { skill: "Salto glacial", body: "Projeta a rota e reaparece no ponto final." },
      { skill: "Investida alada", body: "Cruza até três tiles em um avanço." },
      { skill: "Surto esmeralda", body: "Rompe caixas e incendeia os quatro eixos." },
      { skill: "Feixe arcano", body: "Carrega e dispara em linha através da arena." },
    ],
    labTitle: "A luta também pode ser observada.",
    labBody: "No laboratório, de dois a quatro competidores entram na mesma GameApp autoritativa. Misture Bomb, Pingo, V1, V2, V3 e modelos autorizados do 9Router.",
    labSupport: "Credenciais de modelos ficam no backend. Bomb, Pingo, V1, V2 e V3 rodam localmente.",
    labViews: [
      { name: "Arena", body: "Visão geral do campo e da ação ao vivo." },
      { name: "Dividido", body: "Duas câmeras lado a lado." },
      { name: "Dados", body: "Telemetria de decisões e sistema." },
    ],
    telemetry: ["Última ação", "LLM/s", "Motor/s", "Safe", "Latência", "Tokens", "Abates", "Vitórias", "Mortes"],
    labAction: "Configurar um duelo",
    closingTitle: "A arena já está em movimento.",
    closingBody: "Escolha sua entrada. O mapa cuida do resto.",
    closingPrimary: "Jogar agora",
    closingSecondary: "Treinar contra bots",
    scrollLabel: "Role",
  };
}

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

  const navigation = element(document, "nav", "brand__navigation");
  navigation.setAttribute("aria-label", snapshot.locale === "pt-BR" ? "Navegação principal" : "Primary navigation");
  const pageCopy = landingCopy(snapshot.locale);
  ([
    { label: pageCopy.navArena, href: "#arena" },
    { label: pageCopy.navFighters, href: "#combatentes" },
    { label: pageCopy.navLab, href: "#laboratorio" },
  ] as const).forEach(({ label, href }) => {
    const link = element(document, "a", "brand__navigation-link", label);
    link.href = href;
    navigation.append(link);
  });

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

  header.append(productHeading, home);
  if (snapshot.screen === "launcher") header.append(navigation);
  header.append(languages);
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

function renderLauncher(document: Document, snapshot: AppSnapshot, dispatch: Dispatch): HTMLElement {
  const copy = landingCopy(snapshot.locale);
  const region = element(document, "section", "landing");
  region.setAttribute("aria-label", snapshot.copy.experiencesLabel);
  region.append(element(document, "h2", "sr-only", snapshot.copy.launcherTitle));

  const hero = element(document, "section", "landing-hero");
  hero.id = "arena";
  hero.setAttribute("aria-labelledby", "landing-hero-title");
  const heroMedia = element(document, "div", "landing-hero__media");
  const heroImage = document.createElement("img");
  heroImage.src = "/Assets/marketing/hero-match-control-v2.webp";
  heroImage.alt = "";
  heroImage.width = 1920;
  heroImage.height = 1080;
  heroImage.decoding = "async";
  heroImage.fetchPriority = "high";
  heroImage.draggable = false;
  const field = document.createElement("canvas");
  field.className = "landing-hero__field";
  field.setAttribute("aria-hidden", "true");
  heroMedia.append(heroImage, field);

  const heroCopy = element(document, "div", "landing-hero__copy");
  const dossier = element(document, "span", "landing-hero__dossier", "B–01 / " + (snapshot.locale === "pt-BR" ? "MAPA INSTÁVEL" : "UNSTABLE MAP"));
  dossier.setAttribute("aria-hidden", "true");
  const heroTitle = element(document, "h2", "landing-display landing-hero__title", copy.heroTitle);
  heroTitle.id = "landing-hero-title";
  const heroBody = element(document, "p", "landing-hero__body", copy.heroBody);
  const heroActions = element(document, "div", "landing-actions landing-hero__actions");
  const heroPrimary = button(
    document,
    copy.heroPrimary,
    "landing-button landing-button--primary",
    { type: "open-experience", experienceId: "continuous-room" },
    dispatch,
  );
  addArrow(document, heroPrimary);
  const heroSecondary = element(document, "a", "landing-text-link", copy.heroSecondary);
  heroSecondary.href = "#como-funciona";
  heroSecondary.append(element(document, "span", "landing-text-link__arrow", "↓"));
  heroCopy.append(dossier, heroTitle, heroBody, heroActions);
  heroActions.append(heroPrimary, heroSecondary);

  const scroll = element(document, "a", "landing-hero__scroll", copy.scrollLabel);
  scroll.href = "#experiencias";
  scroll.setAttribute("aria-label", snapshot.locale === "pt-BR" ? "Rolar para as experiências" : "Scroll to experiences");
  hero.append(heroMedia, heroCopy, scroll);
  hero.addEventListener("pointermove", (event) => {
    if (!(event instanceof PointerEvent)) return;
    const bounds = hero.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    hero.style.setProperty("--pointer-x", String((event.clientX - bounds.left) / bounds.width));
    hero.style.setProperty("--pointer-y", String((event.clientY - bounds.top) / bounds.height));
  }, { passive: true });
  mountArenaField(field);

  const modes = element(document, "section", "landing-modes landing-section");
  modes.id = "experiencias";
  modes.setAttribute("aria-labelledby", "landing-modes-title");
  const modesHeading = element(document, "h2", "landing-display landing-section__title landing-modes__title", copy.modesTitle);
  modesHeading.id = "landing-modes-title";
  const modeList = element(document, "div", "landing-modes__list");
  snapshot.experiences.forEach((experience, index) => {
    const article = element(document, "article", "landing-mode landing-mode--" + String(index + 1));
    article.dataset.experience = experience.id;
    const number = element(document, "span", "landing-mode__number", String(index + 1).padStart(2, "0"));
    number.setAttribute("aria-hidden", "true");
    const content = element(document, "div", "landing-mode__content");
    content.append(
      element(document, "p", "landing-mode__journey", experience.journeyLabel),
      element(document, "h3", "landing-mode__name", experience.name),
      element(document, "p", "landing-mode__description", experience.description),
    );
    const action = button(
      document,
      experience.actionLabel,
      "landing-mode__action",
      { type: "open-experience", experienceId: experience.id },
      dispatch,
    );
    addArrow(document, action);
    article.append(number, content, action);
    modeList.append(article);
  });
  modes.append(modesHeading, modeList);

  const mechanics = element(document, "section", "landing-mechanics landing-section");
  mechanics.id = "como-funciona";
  mechanics.setAttribute("aria-labelledby", "landing-mechanics-title");
  const mechanicsHeading = element(document, "h2", "landing-display landing-section__title", copy.mechanicsTitle);
  mechanicsHeading.id = "landing-mechanics-title";
  const route = element(document, "div", "landing-mechanics__route");
  copy.mechanics.forEach((item) => {
    const step = element(document, "article", "landing-mechanic");
    const visual = element(document, "div", "landing-mechanic__visual");
    visual.setAttribute("aria-hidden", "true");
    const text = element(document, "div", "landing-mechanic__copy");
    text.append(
      element(document, "span", "landing-mechanic__number", item.number),
      element(document, "h3", "landing-mechanic__title", item.title),
      element(document, "p", "landing-mechanic__body", item.body),
    );
    step.append(visual, text);
    route.append(step);
  });

  const upgradeAssets = [
    "power-bomb.png",
    "power-flame.png",
    "power-speed.png",
    "power-shield.png",
    "power-remote.png",
    "power-kick.png",
    "power-short-fuse-v2.png",
    "power-bomb-pass.png",
  ] as const;
  const upgrades = element(document, "div", "landing-upgrades");
  upgrades.append(element(document, "p", "landing-upgrades__label", copy.upgradesLabel));
  const upgradeList = element(document, "ul", "landing-upgrades__list");
  copy.upgrades.forEach((upgrade, index) => {
    const item = element(document, "li", "landing-upgrade");
    const icon = document.createElement("img");
    icon.src = "/Assets/UiLayouts/" + upgradeAssets[index];
    icon.alt = "";
    icon.width = 42;
    icon.height = 42;
    icon.loading = "lazy";
    item.append(icon, element(document, "span", "landing-upgrade__name", upgrade));
    upgradeList.append(item);
  });
  upgrades.append(upgradeList);
  mechanics.append(mechanicsHeading, route, upgrades);

  const fighters = element(document, "aside", "landing-fighters landing-section");
  fighters.id = "combatentes";
  fighters.setAttribute("aria-label", snapshot.copy.charactersLabel);
  const fightersHeading = element(document, "h2", "landing-display landing-section__title landing-fighters__title", copy.fightersTitle);
  const fighterList = element(document, "div", "landing-fighters__list");
  snapshot.characters.forEach((character, index) => {
    const skill = copy.fighterSkills[index];
    if (!skill) return;
    const article = element(document, "article", "landing-fighter landing-fighter--" + character.accent);
    article.style.setProperty("--fighter-index", String(index));
    const image = createCharacterImage(document, character, {
      decorative: true,
      width: 240,
      height: 240,
      draggable: false,
    });
    image.loading = "lazy";
    const fighterCopy = element(document, "div", "landing-fighter__copy");
    fighterCopy.append(
      element(document, "span", "landing-fighter__number", String(index + 1).padStart(2, "0")),
      element(document, "h3", "landing-fighter__name", character.name),
      element(document, "p", "landing-fighter__skill", skill.skill),
      element(document, "p", "landing-fighter__body", skill.body),
    );
    article.append(image, fighterCopy);
    fighterList.append(article);
  });
  fighters.append(fightersHeading, fighterList);

  const lab = element(document, "section", "landing-lab landing-section");
  lab.id = "laboratorio";
  lab.setAttribute("aria-labelledby", "landing-lab-title");
  const labCopy = element(document, "div", "landing-lab__copy");
  const labHeading = element(document, "h2", "landing-display landing-section__title landing-lab__title", copy.labTitle);
  labHeading.id = "landing-lab-title";
  labCopy.append(
    labHeading,
    element(document, "p", "landing-lab__body", copy.labBody),
    element(document, "p", "landing-lab__support", copy.labSupport),
  );
  const labAction = button(
    document,
    copy.labAction,
    "landing-button landing-button--primary landing-lab__action",
    { type: "open-experience", experienceId: "bot-vs-bot-lab" },
    dispatch,
  );
  addArrow(document, labAction);
  labCopy.append(labAction);

  const consolePreview = element(document, "div", "landing-console");
  consolePreview.dataset.view = "arena";
  const consoleTabs = element(document, "div", "landing-console__tabs");
  consoleTabs.setAttribute("role", "group");
  consoleTabs.setAttribute("aria-label", snapshot.locale === "pt-BR" ? "Visão do laboratório" : "Lab view");
  const consoleStage = element(document, "div", "landing-console__stage");
  const leftFighter = snapshot.characters[2];
  const rightFighter = snapshot.characters[3];
  if (leftFighter && rightFighter) {
    consoleStage.append(
      createCharacterImage(document, leftFighter, { decorative: true, width: 120, height: 120, draggable: false }),
      element(document, "span", "landing-console__bomb"),
      createCharacterImage(document, rightFighter, { decorative: true, width: 120, height: 120, draggable: false }),
    );
  }
  const viewDescriptions = element(document, "div", "landing-console__views");
  const viewButtons: HTMLButtonElement[] = [];
  copy.labViews.forEach((view, index) => {
    const key = ["arena", "split", "data"][index] ?? "arena";
    const tab = element(document, "button", "landing-console__tab" + (index === 0 ? " is-active" : ""), view.name);
    tab.type = "button";
    tab.dataset.view = key;
    tab.setAttribute("aria-pressed", String(index === 0));
    viewButtons.push(tab);
    const description = element(document, "article", "landing-console__view");
    description.dataset.view = key;
    description.append(
      element(document, "h3", "landing-console__view-name", view.name),
      element(document, "p", "landing-console__view-body", view.body),
    );
    viewDescriptions.append(description);
    tab.addEventListener("click", () => {
      consolePreview.dataset.view = key;
      viewButtons.forEach((button) => {
        const active = button === tab;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    });
    consoleTabs.append(tab);
  });
  const telemetry = element(document, "ul", "landing-console__telemetry");
  copy.telemetry.forEach((label) => {
    const item = element(document, "li", "landing-console__metric");
    item.append(element(document, "span", "landing-console__metric-name", label), element(document, "i", "landing-console__metric-rail"));
    telemetry.append(item);
  });
  consolePreview.append(consoleTabs, consoleStage, viewDescriptions, telemetry);
  lab.append(labCopy, consolePreview);

  const closing = element(document, "section", "landing-closing landing-section");
  closing.setAttribute("aria-labelledby", "landing-closing-title");
  const closingField = element(document, "div", "landing-closing__field");
  closingField.setAttribute("aria-hidden", "true");
  const closingHeading = element(document, "h2", "landing-display landing-closing__title", copy.closingTitle);
  closingHeading.id = "landing-closing-title";
  const closingBody = element(document, "p", "landing-closing__body", copy.closingBody);
  const closingActions = element(document, "div", "landing-actions landing-closing__actions");
  const closingPrimary = button(
    document,
    copy.closingPrimary,
    "landing-button landing-button--primary",
    { type: "open-experience", experienceId: "continuous-room" },
    dispatch,
  );
  closingPrimary.setAttribute("aria-label", snapshot.locale === "pt-BR" ? "Começar pela Sala contínua" : "Start in the Continuous room");
  addArrow(document, closingPrimary);
  const closingSecondary = button(
    document,
    copy.closingSecondary,
    "landing-button landing-button--secondary",
    { type: "open-experience", experienceId: "bot-training" },
    dispatch,
  );
  addArrow(document, closingSecondary);
  closingActions.append(closingPrimary, closingSecondary);
  closing.append(closingField, closingHeading, closingBody, closingActions);

  region.append(hero, modes, mechanics, fighters, lab, closing);
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
