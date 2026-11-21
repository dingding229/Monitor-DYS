import { existsSync } from "node:fs"
import { defineConfig, devices } from "@playwright/test"
import { mockPorts } from "./tests/fixtures/mock-origins"

if (!existsSync(new URL("./dist/index.html", import.meta.url))) {
  throw new Error("Run npm run build before npm run test:e2e (dist/index.html is missing).")
}

export default defineConfig({
  testDir: "./tests/e2e",
  captureGitInfo: { commit: false, diff: false },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  reporter: "list",
  use: { colorScheme: "light", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: Object.entries(mockPorts).map(([scenario, port]) => ({
    name: `mock-${scenario}`,
    command: `node tests/mock-hub/server.mjs --port ${port} --scenario ${scenario} --dist dist`,
    // The static shell stays readable even for scenarios whose API intentionally fails.
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: false,
  })),
})
