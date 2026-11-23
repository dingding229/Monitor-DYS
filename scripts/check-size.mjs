import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { gzipSync } from "node:zlib"
import ts from "typescript"

const jsFile = /\.(?:m?js)$/i
const mapName = /(?:^|[/_.-])(?:worldmap|map(?:[-_]?data)?)(?=[/_.-]|$)/i
const detailName = /(?:^|[/_.-])(?:nodedetail|uplot(?:chart)?|detail)(?=[/_.-]|$)/i
const buildOrigin = "https://dys-build.invalid"
const KB = 1000
// v1.6 build: 8,511 bytes across all CSS assets (entry + detail); allow up to 5% more.
const CSS_LIMIT_KB = Math.floor(8511 * 1.05) / KB

function* filesUnder(root, prefix = "") {
  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) yield* filesUnder(root, path)
    else if (entry.isFile()) yield path
  }
}

function attributes(tag) {
  const attrs = new Map()
  for (const [, name, double, single, unquoted] of tag.matchAll(/([^\s=<>'"/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    attrs.set(name.toLowerCase(), double ?? single ?? unquoted)
  }
  return attrs
}

function localPath(source, from) {
  const url = new URL(source, `${buildOrigin}/${from}`)
  if (url.origin !== buildOrigin) throw new Error(`Cannot size external JS ${source} (from ${from})`)
  const path = decodeURIComponent(url.pathname.slice(1))
  if (path.split("/").some((part) => !part || part === "." || part === "..") || path.includes("\\")) {
    throw new Error(`Invalid build artifact path: ${source}`)
  }
  return path
}

function htmlChunks(html) {
  const roots = []
  const preloads = []
  for (const [tag, name] of html.replace(/<!--[\s\S]*?-->/g, "").matchAll(/<(script|link)\b[^>]*>/gi)) {
    const attrs = attributes(tag)
    if (name.toLowerCase() === "script") {
      const type = (attrs.get("type") ?? "").toLowerCase()
      const src = attrs.get("src")
      // Also count classic JavaScript scripts, not only Vite's normal module scripts.
      if (src && (!type || type === "module" || /^(?:text|application)\/javascript$/.test(type))) {
        const file = localPath(src, "index.html")
        if (jsFile.test(file)) roots.push(file)
      }
    } else if (attrs.get("rel")?.toLowerCase().split(/\s+/).includes("modulepreload") && attrs.has("href")) {
      const file = localPath(attrs.get("href"), "index.html")
      if (jsFile.test(file)) preloads.push(file)
    }
  }
  return { roots, preloads }
}

function staticSpecifiers(source, file) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS)
  return ast.statements.flatMap((node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      return [node.moduleSpecifier.text]
    }
    return []
  })
}

function readManifest(root) {
  for (const file of [".vite/manifest.json", "manifest.json"]) {
    const path = join(root, file)
    if (!existsSync(path)) continue
    const data = JSON.parse(readFileSync(path, "utf8"))
    if (data && typeof data === "object" && Object.values(data).some((value) => typeof value?.file === "string")) {
      return { file, data }
    }
  }
  return { file: null, data: {} }
}

