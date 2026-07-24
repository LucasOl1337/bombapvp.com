/** Comportamentos de superficie: reveal, botao magnetico, nav e FAQ. */

const REDUCED = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function initReveal(): void {
  const targets = [...document.querySelectorAll<HTMLElement>("[data-reveal]")];
  if (REDUCED() || !("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.1 },
  );

  targets.forEach((el) => observer.observe(el));
}

export function initMagnetic(): void {
  if (REDUCED() || window.matchMedia("(hover: none)").matches) return;

  document.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((el) => {
    const strength = 0.28;

    el.addEventListener("pointermove", (event) => {
      const rect = el.getBoundingClientRect();
      const dx = (event.clientX - (rect.left + rect.width / 2)) * strength;
      const dy = (event.clientY - (rect.top + rect.height / 2)) * strength;
      el.style.setProperty("--mx", `${dx.toFixed(2)}px`);
      el.style.setProperty("--my", `${dy.toFixed(2)}px`);
    });

    const reset = () => {
      el.style.setProperty("--mx", "0px");
      el.style.setProperty("--my", "0px");
    };
    el.addEventListener("pointerleave", reset);
    el.addEventListener("blur", reset);
  });
}

export function initNav(): void {
  const header = document.querySelector<HTMLElement>("[data-nav]");
  const toggle = document.querySelector<HTMLButtonElement>("[data-nav-toggle]");
  const links = document.querySelector<HTMLElement>("[data-nav-links]");
  if (!header) return;

  const onScroll = () => header.classList.toggle("is-stuck", window.scrollY > 12);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  toggle?.addEventListener("click", () => {
    const open = links?.classList.toggle("is-open") ?? false;
    toggle.setAttribute("aria-expanded", String(open));
  });

  links?.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).tagName !== "A") return;
    links.classList.remove("is-open");
    toggle?.setAttribute("aria-expanded", "false");
  });
}

export function initFaq(): void {
  document.querySelectorAll<HTMLElement>("[data-faq]").forEach((item) => {
    const button = item.querySelector<HTMLButtonElement>("[data-faq-toggle]");
    const panel = item.querySelector<HTMLElement>("[data-faq-panel]");
    if (!button || !panel) return;

    button.addEventListener("click", () => {
      const open = item.classList.toggle("is-open");
      button.setAttribute("aria-expanded", String(open));
      // Anima a altura real: 0 -> scrollHeight, sem max-height chutado.
      panel.style.height = open ? `${panel.scrollHeight}px` : "0px";
    });
  });
}

export function initAll(): void {
  initNav();
  initReveal();
  initMagnetic();
  initFaq();
}
