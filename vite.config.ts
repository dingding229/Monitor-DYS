import { readFileSync } from "node:fs"
import { countries } from "country-flag-icons"
import { defineConfig } from "vitest/config"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import tailwindcss from "@tailwindcss/vite"

// Cards need only the original path, not the Simple Icons object or SVG wrapper.
const osIconPath = /[\\/]simple-icons[\\/]icons[\\/][a-z0-9-]+\.svg\?icon-path$/

// The Hub uses all of theme.json; the browser only needs validation metadata.
const root = import.meta.dirname.replaceAll("\\", "/")
const themeFile = `${root}/theme.json`
const formatFile = `${root}/src/lib/format`
const uplotModule = /[\\/]uplot[\\/]dist[\\/]uPlot\.esm\.js$/
// ChartCard uses the constructor, not uPlot's public static helpers. Only
// remove known upstream statements so new code in a dependency update is kept.
const unusedPlotHelpers = /^[ \t]*(?:uPlot\.(?:assign|fmtNum|rangeNum|rangeLog|rangeAsinh|orient|join|fmtDate|tzDate|sync|addGap|clipGaps)\s*=\s*\w+;|\(paths\.(?:linear|stepped|bars|spline)\s*=\s*\w+\);)$/gm
// The theme only constructs aligned time-series charts. Specialize this local
// mode binding (not other `mode` options) so Rolldown discards the XY facets.
const plotMode = /(function uPlot\(opts, data, then\) \{\s+const self = \{\s+)(mode: ifNull\(opts\.mode, 1\),)(\s+\};\s+const mode = )(self\.mode;)/
const plotPathTable = /^[ \t]*let paths = uPlot\.paths = \{\r?\n[ \t]+points,\r?\n[ \t]*\};$/m

export default defineConfig({
  plugins: [svelte(), tailwindcss(), {
    name: "dys-browser-config-schema",
    apply: "build",
    enforce: "pre",
    load(id) {
      if (id !== themeFile) return
      this.addWatchFile(id)
      const { short, config } = JSON.parse(readFileSync(id, "utf8")) as typeof import("./theme.json")
      return JSON.stringify({ short, config: config.flatMap(field => {
        if (!("key" in field) || field.key === "theme") return []
        const { type, key, default: value, min, max, options } = field
        return [{ type, key, default: value, min, max, options: options?.map(({ value }) => value) }]
      }) })
    },
  }, {
    // The existing Svelte pages share a format facade. Give eager/other routes
    // just the common exports, without rewriting Svelte sources or importing
    // the detail formatters through the entry-side facade.
    name: "dys-split-format-facade",
    apply: "build",
    enforce: "pre",
    resolveId(source, importer) {
      if ((source === "@/lib/format" || source === formatFile) && !importer?.endsWith("/pages/NodeDetail.svelte")) {
        return `${formatFile}-common.ts`
      }
    },
  }, {
    name: "dys-line-charts-only",
    apply: "build",
    enforce: "pre",
    transform(source, id) {
      if (!uplotModule.test(id)) return
      // Keep line and column offsets for upstream sourcemaps.
      const bare = (statement: string) => statement.replace(/[^\r\n]/g, " ")
      const code = plotPathTable.test(source) ? source.replace(plotPathTable, bare).replace(unusedPlotHelpers, bare) : source
      return { code: code.replace(plotMode, (_, start, option, middle, binding) =>
        `${start}${"mode: 1,".padEnd(option.length)}${middle}${"1;".padEnd(binding.length)}`), map: null }
    },
  }, {
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
      "@": `${root}/src`,
    },
  },
  build: {
    target: "es2022",
    modulePreload: { polyfill: false },
    // Share one preloaded set of OS paths across cards, rows and details.
    rolldownOptions: { output: {
      // Keep lexical top-level declarations: this compresses better with Oxc.
      topLevelVar: false,
      codeSplitting: { groups: [{ name: "os-icons", test: osIconPath }] },
    } },
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
