/**
 * NOVA PRIME — design tokens da reformulação visual da arena.
 *
 * Sistema procedural premium-minimalista: valores chapados, geometria fina
 * (hairlines), glow contido e uma única família quente reservada a
 * destrutíveis e perigo. Tudo aqui é puro (sem estado de jogo) para ser
 * reutilizado pelos métodos de render do GameApp.
 */

export const NOVA = {
  /** Texto principal sobre vidro/escuro. */
  ink: "#eaf2fb",
  /** Texto secundário. */
  inkMuted: "#93a6c2",
  /** Texto terciário / micro-labels. */
  inkFaint: "#5c6f8c",
  /** Ciano estrutural (spawn, portais, rim-lights, acentos de UI). */
  accent: "#67e8f9",
  accentSoft: "rgba(103, 232, 249, 0.55)",
  accentGhost: "rgba(103, 232, 249, 0.16)",
  /** Família quente — SOMENTE destrutíveis, avisos e ult pronta. */
  warm: "#ffb46a",
  warmSoft: "rgba(255, 180, 106, 0.55)",
  /** Perigo iminente (chamas, sudden death, fuse crítico). */
  danger: "#ff6a4d",
  dangerSoft: "rgba(255, 106, 77, 0.5)",
  /** Sucesso / vivo. */
  alive: "#7dffa8",
  /** Vidro do HUD. */
  glassBg: "rgba(9, 14, 23, 0.58)",
  glassBgStrong: "rgba(7, 11, 18, 0.8)",
  glassEdge: "rgba(160, 210, 255, 0.12)",
  glassEdgeSoft: "rgba(160, 210, 255, 0.06)",
  glassSheen: "rgba(200, 235, 255, 0.05)",
  /** Scrim de overlays (resultado, pause, seleção). */
  scrim: "rgba(3, 6, 11, 0.72)",
  fontDisplay: '"Space Grotesk", Inter, ui-sans-serif, system-ui, sans-serif',
  fontBody: 'Inter, ui-sans-serif, system-ui, sans-serif',
} as const;

/** Caminho de retângulo com cantos arredondados (raio limitado à metade do lado). */
export function roundedRectPath(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + width - r, y);
  c.arcTo(x + width, y, x + width, y + r, r);
  c.lineTo(x + width, y + height - r);
  c.arcTo(x + width, y + height, x + width - r, y + height, r);
  c.lineTo(x + r, y + height);
  c.arcTo(x, y + height, x, y + height - r, r);
  c.lineTo(x, y + r);
  c.arcTo(x, y, x + r, y, r);
  c.closePath();
}

/**
 * Painel de vidro do novo HUD: fundo translúcido escuro, hairline luminosa
 * e um sheen superior sutil. Substitui os painéis 9-slice PNG.
 */
export function drawGlassPanel(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 10,
  options: { strong?: boolean; edge?: string } = {},
): void {
  roundedRectPath(c, x, y, width, height, radius);
  c.fillStyle = options.strong ? NOVA.glassBgStrong : NOVA.glassBg;
  c.fill();
  // Sheen superior (luz vinda de cima).
  roundedRectPath(c, x + 1, y + 1, width - 2, Math.max(2, height * 0.45), Math.max(1, radius - 1));
  c.fillStyle = NOVA.glassSheen;
  c.fill();
  // Hairline.
  roundedRectPath(c, x + 0.5, y + 0.5, width - 1, height - 1, radius);
  c.strokeStyle = options.edge ?? NOVA.glassEdge;
  c.lineWidth = 1;
  c.stroke();
}

/**
 * Aplica letter-spacing quando o runtime suporta (Canvas 2D moderno).
 * Ignorado silenciosamente em runtimes sem a propriedade.
 */
export function setLetterSpacing(c: CanvasRenderingContext2D, value: string): void {
  const target = c as CanvasRenderingContext2D & { letterSpacing?: string };
  if (typeof target.letterSpacing === "string" || "letterSpacing" in target) {
    target.letterSpacing = value;
  }
}

/** Hash determinístico e barato por tile — variação de valor sem ruído aleatório. */
export function tileHash01(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
