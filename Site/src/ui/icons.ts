import { html, raw, type RawHtml } from "./html.ts";

const STROKE = `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"`;

function svg(body: string): RawHtml {
  return raw(`<svg viewBox="0 0 24 24" aria-hidden="true" ${STROKE}>${body}</svg>`);
}

export const ICONS: Record<string, RawHtml> = {
  bolt: svg(`<path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12z" />`),
  grid: svg(
    `<rect x="3" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />`,
  ),
  spark: svg(
    `<path d="M12 3v4M12 17v4M4.6 12h4M15.4 12h4M6.8 6.8l2.8 2.8M14.4 14.4l2.8 2.8M17.2 6.8l-2.8 2.8M9.6 14.4l-2.8 2.8" /><circle cx="12" cy="12" r="2.4" />`,
  ),
  check: svg(`<path d="m4.5 12.5 5 5 10-11" />`),
  arrow: svg(`<path d="M5 12h14M13 6l6 6-6 6" />`),
  bomb: svg(
    `<circle cx="10.5" cy="14.5" r="6.2" /><path d="m15.6 9.4 2.3-2.3M18.6 4.2l1.2 1.2M20.8 6.4 22 7.6" />`,
  ),
  menu: svg(`<path d="M4 7h16M4 12h16M4 17h16" />`),
};

export function icon(name: keyof typeof ICONS | string): RawHtml {
  return ICONS[name] ?? html``;
}
