import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, within } from "@testing-library/dom";
import { createBombApp, type BombApp } from "../src/app/index.ts";

const LOCAL_BOT_IDS = ["bomb", "pingo", "v1", "v2", "v3"] as const;
const TRAINING_BOT_SELECTION_CASES = [
  ["bomb"],
  ["pingo"],
  ["v1"],
  ["v2"],
  ["v3"],
] as const;
const RANNI_CHARACTER_ID = "03a976fb-7313-4064-a477-5bb9b0760034";

describe("Bomba PvP app", () => {
  let app: BombApp | undefined;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      profiles: [
        { id: "sol", label: "GPT 5.6 Sol", route: "cx/gpt-5.6-sol" },
        { id: "fable", label: "Claude Fable 5", route: "cc/claude-fable-5" },
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } })));
  });

  afterEach(() => {
    app?.dispose();
    app = undefined;
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  function createRoot(): HTMLElement {
    const root = document.createElement("div");
    document.body.append(root);
    return root;
  }

  it("abre bombapvp.com em português e bombpvp.com em inglês", () => {
    const portugueseRoot = createRoot();
    app = createBombApp({ hostname: "bombapvp.com", root: portugueseRoot });
    expect(app.getSnapshot()).toMatchObject({
      locale: "pt-BR",
      screen: "launcher",
      currentPath: "/",
    });
    expect(app.getSnapshot().experiences.map(({ name }) => name)).toEqual([
      "Jogo online PvP",
      "Treino contra bots",
      "Laboratório Bot vs Bot",
    ]);
    expect(within(portugueseRoot).getByRole("heading", { name: "Bomba PvP", level: 1 })).toBeTruthy();
    expect(within(portugueseRoot).getByRole("heading", { name: "Bomba PvP", level: 2 })).toBeTruthy();
    expect(
      within(portugueseRoot).getByRole("complementary", { name: "Personagens" }),
    ).toBeTruthy();
    expect(within(portugueseRoot).getByRole("button", { name: "Próximo personagem" })).toBeTruthy();
    expect(within(portugueseRoot).getByRole("button", { name: "Personagem anterior" })).toBeTruthy();
    expect(within(portugueseRoot).getByRole("group", { name: "Idioma" })).toBeTruthy();
    expect(portugueseRoot.querySelector(".experience-region")).not.toBeNull();
    expect(portugueseRoot.querySelector(".citadel-feature")).toBeNull();
    expect(portugueseRoot.querySelector(".roster-showcase")).not.toBeNull();
    expect(within(portugueseRoot).getByRole("region", { name: "Comandos da arena" })).toBeTruthy();
    expect(within(portugueseRoot).getByText("Soltar bomba")).toBeTruthy();
    expect(within(portugueseRoot).getByText("Habilidade especial")).toBeTruthy();

    app.dispose();
    const englishRoot = createRoot();
    app = createBombApp({ hostname: "www.bombpvp.com", root: englishRoot });
    expect(app.getSnapshot().locale).toBe("en");
    expect(within(englishRoot).getByRole("heading", { name: "Bomba PvP", level: 2 })).toBeTruthy();
    expect(app.getSnapshot().experiences.map(({ name }) => name)).toEqual([
      "Online PvP",
      "Bot training",
      "Bot vs Bot Lab",
    ]);
    expect(englishRoot.querySelector(".experience-region")).not.toBeNull();
  });

  it("envia a Sala contínua ao motor original direto do launcher com o personagem em foco", () => {
    const root = createRoot();
    const visitedPaths: string[] = [];
    app = createBombApp({
      hostname: "bombapvp.com",
      root,
      onPathChange: (path) => visitedPaths.push(path),
    });
    const view = within(root);

    // Default roster focus is the first unit (Ranni). "Jogar agora" skips selection.
    expect(app.getSnapshot().selectedCharacter?.name).toBe("Ranni");
    fireEvent.click(view.getByRole("button", { name: "Jogar agora" }));
    expect(app.getSnapshot()).toMatchObject({
      screen: "game-launch",
      currentPath: `/arena/?mode=continuous&character=${RANNI_CHARACTER_ID}`,
      activeExperience: { id: "continuous-room", name: "Jogo online PvP" },
      selectedCharacter: { name: "Ranni" },
    });
    expect(view.getByRole("region", { name: "Abrindo arena" })).toBeTruthy();
    expect(view.getByText("Ranni · Jogo online PvP · vs Bomb + Pingo")).toBeTruthy();
    expect(visitedPaths).toEqual([
      `/arena/?mode=continuous&character=${RANNI_CHARACTER_ID}`,
    ]);
  });

  it("usa o personagem em foco no elenco da landing ao entrar no PvP online", () => {
    const root = createRoot();
    app = createBombApp({ hostname: "bombapvp.com", root });
    const view = within(root);

    // Advance the landing roster past Ranni (index 0) to Nico or another unit.
    fireEvent.click(view.getByRole("button", { name: "Próximo personagem" }));
    fireEvent.click(view.getByRole("button", { name: "Jogar agora" }));

    const focusedName = app.getSnapshot().selectedCharacter?.name;
    expect(focusedName).toBeTruthy();
    expect(focusedName).not.toBe("Ranni");
    expect(app.getSnapshot().screen).toBe("game-launch");
    expect(app.getSnapshot().currentPath).toMatch(/^\/arena\/\?mode=continuous&character=/);
    expect(app.getSnapshot().currentPath).not.toContain("bot=");
  });

  it("envia o Treino ao motor original com o personagem escolhido", () => {
    const root = createRoot();
    app = createBombApp({
      hostname: "bombapvp.com",
      root,
      initialPath: "/treino/personagem",
    });
    const view = within(root);

    expect(app.getSnapshot()).toMatchObject({
      screen: "character-selection",
      activeExperience: { id: "bot-training" },
      selectedBot: "bomb",
    });
    const opponent = view.getByRole("combobox", { name: "Bot adversário" }) as HTMLSelectElement;
    expect(opponent.value).toBe("bomb");
    fireEvent.change(opponent, { target: { value: "pingo" } });
    expect(app.getSnapshot().selectedBot).toBe("pingo");
    fireEvent.click(view.getByRole("button", { name: "Nico, Escolher" }));
    fireEvent.click(view.getByRole("button", { name: "Confirmar personagem" }));
    expect(app.getSnapshot()).toMatchObject({
      screen: "game-launch",
      currentPath: "/arena/?mode=training&character=5474c45c-2987-43e0-af2c-a6500c836881&bot=pingo",
      selectedCharacter: { name: "Nico" },
    });
    // Ready screen must echo the chosen opponent bot (daily confusion if missing).
    expect(view.getByText("Nico · Treino contra bots · vs Pingo")).toBeTruthy();
  });

  it.each(TRAINING_BOT_SELECTION_CASES)(
    "oferece os cinco bots no treino e confirma %s",
    (botId) => {
      const root = createRoot();
      app = createBombApp({ hostname: "bombapvp.com", root, initialPath: "/treino/personagem" });
      const view = within(root);
      const opponent = view.getByRole("combobox", { name: "Bot adversário" }) as HTMLSelectElement;
      expect(Array.from(opponent.options, ({ value }) => value)).toEqual([...LOCAL_BOT_IDS]);

      fireEvent.change(opponent, { target: { value: botId } });
      expect(app.getSnapshot().selectedBot).toBe(botId);
      fireEvent.click(view.getByRole("button", { name: "Ranni, Escolher" }));
      fireEvent.click(view.getByRole("button", { name: "Confirmar personagem" }));

      expect(app.getSnapshot().currentPath).toBe(
        `/arena/?mode=training&character=${RANNI_CHARACTER_ID}&bot=${botId}`,
      );
    },
  );

  it("inicia o laboratório com os dois modelos selecionados", async () => {
    const root = createRoot();
    app = createBombApp({ hostname: "bombapvp.com", root });
    const view = within(root);

    fireEvent.click(view.getByRole("button", { name: "Conhecer o laboratório" }));
    expect(app.getSnapshot()).toMatchObject({
      screen: "laboratory",
      currentPath: "/laboratorio",
      activeExperience: { id: "bot-vs-bot-lab" },
    });
    expect(view.getByRole("region", { name: "Laboratório Bot vs Bot" })).toBeTruthy();

    const start = await view.findByRole("button", { name: "Iniciar Bot vs Bot" }) as HTMLButtonElement;
    await view.findByText("Bomb, Pingo, V1, V2 e V3 locais + 2 perfis autorizados do 9Router.");
    await vi.waitFor(() => expect(start.disabled).toBe(false));
    fireEvent.click(start);
    expect(app.getSnapshot()).toMatchObject({
      screen: "game-launch",
      currentPath: "/arena/?mode=lab&model1=bot-bomb&model2=bot-pingo",
    });
  });

  it("volta do game-launch do laboratório para a tela do laboratório, não para seleção de personagem", async () => {
    const root = createRoot();
    app = createBombApp({ hostname: "bombapvp.com", root, initialPath: "/laboratorio" });
    const view = within(root);

    const start = await view.findByRole("button", { name: "Iniciar Bot vs Bot" }) as HTMLButtonElement;
    await vi.waitFor(() => expect(start.disabled).toBe(false));
    fireEvent.click(start);
    expect(app.getSnapshot().screen).toBe("game-launch");
    // Lab launch must not pretend a character was chosen.
    expect(view.getByText("Laboratório Bot vs Bot")).toBeTruthy();
    expect(view.queryByText(/^\s*·/)).toBeNull();
    expect(root.querySelector(".ready-state__portrait img")).toBeNull();
    expect(view.getByRole("button", { name: "Revisar configuração" })).toBeTruthy();
    expect(view.queryByRole("button", { name: "Revisar personagem" })).toBeNull();

    fireEvent.click(view.getByRole("button", { name: "Revisar configuração" }));
    expect(app.getSnapshot()).toMatchObject({
      screen: "laboratory",
      currentPath: "/laboratorio",
      activeExperience: { id: "bot-vs-bot-lab" },
    });
    expect(view.getByRole("region", { name: "Laboratório Bot vs Bot" })).toBeTruthy();
    expect(view.queryByRole("heading", { name: "Escolha seu personagem" })).toBeNull();
  });

  it("configura até quatro competidores misturando LLMs, V3 e V2", async () => {
    const root = createRoot();
    app = createBombApp({ hostname: "bombapvp.com", root, initialPath: "/laboratorio" });
    const view = within(root);

    const playerCount = view.getByRole("combobox", { name: "Quantidade de jogadores" });
    await view.findByText("Bomb, Pingo, V1, V2 e V3 locais + 2 perfis autorizados do 9Router.");
    fireEvent.change(playerCount, { target: { value: "4" } });

    const start = view.getByRole("button", { name: "Iniciar Bot vs Bot" }) as HTMLButtonElement;
    await vi.waitFor(() => expect(start.disabled).toBe(false));
    expect(view.getByRole("combobox", { name: "Modelo do jogador 4" })).toBeTruthy();
    fireEvent.click(start);

    expect(app.getSnapshot()).toMatchObject({
      screen: "game-launch",
      currentPath: "/arena/?mode=lab&model1=bot-bomb&model2=bot-pingo&model3=bot-v3&model4=bot-v2",
    });
  });

  it("mantém V3, V2 e V1 disponíveis quando o 9Router está fora do ar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    const root = createRoot();
    app = createBombApp({ hostname: "bombapvp.com", root, initialPath: "/laboratorio" });
    const view = within(root);

    const start = view.getByRole("button", { name: "Iniciar Bot vs Bot" }) as HTMLButtonElement;
    await view.findByText("Bomb, Pingo, V1, V2 e V3 disponíveis. O laboratório não conseguiu alcançar o 9Router.");
    expect(root.querySelectorAll('option[value="bot-bomb"]')).toHaveLength(4);
    expect(root.querySelectorAll('option[value="bot-pingo"]')).toHaveLength(4);
    expect(root.querySelectorAll('option[value="bot-v1"]')).toHaveLength(4);
    expect(root.querySelectorAll('option[value="bot-v2"]')).toHaveLength(4);
    expect(root.querySelectorAll('option[value="bot-v3"]')).toHaveLength(4);
    expect(start.disabled).toBe(false);
    fireEvent.click(start);

    expect(app.getSnapshot().currentPath).toBe(
      "/arena/?mode=lab&model1=bot-bomb&model2=bot-pingo",
    );
  });

  it("libera V3 contra V2 mesmo quando a consulta ao 9Router fica pendente", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
    const root = createRoot();
    app = createBombApp({ hostname: "bombapvp.com", root, initialPath: "/laboratorio" });
    const view = within(root);

    const start = view.getByRole("button", { name: "Iniciar Bot vs Bot" }) as HTMLButtonElement;
    expect(start.disabled).toBe(false);
    expect(view.getByText("Bomb, Pingo, V1, V2 e V3 disponíveis. Consultando modelos do 9Router…")).toBeTruthy();
    fireEvent.click(start);

    expect(app.getSnapshot().currentPath).toBe(
      "/arena/?mode=lab&model1=bot-bomb&model2=bot-pingo",
    );
  });

  it("aceita navegação externa, publica mudanças e encerra sem efeitos posteriores", () => {
    const root = createRoot();
    app = createBombApp({ hostname: "bombpvp.com", root });
    const screens: string[] = [];
    const unsubscribe = app.subscribe(({ screen }) => screens.push(screen));

    // /jogar/personagem deep-links straight into continuous game-launch (no selection screen).
    app.dispatch({ type: "navigate", path: "/jogar/personagem?origem=home" });
    app.dispatch({ type: "navigate", path: "/rota-antiga" });
    expect(screens).toEqual(["game-launch", "launcher"]);

    unsubscribe();
    app.dispatch({ type: "open-experience", experienceId: "bot-training" });
    expect(screens).toEqual(["game-launch", "launcher"]);
    expect(Object.isFrozen(app.getSnapshot())).toBe(true);
    expect(Object.isFrozen(app.getSnapshot().characters)).toBe(true);
    expect(app.getSnapshot().characters.every(Object.isFrozen)).toBe(true);

    app.dispose();
    app.dispatch({ type: "back-to-launcher" });
    expect(root.childElementCount).toBe(0);
  });
});
