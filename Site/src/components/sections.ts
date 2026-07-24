import { html, type RawHtml } from "../ui/html.ts";
import { icon } from "../ui/icons.ts";
import { CHAMPIONS } from "../data/champions.ts";
import {
  BENEFITS,
  FAQS,
  FEATURES,
  LOGOS,
  PLANS,
  SITE,
  STEPS,
  TESTIMONIALS,
} from "../data/content.ts";
import { arenaPreview } from "./arena-preview.ts";

/** Atraso escalonado para o reveal em grade. */
function delay(index: number): RawHtml {
  return html`style="--reveal-delay:${index * 80}ms"`;
}

export function hero(): RawHtml {
  return html`
    <section class="hero">
      <div class="shell hero__inner">
        <div data-reveal>
          <span class="eyebrow">Arena PvP no navegador</span>
          <h1 class="hero__title">
            Plante, recue,
            <em>vença pelo tempo.</em>
          </h1>
          <p class="hero__lede">
            ${SITE.name} é um duelo tático de bombas em que cada Champion muda a leitura do mapa —
            aberto direto no navegador, sem instalar nada.
          </p>

          <div class="hero__actions">
            <a class="btn btn--primary" data-magnetic href="${SITE.arenaUrl}">
              Entrar na arena <span class="btn__arrow">→</span>
            </a>
            <a class="btn" data-magnetic href="${SITE.labUrl}">Ver laboratório de IA</a>
          </div>

          <div class="hero__stats">
            <div>
              <div class="stat__value">4</div>
              <div class="stat__label">Champions</div>
            </div>
            <div>
              <div class="stat__value">20&thinsp;ms</div>
              <div class="stat__label">Tick fixo</div>
            </div>
            <div>
              <div class="stat__value">5</div>
              <div class="stat__label">Perfis de IA</div>
            </div>
            <div>
              <div class="stat__value">570+</div>
              <div class="stat__label">Sprites animados</div>
            </div>
          </div>
        </div>

        <div data-reveal style="--reveal-delay:140ms">${arenaPreview()}</div>
      </div>
    </section>
  `;
}

export function logoCloud(): RawHtml {
  return html`
    <section class="logos">
      <div class="shell" data-reveal>
        <p class="logos__label">Comunidades que rodam a arena</p>
        <div class="logos__row">
          ${LOGOS.map((logo) => html`<span class="logos__item">${logo.label}</span>`)}
        </div>
      </div>
    </section>
  `;
}

export function benefits(): RawHtml {
  return html`
    <section class="section" id="beneficios">
      <div class="shell">
        <div class="section__head" data-reveal>
          <span class="eyebrow">Por que jogar aqui</span>
          <h2 class="title">Três coisas que <em>fazem diferença</em> na primeira partida.</h2>
        </div>

        <div class="benefits__grid">
          ${BENEFITS.map(
            (benefit, index) => html`
              <article class="glass benefit" data-reveal ${delay(index)}>
                <div class="benefit__icon">${icon(benefit.icon)}</div>
                <h3>${benefit.title}</h3>
                <p>${benefit.body}</p>
              </article>
            `,
          )}
        </div>
      </div>
    </section>
  `;
}

export function featureGrid(): RawHtml {
  return html`
    <section class="section" id="recursos">
      <div class="shell">
        <div class="section__head" data-reveal>
          <span class="eyebrow">Recursos</span>
          <h2 class="title">Um jogo simples de abrir, <em>fundo o bastante</em> para estudar.</h2>
          <p class="lede">
            Modos, bots e parâmetros de URL foram desenhados para que uma partida seja tão fácil de
            compartilhar quanto de reproduzir.
          </p>
        </div>

        <div class="bento">
          ${FEATURES.map(
            (cell, index) => html`
              <article class="glass bento__cell bento__cell--${cell.span}" data-reveal ${delay(index)}>
                <div>
                  <h3>${cell.title}</h3>
                  <p>${cell.body}</p>
                </div>
                ${cell.badge ? html`<span class="chip">${cell.badge}</span>` : ""}
              </article>
            `,
          )}
        </div>
      </div>
    </section>
  `;
}

export function roster(): RawHtml {
  return html`
    <section class="section" id="champions">
      <div class="shell">
        <div class="section__head" data-reveal>
          <span class="eyebrow">Elenco</span>
          <h2 class="title">Quatro Champions, <em>quatro formas</em> de ler o mapa.</h2>
        </div>

        <div class="roster">
          ${CHAMPIONS.map(
            (champion, index) => html`
              <article
                class="glass champion accent-${champion.accent}"
                data-reveal
                ${delay(index)}
              >
                <div class="champion__art">
                  <span class="champion__role">${champion.role}</span>
                  <img src="${champion.portrait}" alt="Retrato de ${champion.name}" loading="lazy" />
                </div>
                <div class="champion__body">
                  <h3 class="champion__name">${champion.name}</h3>
                  <div class="champion__skill">
                    <span>${champion.skillName}</span>
                    <span>${champion.cooldownMs / 1000}s CD</span>
                  </div>
                  <p class="champion__text">${champion.description}</p>
                </div>
              </article>
            `,
          )}
        </div>

        <div style="margin-top:2rem" data-reveal>
          <a class="btn" data-magnetic href="/champions.html">
            Ver detalhes do elenco <span class="btn__arrow">→</span>
          </a>
        </div>
      </div>
    </section>
  `;
}

