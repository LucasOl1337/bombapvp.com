import type { Character, Locale } from "../app/catalog.ts";
import { BotTrainingGame, type Direction, type GameState } from "./engine.ts";
import { BOARD_HEIGHT, BOARD_WIDTH, isWall, type ArenaPlayer, type Tile } from "./model.ts";

type GameplayCopy = Readonly<{
  title: string;
  leave: string;
  keyboardHint: string;
  bomb: string;
  arenaLabel: string;
  opponentStatus: (count: number) => string;
  wonTitle: string;
  lostTitle: string;
  drawTitle: string;
  wonMessage: string;
  lostMessage: string;
  drawMessage: string;
  restart: string;
}>;

const COPY: Readonly<Record<Locale, GameplayCopy>> = {
  "pt-BR": {
    title: "Treino contra bots",
    leave: "Trocar personagem",
    keyboardHint: "Mover: WASD ou setas · Bomba: Espaço",
    bomb: "Bomba",
    arenaLabel: "Arena de treino em andamento",
    opponentStatus: (count) => `${count} ${count === 1 ? "bot restante" : "bots restantes"}`,
    wonTitle: "Vitória!",
    lostTitle: "Você foi eliminado",
    drawTitle: "Empate explosivo",
    wonMessage: "Você foi o último bomber vivo.",
    lostMessage: "Os bots ficaram com esta rodada.",
    drawMessage: "Ninguém escapou da última explosão.",
    restart: "Jogar novamente",
  },
  en: {
    title: "Bot training",
    leave: "Change character",
    keyboardHint: "Move: WASD or arrows · Bomb: Space",
    bomb: "Bomb",
    arenaLabel: "Training arena in progress",
    opponentStatus: (count) => `${count} ${count === 1 ? "bot remaining" : "bots remaining"}`,
    wonTitle: "Victory!",
    lostTitle: "You were eliminated",
    drawTitle: "Explosive draw",
    wonMessage: "You were the last bomber standing.",
    lostMessage: "The bots took this round.",
    drawMessage: "Nobody escaped the final blast.",
    restart: "Play again",
  },
};

export type GameplayView = Readonly<{
  element: HTMLElement;
  dispose: () => void;
}>;

type GameplayViewOptions = Readonly<{
  document: Document;
  locale: Locale;
  selectedCharacter: Character;
  characters: readonly Character[];
  onLeave: () => void;
}>;

function node<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tagName: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function actionButton(
  document: Document,
  label: string,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = node(document, "button", className, label);
  button.type = "button";
  button.addEventListener("click", onClick);
  return button;
}

function position(element: HTMLElement, tile: Tile): void {
  element.style.left = `${(tile.x / BOARD_WIDTH) * 100}%`;
  element.style.top = `${(tile.y / BOARD_HEIGHT) * 100}%`;
}

function characterForPlayer(
  player: ArenaPlayer,
  selectedCharacter: Character,
  botCharacters: readonly Character[],
): Character {
  if (player.kind === "human") return selectedCharacter;
  return botCharacters[(player.id - 2) % botCharacters.length] ?? selectedCharacter;
}

function resultCopy(copy: GameplayCopy, status: GameState["status"]): Readonly<{ title: string; message: string }> {
  if (status === "won") return { title: copy.wonTitle, message: copy.wonMessage };
  if (status === "lost") return { title: copy.lostTitle, message: copy.lostMessage };
  return { title: copy.drawTitle, message: copy.drawMessage };
}

