import { defineConfig } from "vite";

export default defineConfig({
  build: {
    assetsDir: "_app",
    rollupOptions: {
      input: {
        main: "index.html",
        arena: "arena/index.html",
      },
    },
  },
});
