import crocodiloPortrait from "../../public/champions/crocodilo-arcano.png?url";
import killerBeePortrait from "../../public/champions/killer-bee.png?url";
import ranniPortrait from "../../public/champions/ranni.png?url";
import threshPortrait from "../../public/champions/thresh.png?url";

export type ChampionAccent = "blue" | "gold" | "green" | "violet";

export interface Champion {
  readonly slug: string;
  readonly name: string;
  readonly role: string;
  readonly accent: ChampionAccent;
  readonly portrait: string;
  readonly description: string;
  readonly skillName: string;
  readonly skillSummary: string;
  readonly analysis: string;
  readonly cooldownMs: number;
  readonly frames: number;
}

// Espelha `Champions/<slug>/definition.ts` (locale pt-BR). Ao mudar o elenco,
// atualize os dois lados — este arquivo nao importa o runtime de proposito.
export const CHAMPIONS: readonly Champion[] = [
  {
    slug: "ranni",
    name: "Ranni",
    role: "Controle espacial",
    accent: "blue",
    portrait: ranniPortrait,
    description:
      "Feiticeira do gelo que joga com tempo e posição. Usa o mapa como arma: entra em cantos perigosos e sai quando o cerco fecha.",
    skillName: "Ice Blink",
    skillSummary:
      "O corpo congela na origem enquanto uma projeção espectral atravessa paredes, caixas e bombas. O teleporte só acontece com um segundo R ou ao fim da janela de 2,5 s.",
    analysis:
      "Use para escapar de cercos ou invadir uma rota protegida; ativar sem um destino seguro desperdiça a recarga.",
    cooldownMs: 8000,
    frames: 140,
  },
  {
    slug: "killer-bee",
    name: "Killer Bee",
    role: "Assalto móvel",
    accent: "gold",
    portrait: killerBeePortrait,
    description:
      "Caçadora de ritmo alto. Pressiona rotas, coleta melhorias e foge antes da retaliação: vence pela velocidade.",
    skillName: "Wing Dash",
    skillSummary:
      "Avança rapidamente na direção atual enquanto o caminho estiver livre, cruzando corredores e escapando de ameaças.",
    analysis:
      "Recompensa agressão precisa, mas uma rota bloqueada ou sem saída transforma o avanço em armadilha.",
    cooldownMs: 4000,
    frames: 154,
  },
  {
    slug: "crocodilo-arcano",
    name: "Crocodilo Arcano",
    role: "Controle de área",
    accent: "green",
    portrait: crocodiloPortrait,
    description:
      "Guardião tóxico da região central. Bloqueia rotas, força passos ruins e vence pela pressão espacial.",
    skillName: "Emerald Surge",
    skillSummary:
      "Canaliza uma onda que incendeia com toxina até duas casas em cada direção e concede imunidade durante a canalização.",
    analysis:
      "Forte em mapas densos e duelos de corredor; combine a onda com bombas para fechar as saídas.",
    cooldownMs: 6000,
    frames: 152,
  },
  {
    slug: "thresh",
    name: "Thresh",
    role: "Controle de gancho",
    accent: "violet",
    portrait: threshPortrait,
    description:
      "Carcereiro espectral. Pesca rivais com a corrente e arrasta para a zona de perigo das bombas.",
    skillName: "Sentença de Morte",
    skillSummary:
      "Arremessa o gancho em linha reta por até 4 tiles. O primeiro inimigo atingido é puxado até perto do Thresh; paredes bloqueiam o gancho.",
    analysis:
      "Mire na linha do rival que foge da bomba. Errou o gancho, metade do cooldown volta de graça.",
    cooldownMs: 8000,
    frames: 124,
  },
];

export function championBySlug(slug: string): Champion | undefined {
  return CHAMPIONS.find((champion) => champion.slug === slug);
}
