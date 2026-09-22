import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  devToolbar: { enabled: false },
  build: {
    inlineStylesheets: "auto",
  },
  vite: {
    build: {
      target: "es2022",
    },
  },
});
