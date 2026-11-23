import { readFile } from "node:fs/promises"
import { expect, test, type Page } from "@playwright/test"
import { mockUrl } from "../fixtures/mock-origins"

const tokyo = (page: Page) => page.getByTestId("node-card").filter({ hasText: "东京 01" })
const pathIs = (url: string, path: string) => new URL(url).pathname === path
const nodesPath = "/api/nodes"

function isPing(url: string) {
  const target = new URL(url)
  return /^\/api\/nodes\/\d+\/metrics$/.test(target.pathname) && target.searchParams.get("series") === "ping"
}

function firstNodePing(page: Page) {
  return page.waitForResponse((response) => {
    const url = new URL(response.url())
    return response.ok() && isPing(response.url()) && url.pathname === "/api/nodes/1/metrics" &&
      url.searchParams.get("hours") === "1" && url.searchParams.get("points") === "12"
  }, { timeout: 8000 })
}

test.beforeEach(async ({ page }) => {
  // Geolocation is not exercised by this smoke suite; keep third-party traffic off the network.
  await page.route(/^https:\/\/(?:api\.ip\.sb|ipwho\.is)\//, (route) => route.fulfill({
    status: 503, json: {}, headers: { "access-control-allow-origin": "*" },
  }))
})

test("home renders four summary tiles, 16 cards and a map from one HTTP snapshot", async ({ page }) => {
  let nodeGets = 0
  page.on("request", (request) => { if (request.method() === "GET" && pathIs(request.url(), nodesPath)) nodeGets++ })
  await page.goto(mockUrl("normal"))
  const summary = page.getByTestId("summary")
  await expect(summary.getByTestId("summary-tile")).toHaveCount(4)
  await expect(summary.getByTestId("summary-servers")).toContainText(/\b14\s*\/\s*16\b/)
  await expect(page.getByTestId("node-card")).toHaveCount(16)
  const map = page.getByTestId("world-map")
  await expect(map).toBeVisible()
  await expect(map.getByTestId("map-country")).toHaveCount(12)
  expect(nodeGets).toBe(1)
  await test.step("production HTML inlines the background before the app loads", async () => {
    const html = await readFile(new URL("../../dist/index.html", import.meta.url), "utf8")
    const head = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html)?.[1] ?? ""
    const css = await readFile(new URL("../../src/app.css", import.meta.url), "utf8")
    const light = /:root\s*\{[^}]*--bg:\s*([^;]+);/i.exec(css)?.[1]?.trim()
    expect(light, "light --bg").toBeTruthy()
    const styles = [...head.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join("\n")
    const rules = [...styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    expect(rules.some(([, selector, body]) => /(?:^|,)\s*html\b/.test(selector) && body.includes(`background:${light}`))).toBe(true)
    const accentScript = [...head.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
      .find(match => /dys:accent/.test(match[1]) && /setProperty\s*\(\s*["']--accent["']/.test(match[1]))
    const firstStylesheet = /<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*>/i.exec(head)
    expect(accentScript, "inline accent cache script").toBeTruthy()
    expect(firstStylesheet, "built stylesheet").toBeTruthy()
    expect(accentScript!.index).toBeLessThan(firstStylesheet!.index)
  })
})

test("list columns put name first, status last and Ping next to the rates", async ({ page }) => {
  await page.goto(mockUrl("normal"))
  await page.getByRole("button", { name: "列表视图" }).click()
  const headers = page.getByRole("table").getByRole("columnheader")
  await expect(headers).toHaveText(["名称", "地区", "CPU", "内存", "硬盘", "上行", "下行", "延迟", "丢包", "本期流量", "到期", "状态"])
  const rows = page.getByTestId("node-row")
  await expect(rows).toHaveCount(16)
  const cells = rows.filter({ hasText: "东京 01" }).getByRole("cell")
  await expect(cells.first()).toHaveText("东京 01")
  await expect(cells.first().getByTestId("brand-icon")).toHaveCount(0)
  await expect(cells.nth(1)).toContainText("日本")
  await expect(cells.nth(1).getByTestId("brand-icon")).toBeVisible()
  await expect(cells.last()).toContainText("在线")
})

test("opening detail renders charts and the stats in the node header", async ({ page }) => {
  await page.goto(mockUrl("normal"))
  await tokyo(page).click()
  await expect(page).toHaveURL(mockUrl("normal", "/node/1"))
  const heading = page.getByRole("heading", { name: "东京 01", exact: true })
  await expect(heading).toBeVisible()
  await expect(page.getByRole("img", { name: "CPU 使用率", exact: true }).locator("canvas")).toBeVisible()
  const nameCard = heading.locator('xpath=ancestor::*[.//*[@data-testid="detail-stats"]][1]')
  const stats = nameCard.getByTestId("detail-stats")
  await expect(stats).toBeVisible()
  for (const label of [/负载/, /进程/, /TCP\s*\/\s*UDP/]) await expect(stats).toContainText(label)
  await expect(nameCard.getByTestId("chart")).toHaveCount(0)
})

test("detail Ping keeps at least one probe selected and restores the selection after reload", async ({ page }) => {
  await page.goto(mockUrl("normal", "/node/1"))
  const chips = page.getByTestId("probe-chip")
  const all = page.getByTestId("probe-all")
  await expect(chips).toHaveCount(2)
  const names = await chips.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-probe")))
  expect([...names].sort()).toEqual(["东京探测", "法兰克福探测"])
  const probes = names.map((name) => chips.and(page.locator(`[data-probe=${JSON.stringify(name)}]`)))
  for (const probe of probes) await expect(probe).toHaveAttribute("aria-pressed", "true")
  await expect(all).toBeDisabled()

  const hidden = probes.slice(0, -1)
  const last = probes[probes.length - 1]
  for (const probe of hidden) {
    await probe.click()
    await expect(probe).toHaveAttribute("aria-pressed", "false")
    await expect(all).toBeEnabled()
  }
  // The last selected chip may be disabled or its handler may refuse to deselect it.
  await last.click({ force: true })
  await expect(last).toHaveAttribute("aria-pressed", "true")
  for (const probe of hidden) await expect(probe).toHaveAttribute("aria-pressed", "false")

  await page.reload()
  for (const probe of hidden) await expect(probe).toHaveAttribute("aria-pressed", "false")
  await expect(last).toHaveAttribute("aria-pressed", "true")
  await expect(all).toBeEnabled()
  await all.click()
  for (const probe of probes) await expect(probe).toHaveAttribute("aria-pressed", "true")
  await expect(all).toBeDisabled()
})

test("a WS handshake 503 falls back to polling the nodes API", async ({ page }) => {
  const errors: string[] = []
  const snapshots: number[] = []
  page.on("websocket", (socket) => {
    if (pathIs(socket.url(), "/api/ws")) socket.on("socketerror", (message) => errors.push(message))
  })
  page.on("response", (response) => {
    if (response.ok() && pathIs(response.url(), nodesPath)) snapshots.push(performance.now())
  })
  await page.goto(mockUrl("ws503"))
  await expect.poll(() => errors.join(" ")).toContain("503")
  await expect(page.getByTestId("conn-status")).toContainText("轮询更新")
  await expect.poll(() => snapshots.length, { timeout: 5000 }).toBeGreaterThanOrEqual(2)
  // The scenario polls every two seconds; an initial duplicated GET is not a poll.
  await expect.poll(() => snapshots.some((time) => time - snapshots[0] >= 1000), { timeout: 5000 }).toBe(true)
  await expect(tokyo(page)).toBeVisible()
})

test("only authenticated viewers get the admin link", async ({ page }) => {
  const me = page.waitForResponse((response) => response.ok() && pathIs(response.url(), "/api/me"))
  await page.goto(mockUrl("normal"))
  expect(await (await me).json()).toMatchObject({ authed: false })
  await expect(tokyo(page)).toBeVisible()
  await expect(page.getByTestId("admin-link")).toHaveCount(0)
  await expect(page.getByRole("banner").locator('a[href="/admin"]')).toHaveCount(0)

  await page.goto(mockUrl("admin"))
  const admin = page.getByTestId("admin-link")
  await expect(admin).toBeVisible()
  await expect(admin).toHaveAttribute("href", "/admin")
})

test("show_ping=false hides Ping and makes no Ping history requests", async ({ page }) => {
  const requests: string[] = []
  page.on("request", (request) => { if (isPing(request.url())) requests.push(request.url()) })
  const config = page.waitForResponse((response) => response.ok() && pathIs(response.url(), "/api/themes/dys/config"))
  await page.goto(mockUrl("config"))
  expect(await (await config).json()).toMatchObject({ show_ping: false, layout: "table" })
  await expect(page.getByTestId("node-row")).toHaveCount(16)
  // Cover the 1500 ms fallback when requestIdleCallback is not available.
  await page.waitForTimeout(1700)
  await expect(page.getByTestId("node-ping")).toHaveCount(0)
  expect(requests).toEqual([])
})

test("card text stays on one line at 1280px and 390px and is not clipped at 1280px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 850 })
  // Exercise a long Ping line rather than measuring only a loading placeholder or zero loss.
  await page.route(/\/api\/nodes\/1\/metrics\?/, (route) => isPing(route.request().url())
    ? route.fulfill({ json: {
      step: 300,
      metrics: [],
      ping: [{ task_id: 9, ts: 300, latency: 225 }],
      probes: { 9: "东京探测" },
      loss: { 9: 45.6 },
    } })
    : route.fallback())
  await page.goto(mockUrl("normal"))
  const cards = page.getByTestId("node-card")
  await expect(cards).toHaveCount(16)
  await tokyo(page).scrollIntoViewIfNeeded()
  const ping = tokyo(page).getByTestId("node-ping")
  await expect(ping).toHaveAttribute("data-latency", "225")
  await expect(ping).toHaveAttribute("data-loss", "45.6")
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 850 })
    await test.step(`${width}px cards`, async () => {
      const { wrapped, clipped } = await cards.evaluateAll((elements, checkClipping) => {
        const wrapped: string[] = []
        const clipped: string[] = []
        for (const card of elements) {
          const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT)
          const range = document.createRange()
          const measured = new Set<Element>()
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = node.textContent?.trim()
            const element = node.parentElement
            if (!text || !element || element.closest("svg, [hidden]")) continue
            const style = getComputedStyle(element)
            if (style.visibility !== "visible") continue
            range.selectNodeContents(node)
            const runs = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0)
            if (!runs.length) continue

            if (checkClipping) {
              // Inline spans (e.g. Ping values) do not expose the enclosing line's layout width.
              let box = element
              while (box !== card && /^(inline|contents)$/.test(getComputedStyle(box).display) && box.parentElement) {
                box = box.parentElement
              }
              if (!measured.has(box) && box.scrollWidth > box.clientWidth) {
                clipped.push(`${card.getAttribute("href")}: ${box.textContent?.trim().replace(/\s+/g, " ")} (${box.scrollWidth}px > ${box.clientWidth}px)`)
              }
              measured.add(box)
            }

            if (runs.length < 2) continue
            const top = Math.min(...runs.map((rect) => rect.top))
            const bottom = Math.max(...runs.map((rect) => rect.bottom))
            const lineHeight = Number.parseFloat(style.lineHeight) || Math.max(...runs.map((rect) => rect.height))
            if (bottom - top > lineHeight + 2) wrapped.push(text.replace(/\s+/g, " "))
          }
        }
        return { wrapped, clipped }
      }, width === 1280)
      expect(wrapped, `wrapped card text at ${width}px`).toEqual([])
      if (width === 1280) expect.soft(clipped, "clipped card text at 1280px").toEqual([])
    })
  }
})

