import "./styles.css";
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
    ? "Bomba PvP — choose Continuous Room, Bot Training, or the Bot vs Bot Lab."
    : "Bomba PvP — escolha entre Sala contínua, Treino contra bots e Laboratório Bot vs Bot.",
);

const app = createBombApp({
  hostname,
  root,
  initialPath: window.location.pathname,
  onPathChange(path) {
    if (window.location.pathname !== path) window.history.pushState({}, "", path);
  },
});

window.addEventListener("popstate", () => {
  app.dispatch({ type: "navigate", path: window.location.pathname });
});
