// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { expect, it } from "vitest"
import ts from "typescript"

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

function broadSimpleIconsImports(code: string): number[] {
  const source = ts.createSourceFile("source.ts", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const offsets: number[] = []
  const fromRoot = (node?: ts.Node): boolean => Boolean(node && ts.isStringLiteralLike(node) && node.text === "simple-icons")
  function visit(node: ts.Node) {
    let broad = false
    if (ts.isImportDeclaration(node) && fromRoot(node.moduleSpecifier)) {
      const clause = node.importClause
      broad = !clause || Boolean(clause.name) || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)
    } else if (ts.isExportDeclaration(node) && fromRoot(node.moduleSpecifier)) {
      broad = !node.exportClause || !ts.isNamedExports(node.exportClause)
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      broad = fromRoot(node.moduleReference.expression)
    } else if (ts.isCallExpression(node) && fromRoot(node.arguments[0])) {
      broad = node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require")
    }
    if (broad) offsets.push(node.getStart(source))
    ts.forEachChild(node, visit)
  }
  visit(source)
  return offsets
}

it("distinguishes named simple-icons imports from broad imports", () => {
  expect(broadSimpleIconsImports(`// import * as icons from "simple-icons"
    import { siDebian, siUbuntu as ubuntu } from "simple-icons"
    import type { SimpleIcon } from 'simple-icons'
    export { siFirefox } from "simple-icons"`)).toEqual([])
  expect(broadSimpleIconsImports(`import * as icons from "simple-icons"
    import iconsDefault from 'simple-icons'
    import "simple-icons"
    export * from "simple-icons"
    const pkg = import("simple-icons")
    const common = require("simple-icons")`)).toHaveLength(6)
})

it("only imports individual simple-icons exports throughout src", () => {
  const violations = [...sources(root)].flatMap((file) => {
    if (!/\.(?:svelte|[cm]?[jt]sx?)$/i.test(file)) return []
    const content = readFileSync(file, "utf8")
    const scripts = file.endsWith(".svelte")
      ? [...content.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)]
        .map((match) => ({ code: match[1], offset: match.index + match[0].indexOf(">") + 1 }))
      : [{ code: content, offset: 0 }]
    return scripts.flatMap(({ code, offset }) => broadSimpleIconsImports(code).map((start) =>
      `${relative(root, file)}:${content.slice(0, offset + start).split("\n").length}`,
    ))
  })
  expect(violations).toEqual([])
})