test("visible home card loads Ping and the list shows average latency and zero loss", async ({ page }) => {
  const pending = firstNodePing(page)
  await page.goto(mockUrl("normal"))
  await tokyo(page).scrollIntoViewIfNeeded()
  const response = await pending
  expect(await response.json()).toMatchObject({ metrics: [], loss: { 9: 0, 2: 0 } })
  const ping = tokyo(page).getByTestId("node-ping")
  await expect(ping).toHaveAttribute("data-latency", "42")
  await expect(ping).toHaveAttribute("data-loss", /^0(?:\.0+)?$/)
  await page.getByRole("button", { name: "列表视图" }).click()
  const cells = page.getByTestId("node-row").filter({ hasText: "东京 01" }).getByRole("cell")
  await expect(cells.nth(7)).toHaveText(/42\s*ms/)
  await expect(cells.nth(8)).toHaveText(/^0\s*%$/)
})

test("a home card without probes shows unavailable Ping", async ({ page }) => {
  const pending = firstNodePing(page)
  await page.goto(mockUrl("noping"))
  await tokyo(page).scrollIntoViewIfNeeded()
  const response = await pending
  expect(await response.json()).toMatchObject({ ping: [], probes: {} })
  const ping = tokyo(page).getByTestId("node-ping")
  await expect(ping).toHaveAttribute("data-latency", "")
  await expect(ping).toHaveAttribute("data-loss", "")
  await expect(ping).toContainText("—")
})

