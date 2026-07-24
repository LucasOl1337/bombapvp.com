import { html, type RawHtml } from "../ui/html.ts";
import { icon } from "../ui/icons.ts";
import { SITE } from "../data/content.ts";

export function ambient(): RawHtml {
  return html`<div class="ambient" aria-hidden="true"><div class="ambient__grid"></div></div>`;
}

interface NavLink {
  readonly href: string;
  readonly label: string;
}

export function nav(links: readonly NavLink[]): RawHtml {
  return html`
    <header class="nav" data-nav>
      <div class="shell nav__inner">
        <a class="brand" href="/index.html" aria-label="${SITE.name} — início">
          <span class="brand__mark">${icon("bomb")}</span>
          <span>${SITE.name}</span>
        </a>

        <nav class="nav__links" data-nav-links aria-label="Navegação principal">
          ${links.map((link) => html`<a href="${link.href}">${link.label}</a>`)}
        </nav>

        <div class="nav__actions">
          <a class="btn btn--primary btn--sm nav__cta" data-magnetic href="${SITE.arenaUrl}">
            Jogar agora <span class="btn__arrow">→</span>
          </a>
          <button class="nav__toggle" data-nav-toggle aria-label="Abrir menu" aria-expanded="false">
            ${icon("menu")}
          </button>
        </div>
      </div>
    </header>
  `;
}

export const DEFAULT_LINKS: readonly NavLink[] = [
  { href: "/index.html#recursos", label: "Recursos" },
  { href: "/champions.html", label: "Champions" },
  { href: "/guia.html", label: "Guia" },
  { href: "/index.html#precos", label: "Preços" },
  { href: "/index.html#faq", label: "FAQ" },
];

export function footer(): RawHtml {
  const year = new Date().getFullYear();
  return html`
    <footer class="footer">
      <div class="shell">
        <div class="footer__grid">
          <div>
            <a class="brand" href="/index.html">
              <span class="brand__mark">${icon("bomb")}</span>
              <span>${SITE.name}</span>
            </a>
            <p class="footer__about">
              ${SITE.tagline} Build estático, simulação determinística e um elenco de Champions com
              identidade própria.
            </p>
          </div>

          <div class="footer__col">
            <h4>Jogo</h4>
            <ul>
              <li><a href="${SITE.arenaUrl}">Entrar na arena</a></li>
              <li><a href="${SITE.trainingUrl}">Treino vs bot</a></li>
              <li><a href="${SITE.labUrl}">Laboratório de IA</a></li>
              <li><a href="/champions.html">Champions</a></li>
            </ul>
          </div>

          <div class="footer__col">
            <h4>Aprender</h4>
            <ul>
              <li><a href="/guia.html">Guia de controles</a></li>
              <li><a href="/guia.html#modos">Modos e URL</a></li>
              <li><a href="/guia.html#bots">Perfis de bot</a></li>
              <li><a href="/index.html#faq">Perguntas frequentes</a></li>
            </ul>
          </div>

          <div class="footer__col">
            <h4>Contato</h4>
            <ul>
              <li><a href="mailto:contato@bombapvp.com">contato@bombapvp.com</a></li>
              <li><a href="https://bombapvp.com">bombapvp.com</a></li>
              <li><a href="https://bombpvp.com">bombpvp.com</a></li>
            </ul>
          </div>
        </div>

        <div class="footer__bottom">
          <span>© ${year} ${SITE.name}. Todos os direitos reservados.</span>
          <span class="muted">Feito com TypeScript e Vite.</span>
        </div>
      </div>
    </footer>
  `;
}
