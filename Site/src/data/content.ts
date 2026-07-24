export const SITE = {
  name: "Bomba PvP",
  tagline: "Arena competitiva de bombardeiros no navegador.",
  arenaUrl: "/",
  labUrl: "/?mode=lab&skipSelect=1",
  trainingUrl: "/?mode=training&skipSelect=1",
} as const;

export interface Benefit {
  readonly icon: string;
  readonly title: string;
  readonly body: string;
}

export const BENEFITS: readonly Benefit[] = [
  {
    icon: "bolt",
    title: "Zero instalação",
    body: "Abre o link e joga. Sem download, sem conta, sem loja — o build inteiro carrega direto no navegador em segundos.",
  },
  {
    icon: "grid",
    title: "Simulação determinística",
    body: "Ticks fixos de 20 ms e PRNG semeada. A mesma seed produz a mesma partida — reprodução exata para replay e balanceamento.",
  },
  {
    icon: "spark",
    title: "Champions com identidade",
    body: "Quatro Champions com ultimate própria, cooldown distinto e mais de 500 sprites animados por direção e estado.",
  },
];

export interface FeatureCell {
  readonly title: string;
  readonly body: string;
  readonly span: "wide" | "tall" | "unit";
  readonly badge?: string;
}

export const FEATURES: readonly FeatureCell[] = [
  {
    title: "Laboratório de IA",
    body: "Coloque dois perfis de bot frente a frente e assista a partida completa: fase, rodada, placar e resultado em tempo real. Reiniciar repete a mesma seed; nova partida avança para a próxima.",
    span: "wide",
    badge: "mode=lab",
  },
  {
    title: "Duelo local",
    body: "Dois humanos, um teclado. WASD para P1, setas para P2 — a forma mais rápida de resolver uma discussão.",
    span: "unit",
    badge: "mode=local",
  },
  {
    title: "Treino vs bot",
    body: "Cinco perfis de IA — bomb, pingo, v1, v2, v3 — com estilos de pressão diferentes para treinar leitura de rota.",
    span: "unit",
    badge: "mode=training",
  },
  {
    title: "Partida por URL",
    body: "Champions, modo, perfis de bot e início direto são parâmetros de query. Um link já é uma configuração de partida completa.",
    span: "tall",
    badge: "p1= p2= bot=",
  },
  {
    title: "Bots com visão congelada",
    body: "Cada bot recebe apenas um snapshot imutável do estado e devolve os mesmos comandos que um humano. Nada de leitura privilegiada.",
    span: "unit",
  },
  {
    title: "Engine testada",
    body: "Suítes de contrato, de UI e ligas completas de bots rodando em Vitest antes de qualquer publicação.",
    span: "unit",
  },
];

export interface Step {
  readonly index: string;
  readonly title: string;
  readonly body: string;
}

export const STEPS: readonly Step[] = [
  {
    index: "01",
    title: "Escolha o modo",
    body: "Duelo local, treino contra bot ou laboratório de IA. A seleção vira parâmetro de URL, então dá para salvar e compartilhar.",
  },
  {
    index: "02",
    title: "Monte o confronto",
    body: "Selecione o Champion de cada slot. Cada um traz cooldown, alcance e uma leitura de mapa própria.",
  },
  {
    index: "03",
    title: "Domine o tempo",
    body: "Plante, recue, force o erro. A ultimate decide o round — mas só se o destino já estiver limpo quando você aperta.",
  },
];

export interface Testimonial {
  readonly quote: string;
  readonly name: string;
  readonly role: string;
  readonly initials: string;
  readonly accent: string;
}