test("500 nodes render the first card quickly and stay responsive across ten seconds of WS updates", async ({ page }) => {
  test.setTimeout(25_000)
  const multiplier = process.env.CI ? 2 : 1
  let frames = 0
  page.on("websocket", (socket) => {
    if (pathIs(socket.url(), "/api/ws")) socket.on("framereceived", () => { frames++ })
  })
  const cards = page.getByTestId("node-card")
  const start = performance.now()
  await page.goto(mockUrl("many"), { waitUntil: "commit" })
  await cards.first().waitFor({ state: "visible" })
  const firstCardMs = performance.now() - start
  expect.soft(firstCardMs, "goto → first visible card (ms)").toBeLessThanOrEqual(1200 * multiplier)

  const initialFrames = frames
  const longest = await page.evaluate(async () => {
    if (!PerformanceObserver.supportedEntryTypes.includes("longtask")) throw new Error("Chromium longtask entries unavailable")
    let max = 0
    const collect = (entries: PerformanceEntry[]) => {
      for (const entry of entries) max = Math.max(max, entry.duration)
    }
    const observer = new PerformanceObserver((list) => collect(list.getEntries()))
    observer.observe({ type: "longtask" })
    await new Promise((resolve) => setTimeout(resolve, 10_000))
    collect(observer.takeRecords())
    observer.disconnect()
    return max
  })
  const sampledFrames = frames - initialFrames
  const measurements = { firstCardMs: Math.round(firstCardMs), longestTaskMs: longest, sampledFrames }
  await test.info().attach("500-node performance", { body: JSON.stringify(measurements), contentType: "application/json" })
  expect.soft(longest, "maximum main-thread longtask in 10s (ms)").toBeLessThanOrEqual(50 * multiplier)
  expect(sampledFrames, "WS frames during the observation window").toBeGreaterThanOrEqual(8)
  await expect(cards).toHaveCount(500)
})

