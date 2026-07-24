import "./styles/base.css";
import "./styles/glass.css";
import "./styles/sections.css";

import { html, mount } from "./ui/html.ts";
import { initAll } from "./ui/interactions.ts";
import { DEFAULT_LINKS, ambient, footer, nav } from "./components/shell.ts";
import { SITE } from "./data/content.ts";

interface KeyRow {
  readonly action: string;
  readonly keys: readonly string[];
}

const P1_KEYS: readonly KeyRow[] = [
  { action: "Mover", keys: ["W", "A", "S", "D"] },
  { action: "Plantar bomba", keys: ["Q"] },
  { action: "Ultimate", keys: ["Espaço", "R"] },
];

const P2_KEYS: readonly KeyRow[] = [
  { action: "Mover", keys: ["↑", "←", "↓", "→"] },
  { action: "Plantar bomba", keys: ["O"] },
  { action: "Ultimate", keys: ["I"] },
];

const SYSTEM_KEYS: readonly KeyRow[] = [
  { action: "Pausar", keys: ["Esc"] },
  { action: "Reiniciar", keys: ["T"] },
  { action: "Alternar som", keys: ["M"] },
];

function keyCard(title: string, rows: readonly KeyRow[], index: number) {
  return html`
    <article class="glass keys__card" data-reveal style="--reveal-delay:${index * 90}ms">
      <h3>${title}</h3>
      ${rows.map(
        (row) => html`
          <div class="keys__row">
            <span>${row.action}</span>
            <span>${row.keys.map((key) => html`<kbd>${key}</kbd> `)}</span>
          </div>
        `,
      )}
    </article>
  `;
}

const MODES = [
  {
    mode: "Duelo local",
    param: "mode=local",
    detail: "P1 e P2 humanos no mesmo teclado.",
  },
  {
    mode: "Treino vs bot",
    param: "mode=training",
    detail: "P1 humano; P2 usa o perfil de bot escolhido.",
  },
  {
    mode: "Laboratório de IA",
    param: "mode=lab",
    detail: "Os dois slots usam perfis de IA e a partida corre até o fim.",
  },
];

const PARAMS = [
  { param: "p1=<slug>", detail: "Champion do slot 1 (ranni, killer-bee, crocodilo-arcano, thresh)." },
  { param: "p2=<slug>", detail: "Champion do slot 2." },
  { param: "bot=<perfil>", detail: "No treino: bomb, pingo, v1, v2 ou v3." },
  { param: "bot1= / bot2=", detail: "No laboratório: perfil de cada slot." },
  { param: "skipSelect=1", detail: "Inicia direto da URL, sem tela de seleção." },
  { param: "dev=1", detail: "Liga os diagnósticos." },
];

const BOTS = [
  { name: "bomb", detail: "Pressão direta: planta cedo e disputa espaço no centro." },
  { name: "pingo", detail: "Jogo de recuo e punição; espera o erro de rota." },
  { name: "v1", detail: "Linha-base histórica — bom sparring para iniciantes." },
  { name: "v2", detail: "Avaliação de risco mais afiada em mapas densos." },
  { name: "v3", detail: "Perfil mais recente; agressivo e melhor na leitura de fuga." },
];

mount(
  "#app",
  html`
    ${ambient()} ${nav(DEFAULT_LINKS)}
    <main>
      <section class="page-head">
        <div class="shell section__head" data-reveal>
          <span class="eyebrow">Guia</span>
          <h1 class="title">Controles, modos e <em>tudo que cabe numa URL.</em></h1>
          <p class="lede">
            A referência curta para sentar e jogar — e para montar a partida exata que você quer
            compartilhar.
          </p>
        </div>
      </section>

      <section class="section" id="controles" style="padding-top:0">
        <div class="shell">
          <div class="keys">
            ${keyCard("Jogador 1", P1_KEYS, 0)} ${keyCard("Jogador 2", P2_KEYS, 1)}
            ${keyCard("Sistema", SYSTEM_KEYS, 2)}
          </div>
        </div>
      </section>

      <section class="section" id="modos">
        <div class="shell">
          <div class="section__head" data-reveal>
            <span class="eyebrow">Modos</span>
            <h2 class="title">Três formas de entrar <em>na mesma arena.</em></h2>
          </div>

          <div class="glass table__wrap" data-reveal>
            <table class="table">
              <thead>
                <tr>
                  <th>Modo</th>
                  <th>Parâmetro</th>
                  <th>Como funciona</th>
                </tr>
              </thead>
              <tbody>
                ${MODES.map(
                  (row) => html`
                    <tr>
                      <td style="color:var(--text-100)">${row.mode}</td>
                      <td><code>${row.param}</code></td>
                      <td>${row.detail}</td>
                    </tr>
                  `,
                )}
              </tbody>
            </table>
          </div>

          <div class="glass table__wrap" style="margin-top:1.15rem" data-reveal>
            <table class="table">
              <thead>
                <tr>
                  <th>Parâmetro</th>
                  <th>Efeito</th>
                </tr>
              </thead>
              <tbody>
                ${PARAMS.map(
                  (row) => html`
                    <tr>
                      <td><code>${row.param}</code></td>
                      <td>${row.detail}</td>
                    </tr>
                  `,
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="section" id="bots">
        <div class="shell">
          <div class="section__head" data-reveal>
            <span class="eyebrow">Perfis de IA</span>
            <h2 class="title">Cinco adversários com <em>vícios diferentes.</em></h2>
            <p class="lede">
              Todos recebem apenas um snapshot congelado do estado e devolvem os mesmos comandos que
              um humano — nenhum enxerga além do tabuleiro.
            </p>
          </div>

          <div class="glass table__wrap" data-reveal>
            <table class="table">
              <thead>
                <tr>
                  <th>Perfil</th>
                  <th>Estilo</th>
                </tr>
              </thead>
              <tbody>
                ${BOTS.map(
                  (row) => html`
                    <tr>
                      <td><code>${row.name}</code></td>
                      <td>${row.detail}</td>
                    </tr>
                  `,
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="shell" data-reveal>
          <div class="glass glass--strong cta">
            <h2 class="cta__title">Teoria só vale <em>depois do round.</em></h2>
            <p class="cta__lede">Abra a arena e teste o que acabou de ler.</p>
            <div class="cta__actions">
              <a class="btn btn--primary" data-magnetic href="${SITE.trainingUrl}"
                >Treinar contra um bot <span class="btn__arrow">→</span></a
              >
              <a class="btn btn--ghost" data-magnetic href="/champions.html">Ver Champions</a>
            </div>
          </div>
        </div>
      </section>
    </main>
    ${footer()}
  `,
);

initAll();
