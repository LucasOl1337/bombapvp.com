/**
 * Template tag minimo. Escapa interpolacoes por padrao; use `raw()` para
 * marcar HTML ja confiavel (saida de outro componente).
 */

const RAW = Symbol("raw-html");

export interface RawHtml {
  readonly [RAW]: true;
  readonly value: string;
}

export function raw(value: string): RawHtml {
  return { [RAW]: true, value };
}

function isRaw(value: unknown): value is RawHtml {
  return typeof value === "object" && value !== null && RAW in value;
}

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function render(value: unknown): string {
  if (value === null || value === undefined || value === false) return "";
  if (isRaw(value)) return value.value;
  if (Array.isArray(value)) return value.map(render).join("");
  return escape(String(value));
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): RawHtml {
  let out = "";
  strings.forEach((chunk, index) => {
    out += chunk;
    if (index < values.length) out += render(values[index]);
  });
  return raw(out);
}

/** Monta o markup dentro do container indicado. */
export function mount(selector: string, content: RawHtml): void {
  const host = document.querySelector(selector);
  if (!host) throw new Error(`Container ausente: ${selector}`);
  host.innerHTML = content.value;
}