test("group and search filter survive reload through the URL", async ({ page }) => {
  await page.goto(mockUrl("normal"))
  const group = page.getByTestId("group-tab").filter({ hasText: "亚太" })
  const search = page.getByTestId("search-input")
  const cards = page.getByTestId("node-card")
  await group.click()
  await search.fill("东京")
  await expect(cards).toHaveCount(1)
  await expect(tokyo(page)).toBeVisible()
  const filtersInUrl = (url: URL) => url.searchParams.get("g") === "亚太" && url.searchParams.get("q") === "东京"
  await expect(page).toHaveURL(filtersInUrl)

  await page.reload()
  await expect(page).toHaveURL(filtersInUrl)
  await expect(group).toHaveAttribute("aria-selected", "true")
  await expect(search).toHaveValue("东京")
  await expect(cards).toHaveCount(1)
  await expect(tokyo(page)).toBeVisible()
})

test("card Ping displays three per-probe values and twelve segments", async ({ page }) => {
  const pending = firstNodePing(page)
  await page.goto(mockUrl("many"))
  const card = page.getByTestId("node-card").filter({ hasText: "压力节点 001" })
  await card.scrollIntoViewIfNeeded()
  const response = await (await pending).json()
  expect(Object.keys(response.probes)).toHaveLength(3)
  const ping = card.getByTestId("node-ping")
  await expect(ping).toContainText(/\b18\s*·\s*60\s*·\s*102(?!\d|\s*·)/)
  const lossValues = ping.locator(".ping-caption").filter({ hasText: "丢包" }).locator("b")
  await expect(lossValues).toHaveText(/^(?:—|\d+(?:\.[1-9])?)(?:·(?:—|\d+(?:\.[1-9])?)){2}$/)
  const bars = ping.getByTestId("ping-bars")
  await expect(bars.first()).toBeVisible()
  for (const bar of await bars.all()) await expect(bar.locator(":scope > *")).toHaveCount(12)
})


