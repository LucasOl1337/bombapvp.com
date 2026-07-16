import "./original-game.css";
import { loadGameAssets } from "./Engine/assets";
import { GameApp } from "./Engine/game-app";

const rootElement = document.querySelector<HTMLElement>("#app");

if (!rootElement) throw new Error("Original Bomba PvP game root was not found.");
const root: HTMLElement = rootElement;

const CHARACTER_IDS = [
  "03a976fb-7313-4064-a477-5bb9b0760034",
  "6ee8baa5-3277-413b-ae0e-2659b9cc52e9",
  "d083c3dc-7162-4391-8628-6adde0b8d8d6",
  "5474c45c-2987-43e0-af2c-a6500c836881",
] as const;

async function bootOriginalGame(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const selectedCharacterId = params.get("character");
  const selectedCharacterIndex = Math.max(0, CHARACTER_IDS.indexOf(
    selectedCharacterId as (typeof CHARACTER_IDS)[number],
  ));
  const mode = params.get("mode") === "continuous" ? "continuous" : "training";
  const hostname = window.location.hostname.replace(/^www\./, "");

  document.documentElement.lang = hostname === "bombpvp.com" ? "en" : "pt-BR";
  const assets = await loadGameAssets();
  root.replaceChildren();
  root.removeAttribute("aria-live");

  const game = new GameApp(root, assets);
  game.setLanguage(hostname === "bombpvp.com" ? "en" : "pt");
  game.setOfflinePreferredCharacter(selectedCharacterIndex);
  game.start();
  game.startOfflineBotMatch(mode === "training" ? 1 : 3, mode === "training" ? "classic" : "endless");
}

void bootOriginalGame().catch((error: unknown) => {
  console.error("Original Bomba PvP gameplay failed to start", error);
  root.dataset.state = "error";
  root.textContent = document.documentElement.lang === "en"
    ? "The original arena failed to load. Return and try again."
    : "A arena original não carregou. Volte e tente novamente.";
});
