import type { AppIntent, AppSnapshot } from "./state.ts";
import brandMarkUrl from "../../game-assets/ui/branding/brand-mark.png?url";
import { getLauncherPreview } from "../../Champions/launcher-previews.ts";
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
  const mark = element(document, "span", "brand__mark");
  mark.setAttribute("aria-hidden", "true");
  const markImage = document.createElement("img");
  markImage.src = brandMarkUrl;
  markImage.alt = "";
  markImage.width = 48;
  markImage.height = 48;
  markImage.draggable = false;
  markImage.className = "brand__mark-image";
  mark.append(markImage);
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

function prefersReducedMotion(document: Document): boolean {
  return document.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

type ShowcaseClip = Readonly<{ frames: readonly string[] }>;

function createShowcaseAnimator(
  image: HTMLImageElement,
  document: Document,
): {
  setShowreel: (clips: readonly ShowcaseClip[], options?: Readonly<{ fps?: number; holdMs?: number }>) => void;
  stop: () => void;
} {
  let clips: readonly ShowcaseClip[] = [];
  let clipIndex = 0;
  let frameIndex = 0;
  let timer: number | null = null;
  let fps = 6;
  let holdMs = 420;
  const win = document.defaultView;

  function clearTimer(): void {
    if (timer !== null && win) {
      win.clearTimeout(timer);
      timer = null;
    }
  }

  function schedule(ms: number, fn: () => void): void {
    if (!win) return;
    timer = win.setTimeout(fn, ms);
  }

  function showCurrentFrame(): void {
    const clip = clips[clipIndex];
    const frame = clip?.frames[frameIndex];
    if (frame) image.src = frame;
  }

  function advance(): void {
    clearTimer();
    if (clips.length === 0 || !win || prefersReducedMotion(document)) return;

    const clip = clips[clipIndex];
    if (!clip || clip.frames.length === 0) return;

    const frameMs = Math.max(70, Math.round(1000 / Math.max(1, fps)));
    const atLastFrame = frameIndex >= clip.frames.length - 1;

    if (!atLastFrame) {
      frameIndex += 1;
      showCurrentFrame();
      schedule(frameMs, advance);
      return;
    }

    // Hold on the last frame of each clip, then move to the next clip.
    schedule(holdMs, () => {
      clipIndex = (clipIndex + 1) % clips.length;
      frameIndex = 0;
      showCurrentFrame();
      schedule(frameMs, advance);
    });
  }

  function setShowreel(
    nextClips: readonly ShowcaseClip[],
    options: Readonly<{ fps?: number; holdMs?: number }> = {},
  ): void {
    clearTimer();
    clips = nextClips.filter((clip) => clip.frames.length > 0);
    clipIndex = 0;
    frameIndex = 0;
    fps = options.fps ?? 6;
    holdMs = options.holdMs ?? 420;
    if (clips.length === 0) return;
    showCurrentFrame();
    if (prefersReducedMotion(document) || !win) return;
    const frameMs = Math.max(70, Math.round(1000 / Math.max(1, fps)));
    schedule(frameMs, advance);
  }

  return {
    setShowreel,
    stop: clearTimer,
  };
}

function clipsForCharacter(character: CharacterSnapshot): ShowcaseClip[] {
  const preview = getLauncherPreview(character.id);
  if (preview && preview.clips.length > 0) {
    // Idle twice for presence, then the rest of the kit.
    const idle = preview.clips.find((clip) => clip.name === "idle");
    const rest = preview.clips.filter((clip) => clip.name !== "idle");
    const ordered: ShowcaseClip[] = [];
    if (idle) {
      ordered.push(idle, idle);
    }
    ordered.push(...rest);
    return ordered;
  }
  return [{ frames: [character.assetPath] }];
}

function renderRosterShowcase(document: Document, snapshot: AppSnapshot): HTMLElement {
  const characters = snapshot.characters;
  const isPortuguese = snapshot.locale === "pt-BR";
  let index = 0;
  let hovering = false;

  const panel = element(document, "aside", "roster-showcase");
  panel.setAttribute("aria-label", snapshot.copy.charactersLabel);

  const stageWrap = element(document, "div", "roster-showcase__stage");
  const portraitHost = element(document, "div", "roster-showcase__viewport");
  portraitHost.setAttribute("aria-hidden", "true");

  const sprite = document.createElement("img");
  sprite.className = "roster-showcase__sprite";
  sprite.alt = "";
  sprite.draggable = false;
  sprite.decoding = "async";
  portraitHost.append(sprite);
  const animator = createShowcaseAnimator(sprite, document);

  const prev = element(document, "button", "roster-showcase__nav roster-showcase__nav--prev", "‹") as HTMLButtonElement;
  prev.type = "button";
  prev.setAttribute("aria-label", isPortuguese ? "Personagem anterior" : "Previous character");

  const next = element(document, "button", "roster-showcase__nav roster-showcase__nav--next", "›") as HTMLButtonElement;
  next.type = "button";
  next.setAttribute("aria-label", isPortuguese ? "Próximo personagem" : "Next character");

  stageWrap.append(prev, portraitHost, next);

  const detail = element(document, "div", "roster-showcase__detail");
  const label = element(document, "p", "roster-showcase__label");
  const name = element(document, "h3", "roster-showcase__name");
  const description = element(document, "p", "roster-showcase__description");
  const counter = element(document, "p", "roster-showcase__counter");
  counter.setAttribute("aria-live", "polite");
  detail.append(label, name, description, counter);

  const thumbs = element(document, "div", "roster-showcase__thumbs");
  thumbs.setAttribute("role", "tablist");
  thumbs.setAttribute("aria-label", snapshot.copy.charactersLabel);

  const thumbButtons: HTMLButtonElement[] = [];
  characters.forEach((character, thumbIndex) => {
    const thumb = element(
      document,
      "button",
      "roster-showcase__thumb",
    ) as HTMLButtonElement;
    thumb.type = "button";
    thumb.setAttribute("role", "tab");
    thumb.setAttribute("aria-label", character.name);
    thumb.setAttribute("aria-selected", "false");
    const thumbImage = createCharacterImage(document, character, {
      decorative: true,
      width: 64,
      height: 64,
    });
    thumb.append(thumbImage);
    thumb.addEventListener("click", () => {
      index = thumbIndex;
      paint();
    });
    thumbs.append(thumb);
    thumbButtons.push(thumb);
  });

  function playForCurrent(): void {
    const character = characters[index];
    if (!character) return;
    const clips = clipsForCharacter(character);
    // Hover leans into movement/action; default is full showreel at a calm pace.
    if (hovering) {
      const motion = clips.filter((_, clipIndex) => {
        // Prefer walk/run/cast/attack when available (skip the doubled idle pair).
        return clipIndex >= 2 || clips.length <= 2;
      });
      animator.setShowreel(motion.length > 0 ? motion : clips, { fps: 8, holdMs: 220 });
      return;
    }
    animator.setShowreel(clips, { fps: 6, holdMs: 480 });
  }

  function paint(): void {
    const character = characters[index];
    if (!character) return;

    portraitHost.dataset.accent = character.accent;
    label.textContent = character.label;
    name.textContent = character.name;
    description.textContent = character.description;
    counter.textContent = `${index + 1} / ${characters.length}`;
    playForCurrent();

    thumbButtons.forEach((thumb, thumbIndex) => {
      const selected = thumbIndex === index;
      thumb.classList.toggle("is-active", selected);
      thumb.setAttribute("aria-selected", String(selected));
    });
  }

  function step(delta: number): void {
    index = (index + delta + characters.length) % characters.length;
    paint();
  }

  prev.addEventListener("click", () => step(-1));
  next.addEventListener("click", () => step(1));

  portraitHost.addEventListener("pointerenter", () => {
    hovering = true;
    playForCurrent();
  });
  portraitHost.addEventListener("pointerleave", () => {
    hovering = false;
    playForCurrent();
  });

  panel.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    }
  });

  // Stop timers when the launcher node is discarded on re-render.
  const observer = new MutationObserver(() => {
    if (!panel.isConnected) {
      animator.stop();
      observer.disconnect();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  panel.append(stageWrap, detail, thumbs);
  paint();
  return panel;
}

function renderExperienceGrid(
  document: Document,
  snapshot: AppSnapshot,
  dispatch: Dispatch,
): HTMLElement {
  const grid = element(document, "div", "experience-grid");
  snapshot.experiences.forEach((experience, index) => {
    const article = element(
      document,
      "article",
      "experience-card experience-card--" + String(index + 1),
    );
    article.dataset.experience = experience.id;

    const header = element(document, "div", "experience-card__header");
    const number = element(
      document,
      "span",
      "experience-card__number",
      String(index + 1).padStart(2, "0"),
    );
    number.setAttribute("aria-hidden", "true");
    header.append(
      number,
      element(document, "p", "experience-card__journey", experience.journeyLabel),
    );

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
    article.append(header, copy, action);
    grid.append(article);
  });
  return grid;
}

function renderLauncher(document: Document, snapshot: AppSnapshot, dispatch: Dispatch): HTMLElement {
  const region = element(document, "section", "experience-region");
  region.setAttribute("aria-label", snapshot.copy.experiencesLabel);

  // Modes first: play CTAs visible without scrolling. Roster sits below.
  const intro = element(document, "header", "page-intro page-intro--launcher");
  intro.append(
    element(document, "p", "page-intro__kicker", snapshot.copy.launcherKicker),
    element(document, "h2", "page-intro__title page-intro__title--brand", snapshot.copy.launcherTitle),
    element(document, "p", "page-intro__description", snapshot.copy.launcherIntroduction),
  );

  const modes = element(document, "div", "launcher-modes");
  modes.append(
    element(document, "p", "launcher-modes__label", snapshot.copy.experiencesLabel),
    renderExperienceGrid(document, snapshot, dispatch),
  );

  const roster = element(document, "div", "launcher-roster");
  roster.append(
    element(
      document,
      "p",
      "launcher-roster__label",
      snapshot.locale === "pt-BR" ? "Elenco" : "Roster",
    ),
    renderRosterShowcase(document, snapshot),
  );

  region.append(intro, modes, roster);
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
  const isLabLaunch = snapshot.activeExperience?.id === "bot-vs-bot-lab";
  const portrait = element(
    document,
    "div",
    "ready-state__portrait ready-state__portrait--" + (snapshot.selectedCharacter?.accent ?? "blue"),
  );
  // Lab has no player character; avoid an empty <img src=""> portrait.
  if (snapshot.selectedCharacter) {
    portrait.append(createCharacterImage(document, snapshot.selectedCharacter));
  }

  // Offline treino/jogar always pick an opponent bot — surface it so the ready
  // screen matches what the user chose (defaults included).
  const opponentBotLabel = isLabLaunch
    ? null
    : (snapshot.bots.find((bot) => bot.id === snapshot.selectedBot)?.label ?? null);
  const choiceLine = isLabLaunch
    ? (snapshot.activeExperience?.name ?? "")
    : [
      snapshot.selectedCharacter?.name,
      snapshot.activeExperience?.name,
      opponentBotLabel ? `vs ${opponentBotLabel}` : null,
    ].filter(Boolean).join(" · ");
  const reviseLabel = isLabLaunch
    ? snapshot.copy.reviseLabLabel
    : snapshot.copy.reviseLabel;

  const copy = element(document, "div", "ready-state__copy");
  copy.append(
    element(document, "p", "page-intro__kicker", snapshot.locale === "pt-BR" ? "GAMEPLAY ORIGINAL" : "ORIGINAL GAMEPLAY"),
    element(document, "h2", "page-intro__title", snapshot.locale === "pt-BR" ? "Abrindo arena" : "Opening arena"),
    element(document, "p", "ready-state__choice", choiceLine),
    element(document, "p", "page-intro__description", snapshot.locale === "pt-BR" ? "Carregando o motor original de Bomba PvP." : "Loading the original Bomba PvP engine."),
  );
  const actions = element(document, "div", "ready-state__actions");
  actions.append(
    button(
      document,
      reviseLabel,
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
