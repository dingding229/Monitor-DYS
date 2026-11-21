// @vitest-environment node
import { spawnSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, expect, it } from "vitest"
import { inspectBuild } from "../../scripts/check-size.mjs"

const executable = fileURLToPath(new URL("../../scripts/check-size.mjs", import.meta.url))
const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })

function build(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "dys-size-"))
  dirs.push(root)
  for (const [file, source] of Object.entries(files)) {
    const path = join(root, file)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, source)
  }
  return root
}

const run = (dir: string) => spawnSync(process.execPath, [executable, dir], { encoding: "utf8" })
const entry = `<script type="module" src="/assets/app.js"></script>`
const js = "export const value = 42;"
const large = (bytes: number) => `export const pad = '${randomBytes(bytes).toString("base64")}';`

it("uses manifest source names for opaque outputs and counts shared/preloaded JS only once", () => {
  const root = build({
    "index.html": entry + `<link href='./assets/shared.js' rel='modulepreload'>`,
    "assets/app.js": js, "assets/shared.js": js, "assets/m.js": js, "assets/d.js": js, "assets/sub.js": js,
    ".vite/manifest.json": JSON.stringify({
      "index.html": { file: "assets/app.js", isEntry: true, imports: ["shared"], dynamicImports: ["src/WorldMap.svelte", "src/NodeDetail.svelte"] },
      shared: { file: "assets/shared.js" },
      "src/WorldMap.svelte": { file: "assets/m.js", imports: ["shared"] },
      "src/NodeDetail.svelte": { file: "assets/d.js", imports: ["shared", "detail-dependency"] },
      "detail-dependency": { file: "assets/sub.js" },
    }),
  })
  expect(inspectBuild(root)).toMatchObject({
    manifest: ".vite/manifest.json", entryFiles: ["assets/app.js"],
    initialFiles: ["assets/app.js", "assets/m.js", "assets/shared.js"], detailFiles: ["assets/d.js", "assets/sub.js"],
    missing: [], eagerDetail: [],
  })
  const result = run(root)
  expect(result.status).toBe(0)
  expect(result.stdout).toContain("gzip bytes")
})

it("falls back to chunk filenames and follows static imports but not unrelated dynamic routes", () => {
  const root = build({
    "index.html": entry,
    "assets/app.js": `import './shared.js'; import('./NodeDetail-d.js'); import('./settings.js');`,
    "assets/shared.js": js, "assets/map-data-m.js": js, "assets/settings.js": js,
    "assets/NodeDetail-d.js": `export { value } from './uPlot-q.js'; import './shared.js';`,
    "assets/uPlot-q.js": js,
  })
  expect(inspectBuild(root)).toMatchObject({
    manifest: null, initialFiles: ["assets/app.js", "assets/map-data-m.js", "assets/shared.js"],
    detailFiles: ["assets/NodeDetail-d.js", "assets/uPlot-q.js"], eagerDetail: [],
  })
})

it.each([
  ["entry", 64000, 0, 0], ["initial", 47000, 47000, 0], ["detail", 0, 0, 45000],
])("fails for an over-budget %s and prints the budget table", (_, app, map, detail) => {
  const result = run(build({
    "index.html": entry, "assets/app.js": app ? large(app) : js,
    "assets/map-m.js": map ? large(map) : js, "assets/NodeDetail-d.js": detail ? large(detail) : js,
  }))
  expect(result.status).toBe(1)
  expect(result.stdout).toContain("OVER")
  expect(result.stdout).toContain("budget KB")
})

it("fails closed when a required chunk cannot be identified and tells the UI how to expose it", () => {
  const result = run(build({ "index.html": entry, "assets/app.js": js }))
  expect(result.status).toBe(1)
  expect(result.stdout).toContain("UNKNOWN")
  expect(result.stderr).toContain("enable build.manifest in vite.config.ts")
})

it("rejects a detail chunk that was imported by the initial entry", () => {
  const result = run(build({
    "index.html": entry, "assets/app.js": `import './NodeDetail-d.js';`,
    "assets/map-m.js": js, "assets/NodeDetail-d.js": js,
  }))
  expect(result.status).toBe(1)
  expect(result.stderr).toContain("Detail chunks must not be loaded on the first screen")
})
