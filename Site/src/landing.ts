import "./styles/base.css";
import "./styles/glass.css";
import "./styles/sections.css";

import { html, mount } from "./ui/html.ts";
import { initAll } from "./ui/interactions.ts";
import { initArenaPreview } from "./components/arena-preview.ts";
import { DEFAULT_LINKS, ambient, footer, nav } from "./components/shell.ts";
import {
  benefits,
  faq,
  featureGrid,
  finalCta,
  hero,
  howItWorks,
  logoCloud,
  pricing,
  roster,
  testimonials,
} from "./components/sections.ts";

mount(
  "#app",
  html`
    ${ambient()} ${nav(DEFAULT_LINKS)}
    <main>
      ${hero()} ${logoCloud()} ${benefits()} ${featureGrid()} ${roster()} ${howItWorks()}
      ${testimonials()} ${pricing()} ${faq()} ${finalCta()}
    </main>
    ${footer()}
  `,
);

initAll();
initArenaPreview();
