import "./styles/base.css";
import "./styles/glass.css";
import "./styles/sections.css";

import { html, mount } from "./ui/html.ts";
import { initAll } from "./ui/interactions.ts";
import { DEFAULT_LINKS, ambient, footer, nav } from "./components/shell.ts";
import { CHAMPIONS } from "./data/champions.ts";
import { SITE } from "./data/content.ts";

const cards = CHAMPIONS.map(
  (champion, index) => html`
    <article
      class="glass detail__card accent-${champion.accent}"
      data-reveal
      style="--reveal-delay:${index * 90}ms"
    >
      <div class="detail__art">
        <img src="${champion.portrait}" alt="Retrato de ${champion.name}" loading="lazy" />
      </div>
      <div class="detail__body">
        <span class="eyebrow">${champion.role}</span>
        <h2 class="title" style="font-size:1.75rem">${champion.name}</h2>
        <p class="champion__text">${champion.description}</p>

        <h3 style="font-size:1.02rem;margin-top:0.4rem">
          Ultimate — <em style="font-family:'Instrument Serif',serif;font-style:italic"
            >${champion.skillName}</em
          >
        </h3>
        <p class="champion__text">${champion.skillSummary}</p>
        <p class="champion__text muted">${champion.analysis}</p>

        <div class="detail__meta">
          <span class="chip">cooldown ${champion.cooldownMs / 1000}s</span>
          <span class="chip">${champion.frames} sprites</span>
          <span class="chip">p1=${champion.slug}</span>
        </div>

        <div style="margin-top:0.9rem">
          <a class="btn btn--sm" data-magnetic href="${SITE.arenaUrl}?p1=${champion.slug}&skipSelect=1">
            Jogar com ${champion.name} <span class="btn__arrow">→</span>
          </a>
        </div>
      </div>
    </article>
  `,
);

mount(
  "#app",
  html`
    ${ambient()} ${nav(DEFAULT_LINKS)}
    <main>
      <section class="page-head">
        <div class="shell section__head" data-reveal>
          <span class="eyebrow">Elenco completo</span>
          <h1 class="title">Cada Champion resolve o round <em>de um jeito diferente.</em></h1>
          <p class="lede">
            Cooldown, alcance e leitura de mapa mudam por completo entre eles. Escolha o que combina
            com o seu ritmo — ou aprenda os quatro para ler o do adversário.
          </p>
        </div>
      </section>

      <section class="section" style="padding-top:0">
        <div class="shell">
          <div class="detail">${cards}</div>
        </div>
      </section>

      <section class="section">
        <div class="shell" data-reveal>
          <div class="glass glass--strong cta">
            <h2 class="cta__title">Escolha um lado <em>e entre.</em></h2>
            <p class="cta__lede">A seleção também dá para fixar direto na URL da partida.</p>
            <div class="cta__actions">
              <a class="btn btn--primary" data-magnetic href="${SITE.arenaUrl}"
                >Entrar na arena <span class="btn__arrow">→</span></a
              >
              <a class="btn btn--ghost" data-magnetic href="/guia.html">Ver o guia</a>
            </div>
          </div>
        </div>
      </section>
    </main>
    ${footer()}
  `,
);

initAll();