test("configured accent is cached and applied by DOMContentLoaded after reload", async ({ page }) => {
  let delay = false
  let release: (() => void) | undefined
  await page.route("**/api/themes/dys/config", async route => {
    if (delay) await new Promise<void>(resolve => { release = resolve })
    await route.fulfill({ json: { accent_color: "#3b82f6" } }).catch(() => {})
  })
  await page.addInitScript(() => {
    ;(window as any).__domAccent = null
    document.addEventListener("DOMContentLoaded", () => {
      ;(window as any).__domAccent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()
    }, { once: true })
  })
  await page.goto(mockUrl("normal"))
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim())).toBe("#3b82f6")
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("dys:accent") || "null")?.accent)).toBe("#3b82f6")
  delay = true
  try {
    await page.reload({ waitUntil: "domcontentloaded" })
    expect(await page.evaluate(() => (window as any).__domAccent)).toBe("#3b82f6")
    expect(await page.evaluate(() => document.documentElement.style.getPropertyValue("--accent").trim())).toBe("#3b82f6")
  } finally { release?.(); delay = false }
})

test("first mounted selected button uses delayed configuration color without flashing the default", async ({ page }) => {
  await page.route("**/api/themes/dys/config", async route => {
    await new Promise(resolve => setTimeout(resolve, 800))
    await route.fulfill({ json: { accent_color: "#3b82f6" } })
  })
  await page.addInitScript(() => {
    const w = window as any
    w.__firstMountedAccent = null
    function sample() {
      const button = document.querySelector<HTMLElement>('[data-testid="group-tab"][aria-selected="true"]')
      if (!button) { requestAnimationFrame(sample); return }
      const root = getComputedStyle(document.documentElement)
      w.__firstMountedAccent = { accent: root.getPropertyValue("--accent").trim(), strong: root.getPropertyValue("--accent-strong").trim(), background: getComputedStyle(button).backgroundColor }
    }
    requestAnimationFrame(sample)
  })
  await page.goto(mockUrl("normal"))
  await expect.poll(() => page.evaluate(() => (window as any).__firstMountedAccent)).not.toBeNull()
  const first = await page.evaluate(() => (window as any).__firstMountedAccent)
  expect(first.accent).toBe("#3b82f6")
  expect(first.strong).not.toBe("#0c875e")
  const rgb = first.strong.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/)
  expect(rgb).not.toBeNull()
  expect(first.background).toBe(`rgb(${parseInt(rgb[1], 16)}, ${parseInt(rgb[2], 16)}, ${parseInt(rgb[3], 16)})`)
})

