// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { expect, it } from "vitest"

const root = fileURLToPath(new URL("../../src/", import.meta.url))
function* sources(dir: string): Generator<string> {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, item.name)
    if (item.isDirectory()) yield* sources(path)
    else if (item.isFile()) yield path
  }
}

it("does not use Svelte raw HTML or innerHTML anywhere in src", () => {
  const files = [...sources(root)]
  expect(files.length).toBeGreaterThan(0)
  const violations = files.flatMap((file) => readFileSync(file, "utf8").split(/\r?\n/).flatMap((line, index) =>
    /\{\s*@html\b|\binnerHTML\b/.test(line) ? [`${relative(root, file)}:${index + 1}`] : [],
  ))
  expect(violations).toEqual([])
})
