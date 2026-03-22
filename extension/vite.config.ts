import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const isContent = process.env.BUILD_TARGET === "content";

export default defineConfig({
  base: "./",
  /** Content script roda na página: não existe `process` (evita React em modo dev no bundle). */
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  plugins: [react()],
  publicDir: isContent ? false : "public",
  build: isContent
    ? {
        emptyOutDir: false,
        lib: {
          entry: resolve(__dirname, "src/content/content.tsx"),
          name: "QAFeedbackContent",
          formats: ["iife"],
          fileName: () => "content.js",
        },
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
          },
        },
      }
    : {
        rollupOptions: {
          input: {
            background: resolve(__dirname, "src/background/service-worker.ts"),
            options: resolve(__dirname, "options.html"),
          },
          output: {
            entryFileNames: (chunk) =>
              chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js",
            chunkFileNames: "assets/[name]-[hash].js",
            assetFileNames: "assets/[name]-[hash][extname]",
          },
        },
      },
});