export function howItWorks(): RawHtml {
  return html`
    <section class="section" id="como-funciona">
      <div class="shell">
        <div class="section__head" data-reveal>
          <span class="eyebrow">Como funciona</span>
          <h2 class="title">Da aba nova ao primeiro round <em>em menos de um minuto.</em></h2>
        </div>

        <div class="steps">
          ${STEPS.map(
            (step, index) => html`
              <article class="glass step" data-reveal ${delay(index)}>
                <div class="step__index">${step.index}</div>
                <h3>${step.title}</h3>
                <p>${step.body}</p>
              </article>
            `,
          )}
        </div>
      </div>
    </section>
  `;
}

export function testimonials(): RawHtml {
  return html`
    <section class="section" id="depoimentos">
      <div class="shell">
        <div class="section__head" data-reveal>
          <span class="eyebrow">Comunidade</span>
          <h2 class="title">Quem já <em>mora na arena.</em></h2>
        </div>

        <div class="testimonials">
          ${TESTIMONIALS.map(
            (item, index) => html`
              <article
                class="glass testimonial accent-${item.accent}"
                data-reveal
                ${delay(index)}
              >
                <blockquote>“${item.quote}”</blockquote>
                <div class="testimonial__author">
                  <span class="avatar">${item.initials}</span>
                  <span>
                    <span class="testimonial__name">${item.name}</span><br />
                    <span class="testimonial__role">${item.role}</span>
                  </span>
                </div>
              </article>
            `,
          )}
        </div>
      </div>
    </section>
  `;
}

export function pricing(): RawHtml {
  return html`
    <section class="section" id="precos">
      <div class="shell">
        <div class="section__head" data-reveal>
          <span class="eyebrow">Planos</span>
          <h2 class="title">O jogo é grátis. <em>O resto é escolha sua.</em></h2>
          <p class="lede">
            Nada de paywall no gameplay. Os planos existem para quem quer ferramenta de estudo ou
            estrutura de torneio.
          </p>
        </div>

        <div class="pricing">
          ${PLANS.map(
            (plan, index) => html`
              <article
                class="glass plan ${plan.featured ? "plan--featured" : ""}"
                data-reveal
                ${delay(index)}
              >
                ${plan.featured ? html`<span class="plan__badge">Popular</span>` : ""}
                <h3 class="plan__name">${plan.name}</h3>
                <div class="plan__price">
                  <strong>${plan.price}</strong><span>${plan.cadence}</span>
                </div>
                <p class="plan__summary">${plan.summary}</p>
                <ul class="plan__features">
                  ${plan.features.map(
                    (feature) => html`<li>${icon("check")}<span>${feature}</span></li>`,
                  )}
                </ul>
                <a
                  class="btn ${plan.featured ? "btn--primary" : ""}"
                  data-magnetic
                  href="${plan.href}"
                  >${plan.cta}</a
                >
              </article>
            `,
          )}
        </div>
      </div>
    </section>
  `;
}

export function faq(): RawHtml {
  return html`
    <section class="section" id="faq">
      <div class="shell">
        <div class="section__head" data-reveal>
          <span class="eyebrow">FAQ</span>
          <h2 class="title">Perguntas que <em>chegam sempre.</em></h2>
        </div>

        <div class="faq">
          ${FAQS.map(
            (item, index) => html`
              <div class="glass glass--flat faq__item" data-faq data-reveal ${delay(index)}>
                <button class="faq__q" type="button" data-faq-toggle aria-expanded="false">
                  <span>${item.question}</span>
                  <span class="faq__icon" aria-hidden="true"></span>
                </button>
                <div class="faq__a" data-faq-panel><p>${item.answer}</p></div>
              </div>
            `,
          )}
        </div>
      </div>
    </section>
  `;
}

export function finalCta(): RawHtml {
  return html`
    <section class="section">
      <div class="shell" data-reveal>
        <div class="glass glass--strong cta">
          <span class="eyebrow">Sem instalação, sem conta</span>
          <h2 class="cta__title">A próxima explosão <em>é sua.</em></h2>
          <p class="cta__lede">
            Abra a arena, escolha um Champion e resolva o duelo no tempo certo. O primeiro round
            começa em segundos.
          </p>
          <div class="cta__actions">
            <a class="btn btn--primary" data-magnetic href="${SITE.arenaUrl}">
              Jogar agora <span class="btn__arrow">→</span>
            </a>
            <a class="btn btn--ghost" data-magnetic href="/guia.html">Ler o guia</a>
          </div>
        </div>
      </div>
    </section>
  `;
}
