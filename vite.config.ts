import { defineConfig } from "vitest/config"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [svelte(), tailwindcss(), {
    name: "preload-world-map",
    transformIndexHtml: { order: "post", handler(_, ctx) {
      const chunk = Object.values(ctx.bundle ?? {}).find(item => item.type === "chunk" && item.facadeModuleId?.endsWith("/WorldMap.svelte"))
      const href = ctx.server ? "/src/components/WorldMap.svelte" : chunk ? `/${chunk.fileName}` : null
      return href ? [{ tag: "link", attrs: { rel: "modulepreload", crossorigin: "anonymous", href }, injectTo: "head" }] : []
    } },
  }],
  resolve: {
    alias: {
      "@": import.meta.dirname + "/src",
    },
  },
  build: {
    // Share one preloaded, tree-shaken set of OS paths across cards, rows and details.
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: "os-icons", test: /node_modules\/simple-icons\/index\.mjs$/ }] } } },
    chunkSizeWarningLimit: 500,
    assetsInlineLimit: (file) => (file.includes("/country-flag-icons/") ? false : undefined),
  },
  server: {
    proxy: {
      "/api": {
        target: process.env.MONITOR_HUB || "http://127.0.0.1:9911",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "jsdom",
  },
})
