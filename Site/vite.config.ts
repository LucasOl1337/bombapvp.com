import { defineConfig } from "vite";
import { resolve } from "node:path";

// O site institucional e um build separado do runtime do jogo. Nada aqui entra
// no bundle de `GameMechanics/`; a unica ponte e um link para a arena.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    assetsDir: "_site",
    rollupOptions: {
      input: {
        landing: resolve(import.meta.dirname, "index.html"),
        champions: resolve(import.meta.dirname, "champions.html"),
        guia: resolve(import.meta.dirname, "guia.html"),
      },
    },
  },
  server: {
    port: 4321,
    open: false,
  },
});
