import { existsSync } from "node:fs"
import { defineConfig, devices } from "@playwright/test"
import { mockPorts } from "./tests/fixtures/mock-origins"

if (!existsSync(new URL("./dist/index.html", import.meta.url))) {
  throw new Error("Run npm run build before npm run e2e (dist/index.html is missing).")
}

const scenarios = ["normal", "ws503", "admin", "config", "noping", "many"] as const

export default defineConfig({
  testDir: "./tests/e2e",
  captureGitInfo: { commit: false, diff: false },
  // Keep the performance test from competing with other browser tests for the CPU.
  fullyParallel: false,
  retries: 0,
  timeout: 12_000,
  reporter: "list",
  use: { trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: scenarios.map((scenario) => ({
    name: `mock-${scenario}`,
    command: `node tests/mock-hub/server.mjs --port ${mockPorts[scenario]} --scenario ${scenario} --dist dist`,
    url: `http://127.0.0.1:${mockPorts[scenario]}/`,
    reuseExistingServer: false,
  })),
})
