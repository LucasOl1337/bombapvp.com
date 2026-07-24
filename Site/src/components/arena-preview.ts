import { html, type RawHtml } from "../ui/html.ts";

const COLS = 11;
const ROWS = 9;

export interface PreviewMode {
  readonly id: string;
  readonly label: string;
  readonly url: string;
  readonly p1: string;
  readonly p2: string;
  readonly note: string;
}

export const PREVIEW_MODES: readonly PreviewMode[] = [
  {
    id: "local",
    label: "Duelo local",
    url: "bombapvp.com/?mode=local&p1=ranni&p2=killer-bee",
    p1: "Ranni · humano",
    p2: "Killer Bee · humano",
    note: "Dois jogadores, um teclado",
  },
  {
    id: "training",
    label: "Treino vs bot",
    url: "bombapvp.com/?mode=training&p1=thresh&bot=v3",
    p1: "Thresh · humano",
    p2: "Crocodilo · bot v3",
    note: "Perfil v3 · pressão agressiva",
  },
  {
    id: "lab",
    label: "Laboratório",
    url: "bombapvp.com/?mode=lab&bot1=pingo&bot2=v2",
    p1: "Ranni · bot pingo",
    p2: "Crocodilo · bot v2",
    note: "Seed fixa · rodada 3 de 5",
  },
];

/** Paredes fixas no padrão clássico: colunas e linhas pares internas. */
function isWall(col: number, row: number): boolean {
  return col % 2 === 1 && row % 2 === 1;
}

/** Layout determinístico por modo — nada de aleatório, o preview é estável. */
function tileClass(col: number, row: number, mode: number): string {
  const index = row * COLS + col;
  if (isWall(col, row)) return "tile tile--wall";

  const spawnP1 = row === 0 && col === 0;
  const spawnP2 = row === ROWS - 1 && col === COLS - 1;
  if (spawnP1) return "tile tile--p1";
  if (spawnP2) return "tile tile--p2";

  // Cantos de spawn ficam livres para o jogador ter saída.
  const nearSpawn =
    (row <= 1 && col <= 1) || (row >= ROWS - 2 && col >= COLS - 2);
  if (nearSpawn) return "tile";

  const bombAt = [ROWS * COLS - 24, 39, 57][mode] ?? 39;
  if (index === bombAt) return "tile tile--bomb";
  if (
    index === bombAt - 1 ||
    index === bombAt + 1 ||
    index === bombAt - COLS ||
    index === bombAt + COLS
  ) {
    return "tile tile--blast";
  }

  // Distribuição pseudo-fixa de caixas, variando por modo sem PRNG.
  return (index * 7 + mode * 3) % 5 < 2 ? "tile tile--crate" : "tile";
}

function grid(mode: number): RawHtml {
  const tiles: RawHtml[] = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      tiles.push(html`<div class="${tileClass(col, row, mode)}"></div>`);
    }
  }
  return html`<div class="arena" data-arena>${tiles}</div>`;
}

export function arenaPreview(): RawHtml {
  const first = PREVIEW_MODES[0]!;
  return html`
    <div class="glass glass--strong preview" data-preview>
      <div class="preview__chrome">
        <div class="preview__dots"><span></span><span></span><span></span></div>
        <div class="preview__url" data-preview-url>${first.url}</div>
      </div>

      <div class="preview__tabs" role="tablist" aria-label="Modos de partida">
        ${PREVIEW_MODES.map(
          (mode, index) => html`
            <button
              class="preview__tab"
              role="tab"
              type="button"
              data-preview-tab="${index}"
              aria-selected="${index === 0 ? "true" : "false"}"
            >
              ${mode.label}
            </button>
          `,
        )}
      </div>

      <div class="preview__stage">${grid(0)}</div>

      <div class="preview__hud">
        <span><strong data-preview-p1>${first.p1}</strong></span>
        <span data-preview-note>${first.note}</span>
        <span><strong data-preview-p2>${first.p2}</strong></span>
      </div>
    </div>
  `;
}

/** Troca o layout e o HUD ao clicar numa aba. */
export function initArenaPreview(root: ParentNode = document): void {
  const host = root.querySelector<HTMLElement>("[data-preview]");
  if (!host) return;

  const stage = host.querySelector<HTMLElement>(".preview__stage");
  const url = host.querySelector<HTMLElement>("[data-preview-url]");
  const p1 = host.querySelector<HTMLElement>("[data-preview-p1]");
  const p2 = host.querySelector<HTMLElement>("[data-preview-p2]");
  const note = host.querySelector<HTMLElement>("[data-preview-note]");
  const tabs = [...host.querySelectorAll<HTMLButtonElement>("[data-preview-tab]")];

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const index = Number(tab.dataset.previewTab ?? 0);
      const mode = PREVIEW_MODES[index];
      if (!mode || !stage) return;

      tabs.forEach((other) =>
        other.setAttribute("aria-selected", other === tab ? "true" : "false"),
      );
      stage.innerHTML = grid(index).value;
      if (url) url.textContent = mode.url;
      if (p1) p1.textContent = mode.p1;
      if (p2) p2.textContent = mode.p2;
      if (note) note.textContent = mode.note;
    });
  });
}