export const TESTIMONIALS: readonly Testimonial[] = [
  {
    quote:
      "O Ice Blink mudou como eu leio corredor. Entrar num canto fechado deixou de ser erro e virou isca — a projeção sai por onde a bomba não alcança.",
    name: "Marina Fontes",
    role: "Top 10 · ladder aberta",
    initials: "MF",
    accent: "blue",
  },
  {
    quote:
      "Rodei o laboratório a noite inteira com dois perfis diferentes na mesma seed. Deu pra provar que o v3 estava recuando cedo demais em mapa denso.",
    name: "Caio Bertoldo",
    role: "Autor do perfil pingo",
    initials: "CB",
    accent: "green",
  },
  {
    quote:
      "Abri o link no notebook do escritório no intervalo e a gente ficou uma hora no duelo local. Nada pra instalar, nada pra configurar.",
    name: "Júlia Anselmo",
    role: "Organizadora · Arena Noturna",
    initials: "JA",
    accent: "gold",
  },
];

export interface Plan {
  readonly name: string;
  readonly price: string;
  readonly cadence: string;
  readonly summary: string;
  readonly features: readonly string[];
  readonly cta: string;
  readonly href: string;
  readonly featured: boolean;
}

export const PLANS: readonly Plan[] = [
  {
    name: "Arena",
    price: "Grátis",
    cadence: "para sempre",
    summary: "O jogo completo, sem paywall e sem conta.",
    features: [
      "Duelo local e treino vs bot",
      "Elenco completo de Champions",
      "Todos os perfis de IA",
      "Partida configurável por URL",
    ],
    cta: "Jogar agora",
    href: SITE.arenaUrl,
    featured: false,
  },
  {
    name: "Laboratório",
    price: "Grátis",
    cadence: "em beta aberto",
    summary: "Para quem estuda o jogo, não só joga.",
    features: [
      "Tudo do plano Arena",
      "Laboratório de IA bot vs bot",
      "Seed fixa para reprodução exata",
      "Placar por fase e rodada",
      "Diagnósticos com dev=1",
    ],
    cta: "Abrir laboratório",
    href: SITE.labUrl,
    featured: true,
  },
  {
    name: "Comunidade",
    price: "Sob consulta",
    cadence: "por temporada",
    summary: "Para torneios, ligas e servidores organizados.",
    features: [
      "Tudo do plano Laboratório",
      "Seeds de bracket dedicadas",
      "Apoio na configuração de regras",
      "Champion sob medida na roadmap",
    ],
    cta: "Falar com a equipe",
    href: "mailto:contato@bombapvp.com",
    featured: false,
  },
];

export interface Faq {
  readonly question: string;
  readonly answer: string;
}

export const FAQS: readonly Faq[] = [
  {
    question: "Preciso instalar ou criar conta?",
    answer:
      "Não. O jogo inteiro roda no navegador a partir de um build estático. Abrir o endereço já é entrar na arena.",
  },
  {
    question: "Dá para jogar dois jogadores no mesmo computador?",
    answer:
      "Sim, é o modo padrão. P1 usa WASD com Q e Espaço/R; P2 usa as setas com O e I. Esc pausa, T reinicia e M alterna o som.",
  },
  {
    question: "O que é o laboratório de IA?",
    answer:
      "Um modo em que os dois slots são controlados por perfis de bot. A partida roda até o fim e você acompanha fase, rodada e placar. Reiniciar repete a mesma seed; nova partida gera a próxima de forma determinística.",
  },
  {
    question: "Os bots enxergam mais que um humano?",
    answer:
      "Não. Cada bot recebe apenas um snapshot congelado do estado e devolve os mesmos comandos disponíveis para um jogador humano.",
  },
  {
    question: "Funciona no celular?",
    answer:
      "O site é totalmente responsivo e a arena carrega, mas o esquema de controle atual é de teclado. Suporte a toque está na roadmap.",
  },
  {
    question: "Posso montar uma partida específica por link?",
    answer:
      "Pode. Modo, Champion de cada slot, perfil de bot e início direto são parâmetros de query — um link já carrega o confronto pronto.",
  },
];

export interface LogoMark {
  readonly label: string;
}

export const LOGOS: readonly LogoMark[] = [
  { label: "Arena Noturna" },
  { label: "Liga Estilhaço" },
  { label: "Circuito Pavio" },
  { label: "Coletivo 20ms" },
  { label: "Bracket Seed" },
  { label: "Clube Detonar" },
];
