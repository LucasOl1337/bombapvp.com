import "./styles.css";
import "./launcher.css";
import { createBombApp } from "./app/index.ts";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("Bomba PvP root was not found.");
}

const hostname = window.location.hostname;
const isEnglish = hostname.replace(/^www\./, "") === "bombpvp.com";
document.documentElement.lang = isEnglish ? "en" : "pt-BR";
document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute(
  "content",
  isEnglish
    ? "Bomba PvP — browser bomber arena. Online 1v1 duels, bot training, and bot lab."
    : "Bomba PvP — arena de bombardeiros no navegador. Duelo online 1v1, treino contra bots e laboratório.",
);

const app = createBombApp({
  hostname,
  root,
  initialPath: window.location.pathname,
  onPathChange(path) {
    if (path.startsWith("/arena/") || path.startsWith("/GameMechanics/")) {
      window.location.assign(path);
      return;
    }
    if (window.location.pathname !== path) window.history.pushState({}, "", path);
  },
});

window.addEventListener("popstate", () => {
  app.dispatch({ type: "navigate", path: window.location.pathname });
});
