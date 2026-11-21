import { defineConfig } from "vitest/config"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  resolve: {
    alias: {
      "@": import.meta.dirname + "/src",
    },
  },
  build: {
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
