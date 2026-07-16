import type { AppIntent, AppSnapshot } from "./state.ts";

type Dispatch = (intent: AppIntent) => void;

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

function renderBrand(document: Document, snapshot: AppSnapshot, dispatch: Dispatch): HTMLElement {
  const header = element(document, "header", "brand");
  const home = button(
    document,
    "B",
    "brand__mark",
    { type: "back-to-launcher" },
    dispatch,
  );
  home.setAttribute(
    "aria-label",
    snapshot.locale === "pt-BR" ? "Ir para o início" : "Go to start",
  );
  const copy = element(document, "div", "brand__copy");
  copy.append(
    element(document, "p", "brand__eyebrow", "BROWSER BATTLE ARENA"),
    element(document, "h1", "brand__name", snapshot.brand),
  );
  header.append(home, copy);
  return header;
}

function renderLauncher(document: Document, snapshot: AppSnapshot, dispatch: Dispatch): HTMLElement {
  const region = element(document, "section", "experience-region");
  region.setAttribute("aria-label", snapshot.copy.experiencesLabel);

  const intro = element(document, "header", "page-intro page-intro--launcher");
  intro.append(
    element(document, "p", "page-intro__kicker", snapshot.copy.launcherKicker),
    element(document, "h2", "page-intro__title", snapshot.copy.launcherTitle),
    element(document, "p", "page-intro__description", snapshot.copy.launcherIntroduction),
  );

  const grid = element(document, "div", "experience-grid");
  snapshot.experiences.forEach((experience, index) => {
    const article = element(
      document,
      "article",
      "experience-card experience-card--" + String(index + 1),
    );
    article.dataset.experience = experience.id;
    const number = element(
      document,
      "span",
      "experience-card__number",
      String(index + 1).padStart(2, "0"),
    );
    number.setAttribute("aria-hidden", "true");
    const copy = element(document, "div", "experience-card__copy");
    copy.append(
      element(document, "p", "experience-card__journey", experience.journeyLabel),
      element(document, "h3", "experience-card__name", experience.name),
      element(document, "p", "experience-card__description", experience.description),
    );
    const action = button(
      document,
      experience.actionLabel,
      "action action--primary",
      { type: "open-experience", experienceId: experience.id },
      dispatch,
    );
    addArrow(document, action);
    article.append(number, copy, action);
    grid.append(article);
  });
  region.append(intro, grid);
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
    const image = document.createElement("img");
    image.src = character.assetPath;
    image.alt = "";
    image.width = 160;
    image.height = 160;
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
  const confirm = button(
    document,
    snapshot.copy.continueLabel,
    "action action--primary action--confirm",
    { type: "confirm-character" },
    dispatch,
  );
  confirm.disabled = !snapshot.selectedCharacter;
  addArrow(document, confirm);
  confirmation.append(selectionCopy, confirm);

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
  const image = document.createElement("img");
  image.src = snapshot.selectedCharacter?.assetPath ?? "";
  image.alt = snapshot.selectedCharacter?.name ?? "";
  image.width = 160;
  image.height = 160;
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

  const capabilities = element(document, "ul", "laboratory__capabilities");
  [snapshot.copy.labObservation, snapshot.copy.labConfiguration].forEach((capability, index) => {
    const item = element(document, "li", "laboratory__capability");
    item.append(
      element(document, "span", "laboratory__capability-number", "0" + String(index + 1)),
      element(document, "span", "laboratory__capability-copy", capability),
    );
    capabilities.append(item);
  });
  const boundary = element(document, "aside", "laboratory__boundary");
  boundary.append(
    element(document, "span", "laboratory__boundary-mark", "ID"),
    element(document, "p", "laboratory__boundary-copy", snapshot.copy.labBoundary),
  );
  layout.append(copy, capabilities, boundary);
  region.append(navigation, layout);
  return region;
}

function renderFooter(document: Document, snapshot: AppSnapshot): HTMLElement {
  const footer = element(document, "footer", "app-footer");
  footer.append(element(document, "p", "app-footer__product", snapshot.copy.footerLabel));
  const language = element(document, "a", "app-footer__language", snapshot.copy.languageLabel);
  language.href = snapshot.locale === "pt-BR" ? "https://bombpvp.com" : "https://bombapvp.com";
  language.hreflang = snapshot.locale === "pt-BR" ? "en" : "pt-BR";
  footer.append(language);
  return footer;
}

export function renderApp(root: HTMLElement, snapshot: AppSnapshot, dispatch: Dispatch): void {
  const document = root.ownerDocument;
  const main = element(document, "main", "app-shell app-shell--" + snapshot.screen);
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