export function createGameplayView({
  document,
  locale,
  selectedCharacter,
  characters,
  onLeave,
}: GameplayViewOptions): GameplayView {
  const copy = COPY[locale];
  const game = new BotTrainingGame();
  const section = node(document, "section", "gameplay");
  section.setAttribute("aria-label", copy.title);

  const heading = node(document, "header", "gameplay__header");
  const headingCopy = node(document, "div", "gameplay__heading-copy");
  headingCopy.append(
    node(document, "p", "page-intro__kicker", "LOCAL ARENA · 01"),
    node(document, "h2", "gameplay__title", copy.title),
  );
  const leaveButton = actionButton(document, `← ${copy.leave}`, "text-action", onLeave);
  heading.append(headingCopy, leaveButton);

  const hud = node(document, "div", "gameplay__hud");
  const identity = node(document, "div", "gameplay__identity");
  const identityImage = document.createElement("img");
  identityImage.src = selectedCharacter.assetPath;
  identityImage.alt = "";
  identityImage.width = 44;
  identityImage.height = 44;
  const identityCopy = node(document, "span", "gameplay__identity-copy");
  identityCopy.append(
    node(document, "small", "gameplay__identity-label", locale === "pt-BR" ? "VOCÊ" : "YOU"),
    node(document, "strong", "gameplay__identity-name", selectedCharacter.name),
  );
  identity.append(identityImage, identityCopy);
  const liveStatus = node(document, "p", "gameplay__live-status");
  liveStatus.setAttribute("aria-live", "polite");
  const timer = node(document, "p", "gameplay__timer", "00:00");
  hud.append(identity, liveStatus, timer);

  const arenaShell = node(document, "div", "gameplay__arena-shell");
  const arena = node(document, "div", "gameplay__arena");
  arena.tabIndex = 0;
  arena.setAttribute("role", "application");
  arena.setAttribute("aria-label", copy.arenaLabel);
  const grid = node(document, "div", "gameplay__grid");
  grid.setAttribute("aria-hidden", "true");
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      grid.append(node(document, "span", isWall({ x, y }) ? "arena-tile arena-tile--wall" : "arena-tile arena-tile--floor"));
    }
  }
  const dynamicLayer = node(document, "div", "gameplay__dynamic");
  dynamicLayer.setAttribute("aria-hidden", "true");
  const result = node(document, "div", "gameplay__result");
  result.hidden = true;
  arena.append(grid, dynamicLayer, result);
  arenaShell.append(arena);

  const controls = node(document, "div", "gameplay__controls");
  const keyboardHint = node(document, "p", "gameplay__keyboard-hint", copy.keyboardHint);
  const touchControls = node(document, "div", "gameplay__touch-controls");
  const dpad = node(document, "div", "gameplay__dpad");
  const directionButtons: Array<Readonly<{ direction: Direction; label: string; className: string }>> = [
    { direction: "up", label: "↑", className: "gameplay__control--up" },
    { direction: "left", label: "←", className: "gameplay__control--left" },
    { direction: "down", label: "↓", className: "gameplay__control--down" },
    { direction: "right", label: "→", className: "gameplay__control--right" },
  ];
  for (const control of directionButtons) {
    const button = node(document, "button", `gameplay__control ${control.className}`, control.label);
    button.type = "button";
    button.setAttribute("aria-label", control.direction);
    const start = (event: Event): void => {
      event.preventDefault();
      game.moveHuman(control.direction);
      game.setHumanDirection(control.direction);
    };
    const stop = (): void => game.setHumanDirection(null);
    button.addEventListener("pointerdown", start);
    button.addEventListener("pointerup", stop);
    button.addEventListener("pointercancel", stop);
    button.addEventListener("pointerleave", stop);
    dpad.append(button);
  }
  const bombButton = actionButton(document, copy.bomb, "gameplay__bomb-control", () => {
    game.placeBomb();
    arena.focus();
  });
  bombButton.setAttribute("aria-label", copy.bomb);
  touchControls.append(dpad, bombButton);
  controls.append(keyboardHint, touchControls);
  section.append(heading, hud, arenaShell, controls);

  const botCharacters = characters.filter((character) => character.id !== selectedCharacter.id);
  let renderedStatus: GameState["status"] = "playing";

  function render(): void {
    const snapshot = game.getSnapshot();
    const opponents = snapshot.players.filter((player) => player.kind === "bot" && player.alive).length;
    liveStatus.textContent = copy.opponentStatus(opponents);
    const seconds = Math.floor(snapshot.elapsedMs / 1_000);
    timer.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

    const fragment = document.createDocumentFragment();
    for (const key of snapshot.crates) {
      const [x = 0, y = 0] = key.split(",").map(Number);
      const crate = node(document, "span", "arena-object arena-crate");
      position(crate, { x, y });
      fragment.append(crate);
    }
    for (const flame of snapshot.flames) {
      const flameNode = node(document, "span", "arena-object arena-flame");
      position(flameNode, flame.tile);
      fragment.append(flameNode);
    }
    for (const bomb of snapshot.bombs) {
      const bombNode = node(document, "span", "arena-object arena-bomb");
      bombNode.dataset.ownerId = String(bomb.ownerId);
      bombNode.style.setProperty("--fuse", String(Math.max(0.15, bomb.fuseMs / 1_900)));
      position(bombNode, bomb.tile);
      fragment.append(bombNode);
    }
    for (const player of snapshot.players.filter((candidate) => candidate.alive)) {
      const actor = node(document, "span", `arena-object arena-player arena-player--${player.kind}`);
      actor.dataset.playerId = String(player.id);
      const actorImage = document.createElement("img");
      const character = characterForPlayer(player, selectedCharacter, botCharacters);
      actorImage.src = character.assetPath;
      actorImage.alt = "";
      actor.append(actorImage, node(document, "small", "arena-player__tag", player.kind === "human" ? "P1" : `BOT ${player.id - 1}`));
      position(actor, player.tile);
      fragment.append(actor);
    }
    dynamicLayer.replaceChildren(fragment);

    if (snapshot.status !== "playing" && renderedStatus === "playing") {
      const outcome = resultCopy(copy, snapshot.status);
      result.replaceChildren(
        node(document, "p", "gameplay__result-kicker", "ROUND OVER"),
        node(document, "h3", "gameplay__result-title", outcome.title),
        node(document, "p", "gameplay__result-message", outcome.message),
        actionButton(document, copy.restart, "action action--primary", () => {
          game.restart();
          renderedStatus = "playing";
          result.hidden = true;
          arena.focus();
          render();
        }),
      );
      result.hidden = false;
      renderedStatus = snapshot.status;
    }
  }

  const keyDirections: Readonly<Record<string, Direction>> = {
    ArrowUp: "up",
    KeyW: "up",
    ArrowDown: "down",
    KeyS: "down",
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right",
  };
  const heldKeys = new Set<string>();
  const view = document.defaultView;
  const onKeyDown = (event: KeyboardEvent): void => {
    const direction = keyDirections[event.code];
    if (direction) {
      event.preventDefault();
      heldKeys.add(event.code);
      game.moveHuman(direction);
      game.setHumanDirection(direction);
      return;
    }
    if (event.code === "Space" && !event.repeat) {
      event.preventDefault();
      game.placeBomb();
    }
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    if (!keyDirections[event.code]) return;
    heldKeys.delete(event.code);
    const nextHeld = [...heldKeys].at(-1);
    game.setHumanDirection(nextHeld ? keyDirections[nextHeld] ?? null : null);
  };
  const onBlur = (): void => {
    heldKeys.clear();
    game.setHumanDirection(null);
  };

  view?.addEventListener("keydown", onKeyDown);
  view?.addEventListener("keyup", onKeyUp);
  view?.addEventListener("blur", onBlur);
  const interval = view?.setInterval(() => {
    game.advance(50);
    render();
  }, 50);
  render();

  return {
    element: section,
    dispose() {
      if (interval !== undefined) view?.clearInterval(interval);
      view?.removeEventListener("keydown", onKeyDown);
      view?.removeEventListener("keyup", onKeyUp);
      view?.removeEventListener("blur", onBlur);
      heldKeys.clear();
      game.setHumanDirection(null);
    },
  };
}