test("failed configuration leaves absent and existing accent caches unchanged", async ({ page }) => {
  let succeed = false
  await page.route("**/api/themes/dys/config", route => succeed ? route.fulfill({ json: { accent_color: "#3b82f6" } }) : route.fulfill({ status: 503, body: "unavailable" }))
  await page.goto(mockUrl("normal"))
  await expect(page.getByTestId("node-card").first()).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem("dys:accent"))).toBeNull()
  succeed = true
  await page.reload()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("dys:accent") || "null")?.accent)).toBe("#3b82f6")
  const cached = await page.evaluate(() => localStorage.getItem("dys:accent"))
  succeed = false
  const failedConfig = page.waitForResponse(response => response.url().includes("/api/themes/dys/config") && response.status() === 503)
  await page.reload()
  await failedConfig
  await expect(page.getByTestId("node-card").first()).toBeVisible()
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  expect(await page.evaluate(() => localStorage.getItem("dys:accent"))).toBe(cached)
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim())).toBe("#3b82f6")
})

test("first node card has at most 90 descendant elements", async ({ page }) => {
  await page.goto(mockUrl("normal"))
  const card = page.getByTestId("node-card").first()
  await expect(card).toBeVisible()
  await expect(card.getByTestId("ping-bars").first()).toBeVisible()
  expect(await card.evaluate(el => el.querySelectorAll("*").length)).toBeLessThanOrEqual(90)
})

test("v3 status and trend indicators render and map tooltips stay inside the map", async ({ page }) => {
  test.setTimeout(30_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(mockUrl("normal"))
  await expect(page.getByTestId("status-strip")).toBeVisible()
  await expect(page.getByTestId("fleet-spark").first()).toBeVisible()
  await expect(page.getByTestId("load-spark").first()).toBeVisible()
  await expect(page.getByTestId("region-summary")).toBeVisible()
  const map = page.getByTestId("world-map")
  const markers = map.getByTestId("map-country")
  await expect(markers).toHaveCount(12)
  await map.scrollIntoViewIfNeeded()
  await page.evaluate(() => window.scrollBy(0, -160))
  await markers.first().hover()
  for (const marker of await markers.all()) {
    await marker.dispatchEvent("mouseenter")
    const tip = map.locator(".map-tip")
    await expect(tip).toBeVisible()
    const box = await map.boundingBox(), bubble = await tip.boundingBox()
    expect(box).not.toBeNull(); expect(bubble).not.toBeNull()
    expect(bubble!.x).toBeGreaterThanOrEqual(box!.x - 1)
    expect(bubble!.y).toBeGreaterThanOrEqual(box!.y - 1)
    expect(bubble!.x + bubble!.width).toBeLessThanOrEqual(box!.x + box!.width + 1)
    expect(bubble!.y + bubble!.height).toBeLessThanOrEqual(box!.y + box!.height + 1)
  }
})

test("390px hides the map graphic but shows the region list", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(mockUrl("normal"))
  await expect(page.getByTestId("world-map").locator("svg").first()).toBeHidden()
  await expect(page.getByTestId("country-list")).toBeVisible()
  await expect(page.getByTestId("country-row").first()).toBeVisible()
})


for (const width of [1440, 390]) {
  test(`expanding regions at ${width}px keeps card and page height fixed and scrolls internally`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(mockUrl("normal"))
    const list = page.getByTestId("country-list")
    const map = page.getByTestId("world-map")
    const card = page.locator(".radar-card").filter({ has: map })
    await expect(list).toBeVisible()
    await expect(page.getByTestId("country-row")).toHaveCount(12)
    await expect(page.getByTestId("node-card").first().getByTestId("ping-bars").first()).toBeVisible()
    const more = card.getByRole("button", { name: /另外\s*\d+\s*个地区/ })
    await expect(more).toBeVisible()
    const before = await page.evaluate(() => document.documentElement.scrollHeight)
    const beforeCard = (await card.boundingBox())!.height
    await more.click()
    await expect(card.getByRole("button", { name: "收起" })).toBeVisible()
    const dimensions = await list.evaluate(el => ({ client: el.clientHeight, scroll: el.scrollHeight, overflow: getComputedStyle(el).overflowY }))
    expect(dimensions.scroll).toBeGreaterThan(dimensions.client)
    expect(["auto", "scroll"]).toContain(dimensions.overflow)
    await list.evaluate(el => { el.scrollTop = el.scrollHeight })
    expect(await list.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
    expect((await card.boundingBox())!.height).toBe(beforeCard)
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(before)
  })
}