/** Inspect an already-built directory without modifying it. All sets below use dist-relative paths. */
export function inspectBuild(directory = "dist") {
  const root = resolve(directory)
  const { roots, preloads } = htmlChunks(readFileSync(join(root, "index.html"), "utf8"))
  if (!roots.length) throw new Error("index.html does not reference an entry JavaScript chunk")
  const artifacts = [...filesUnder(root)]
  const files = new Set(artifacts.filter((file) => jsFile.test(file)))
  const cssFiles = artifacts.filter((file) => /\.css$/i.test(file)).sort()
  const manifest = readManifest(root)
  const entries = Object.entries(manifest.data).filter(([, record]) => jsFile.test(record?.file ?? ""))
  const dependencies = new Map()
  const checkFile = (file) => {
    if (!files.has(file)) throw new Error(`Referenced JS chunk does not exist: ${file}`)
    return file
  }
  for (const [, record] of entries) {
    checkFile(record.file)
    const imports = (record.imports ?? []).map((key) => {
      const target = manifest.data[key]?.file
      if (!target) throw new Error(`Missing manifest import ${key} from ${record.file}`)
      return target
    }).filter((file) => jsFile.test(file)).map(checkFile)
    if (!dependencies.has(record.file)) dependencies.set(record.file, new Set())
    for (const file of imports) dependencies.get(record.file).add(file)
  }

  function closure(roots) {
    const seen = new Set()
    const pending = [...roots]
    while (pending.length) {
      const file = checkFile(pending.pop())
      if (seen.has(file)) continue
      seen.add(file)
      if (!dependencies.has(file)) {
        const imports = staticSpecifiers(readFileSync(join(root, file), "utf8"), file)
        dependencies.set(file, new Set(imports.map((source) => localPath(source, file)).filter((path) => jsFile.test(path))))
      }
      pending.push(...dependencies.get(file))
    }
    return seen
  }

  function family(pattern) {
    const matches = new Set([...files].filter((file) => pattern.test(file)))
    for (const [key, record] of entries) {
      if ([key, record.name, record.src].some((value) => value && pattern.test(value))) matches.add(record.file)
    }
    return matches
  }

  const entryFiles = [...new Set(roots.map(checkFile))].sort()
  const mapRoots = family(mapName)
  const detailRoots = family(detailName)
  const initial = closure([...entryFiles, ...preloads, ...mapRoots])
  // A shared module already counted as initial is not downloaded again on a detail visit.
  const detailFiles = [...closure(detailRoots)].filter((file) => !initial.has(file) || detailRoots.has(file)).sort()
  const initialFiles = [...initial].sort()
  const missing = [!mapRoots.size && "map", !detailRoots.size && "NodeDetail/uPlot"].filter(Boolean)
  const eagerDetail = [...detailRoots].filter((file) => initial.has(file)).sort()
  return { root, manifest: manifest.file, entryFiles, initialFiles, detailFiles, cssFiles, missing, eagerDetail }
}

function main() {
  if (process.argv.length > 3) throw new Error("Usage: node scripts/check-size.mjs [dist]")
  const result = inspectBuild(process.argv[2])
  const cache = new Map()
  function gzipTotal(files) {
    return files.reduce((total, file) => {
      if (!cache.has(file)) cache.set(file, gzipSync(readFileSync(join(result.root, file))).length)
      return total + cache.get(file)
    }, 0)
  }
  const version = process.env.SIZE_BUDGET ?? "v2"
  if (version !== "v1" && version !== "v2") throw new Error("SIZE_BUDGET must be v1 or v2")
  const [entryLimit, initialLimit, detailLimit] = version === "v1" ? [60, 85, 40] : [42, 60, 30]
  const limits = [
    ["Entry JS", result.entryFiles, entryLimit, true],
    ["Initial JS (entry + map + static imports)", result.initialFiles, initialLimit, !result.missing.includes("map")],
    ["Additional detail JS", result.detailFiles, detailLimit, !result.missing.includes("NodeDetail/uPlot")],
    ["CSS (all emitted styles)", result.cssFiles, CSS_LIMIT_KB, true],
  ]
  const groups = limits.map(([name, files, limit, complete]) => {
    const bytes = gzipTotal(files)
    const status = bytes > limit * KB ? "OVER" : complete ? "OK" : "UNKNOWN"
    return { name, files, limit, bytes, status }
  })
  console.log(`Gzip asset budget ${version} (${result.manifest ?? "HTML + chunk filenames"}; 1 KB = 1000 bytes)`)
  console.table(groups.map(({ name, files, limit, bytes, status }) => ({
    group: name, "gzip bytes": files.length || status === "OK" ? bytes : "—", "budget KB": limit, chunks: files.length, status,
  })))
  for (const { name, files } of groups) console.log(`${name}: ${files.join(", ") || "(not identified)"}`)
  if (result.missing.length) {
    console.error(`Cannot identify ${result.missing.join(" and ")} chunk(s); enable build.manifest in vite.config.ts or preserve recognizable chunk names. The size budget cannot be verified.`)
  }
  if (result.eagerDetail.length) console.error(`Detail chunks must not be loaded on the first screen: ${result.eagerDetail.join(", ")}`)
  if (groups.some(({ status }) => status !== "OK") || result.eagerDetail.length) process.exitCode = 1
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { main() }
  catch (error) {
    console.error(`check-size: ${error.message}`)
    process.exitCode = 1
  }
}
