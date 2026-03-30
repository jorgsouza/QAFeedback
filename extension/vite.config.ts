import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const extRoot = __dirname;

function jiraBoardAllowlistFromEnv(mode: string): string {
  const envExt = loadEnv(mode, extRoot, "");
  const envRepo = loadEnv(mode, resolve(extRoot, ".."), "");
  return (
    envExt.VITE_JIRA_BOARD_ALLOWLIST ||
    envRepo.VITE_JIRA_BOARD_ALLOWLIST ||
    envExt.BOARD_ID ||
    envRepo.BOARD_ID ||
    ""
  ).trim();
}

export default defineConfig(({ mode }) => {
  const allowlistRaw = jiraBoardAllowlistFromEnv(mode);
  const defineConstants = {
    __QAF_JIRA_BOARD_ALLOWLIST__: JSON.stringify(allowlistRaw),
    "process.env.NODE_ENV": JSON.stringify("production"),
  };

  const isContent = process.env.BUILD_TARGET === "content";

  return {
    base: "./",
    /** Content script: sem `process` no runtime; allowlist igual ao background. */
    define: defineConstants,
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
              offscreen: resolve(__dirname, "offscreen.html"),
            },
            output: {
              entryFileNames: (chunk) =>
                chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js",
              chunkFileNames: "assets/[name]-[hash].js",
              assetFileNames: "assets/[name]-[hash][extname]",
            },
          },
        },
  };
});
