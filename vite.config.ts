import { readFileSync } from "node:fs"
import { countries } from "country-flag-icons"
import { defineConfig } from "vitest/config"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import tailwindcss from "@tailwindcss/vite"

// Cards need only the original path, not the Simple Icons object or SVG wrapper.
const osIconPath = /[\\/]simple-icons[\\/]icons[\\/][a-z0-9-]+\.svg\?icon-path$/

export default defineConfig({
  plugins: [svelte(), tailwindcss(), {
    name: "simple-os-icon-paths",
    enforce: "pre",
    load(id) {
      if (!osIconPath.test(id)) return
      const file = id.slice(0, id.indexOf("?"))
      this.addWatchFile(file)
      const path = /<path d="([^"]+)"\s*\/>/.exec(readFileSync(file, "utf8"))?.[1]
      if (!path) return this.error(`Missing SVG path in ${file}`)
      return `export default ${JSON.stringify(path)}`
    },
  }, {
    name: "local-country-flags",
    apply: "build",
    generateBundle() {
      for (const code of countries) this.emitFile({type:"asset", fileName:`assets/flags/${code}.svg`, source:readFileSync(new URL(`./node_modules/country-flag-icons/3x2/${code}.svg`, import.meta.url))})
    },
  }, {
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
    // Share one preloaded set of OS paths across cards, rows and details.
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: "os-icons", test: osIconPath }] } } },
    chunkSizeWarningLimit: 500,
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
