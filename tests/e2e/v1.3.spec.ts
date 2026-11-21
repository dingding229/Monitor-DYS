import { expect, test, type Locator, type Page } from "@playwright/test"
import { inspectBuild } from "../../scripts/check-size.mjs"
import { bytes } from "../../src/lib/format"
import { mockUrl } from "../fixtures/mock-origins"
import { mockGeo } from "./helpers"

test.beforeEach(async ({ page }) => { await mockGeo(page, "fail") })

const pathIs = (url: string, path: string) => new URL(url).pathname === path
const nodesPath = "/api/nodes"
const configPath = "/api/themes/dys/config"
const wsRoute = /\/api\/ws(?:\?.*)?$/
const tokyo = (page: Page) => page.getByTestId("node-card").filter({ hasText: "东京 01" })

function amountText(n: number) {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const [value, unit] = bytes(n).trim().split(/\s+/)
  return new RegExp(`(?:^|[^\\d.])${esc(value)}\\s*${esc(unit)}\\b`)
}

test("v1.3: six summary tiles report server counts and cumulative traffic for the current group", async ({ page }) => {
  const snapshot = await page.request.get(mockUrl("normal", nodesPath))
  expect(snapshot.ok()).toBe(true)
  const { nodes } = await snapshot.json() as { nodes: { online: boolean; group?: string; total_tx: number; total_rx: number }[] }
  await page.goto(mockUrl("normal"))
  const summary = page.getByTestId("summary")
  await expect(summary.getByTestId("summary-tile")).toHaveCount(6)
  async function check(group: typeof nodes) {
    const online = group.filter((node) => node.online).length
    await expect(summary.getByTestId("summary-servers")).toContainText(new RegExp(`\\b${online}\\s*/\\s*${group.length}\\b`))
    await expect(summary.getByTestId("summary-total-up")).toContainText(amountText(group.reduce((sum, node) => sum + node.total_tx, 0)))
    await expect(summary.getByTestId("summary-total-down")).toContainText(amountText(group.reduce((sum, node) => sum + node.total_rx, 0)))
  }
  await check(nodes)
  await page.getByTestId("group-tab").filter({ hasText: /^亚太/ }).click()
  const group = nodes.filter((node) => node.group === "亚太")
  await expect(page.getByTestId("node-card")).toHaveCount(group.length)
  await check(group)
})

test("v1.3: home, list, and detail have no remaining value or quote-provider requests", async ({ page }) => {
  const hosts = new Set(["open.er-api.com", "cdn.jsdelivr.net"])
  const unexpected: string[] = []
  page.on("request", (request) => {
    if (hosts.has(new URL(request.url()).hostname)) unexpected.push(request.url())
  })
  // A regression must be counted without actually reaching either third party.
  await page.route((url) => hosts.has(url.hostname), (route) => route.abort())
  await page.goto(mockUrl("normal"))
  await expect(page.getByTestId("node-card")).toHaveCount(16)
  await expect(page.locator("body")).not.toContainText("剩余价值")
  await page.locator("main").getByRole("button", { name: "列表视图" }).click()
  await expect(page.getByTestId("node-row")).toHaveCount(16)
  await expect(page.locator("body")).not.toContainText("剩余价值")
  await page.getByRole("link", { name: "东京 01", exact: true }).click()
  await expect(page).toHaveURL(mockUrl("normal", "/node/1"))
  await expect(page.getByRole("img", { name: "CPU 使用率", exact: true }).locator("canvas")).toBeVisible()
  await expect(page.locator("body")).not.toContainText("剩余价值")
  expect(unexpected).toEqual([])
})

test("v1.3: startup requests start within 50 ms and do not repeat the nodes GET in three seconds", async ({ page }) => {
  const paths = ["/api/me", nodesPath, configPath]
  let nodeGets = 0
  page.on("request", (request) => {
    if (request.method() === "GET" && pathIs(request.url(), nodesPath)) nodeGets++
  })
  const responses = paths.map((path) => page.waitForResponse((response) => pathIs(response.url(), path) && response.ok()))
  const start = performance.now()
  await page.goto(mockUrl("slowconfig"))
  const initial = await Promise.all(responses)
  await Promise.all(initial.map((response) => response.finished()))
  await page.waitForFunction((apiPaths) => apiPaths.every((path) => performance.getEntriesByType("resource")
    .some((entry) => new URL(entry.name).pathname === path)), paths)
  const timing = await page.evaluate((apiPaths) => {
    const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[]
    return Object.fromEntries(apiPaths.map((path) => {
      const item = entries.find((entry) => new URL(entry.name).pathname === path)
      return [path, item ? { start: item.startTime, end: item.responseEnd } : null]
    }))
  }, paths)
  for (const path of paths) expect(timing[path], `resource timing for ${path}`).not.toBeNull()
  const times = paths.map((path) => timing[path]!.start)
  expect(Math.max(...times) - Math.min(...times), JSON.stringify(timing)).toBeLessThan(50)
  expect(timing[configPath]!.end - timing[configPath]!.start).toBeGreaterThanOrEqual(550)
  expect(timing[nodesPath]!.start).toBeLessThan(timing[configPath]!.end)
  const remaining = 3000 - (performance.now() - start)
  if (remaining > 0) await page.waitForTimeout(remaining)
  expect(nodeGets).toBe(1)
})

test("v1.3: detail JS is absent on initial home, then requested on detail navigation", async ({ page }) => {
  const build = inspectBuild(process.env.DYS_TEST_DIST)
  expect(build.detailFiles.length, "identify detail chunks by manifest or emitted name before testing code splitting").toBeGreaterThan(0)
  const candidates = new Set(build.detailFiles)
  const detailRequests: string[] = []
  page.on("request", (request) => {
    const file = decodeURIComponent(new URL(request.url()).pathname.slice(1))
    if (candidates.has(file) || /(?:nodedetail|uplot).*\.(?:m?js)$/i.test(file)) detailRequests.push(file)
  })
  // Spec allows idle/hover prefetch; suppress idle callbacks and navigate without pointer prefetch.
  await page.addInitScript(() => { window.requestIdleCallback = () => 1 })
  await page.goto(mockUrl("normal"), { waitUntil: "load" })
  const card = tokyo(page)
  await expect(card).toBeVisible()
  expect(detailRequests).toEqual([])
  await card.evaluate((element: HTMLElement) => element.click())
  await expect(page).toHaveURL(mockUrl("normal", "/node/1"))
  await expect(page.getByRole("img", { name: "CPU 使用率", exact: true }).locator("canvas")).toBeVisible()
  expect(detailRequests.length).toBeGreaterThan(0)
})

type ShiftEntry = PerformanceEntry & { hadRecentInput: boolean; value: number }
type ShiftWindow = Window & { startupShift?: { observer: PerformanceObserver; values: number[] } }

test("v1.3: loading skeleton yields to cards after the one-second snapshot delay with CLS under 0.05", async ({ page }) => {
  await page.routeWebSocket(wsRoute, () => {}) // isolate the slow HTTP snapshot from the first WS frame
  await page.addInitScript(() => {
    if (!PerformanceObserver.supportedEntryTypes.includes("layout-shift")) return
    const values: number[] = []
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as ShiftEntry[]) if (!entry.hadRecentInput) values.push(entry.value)
    })
    observer.observe({ type: "layout-shift", buffered: true })
    ;(window as ShiftWindow).startupShift = { observer, values }
  })
  const response = page.waitForResponse((res) => pathIs(res.url(), nodesPath) && res.ok())
  await page.goto(mockUrl("slownodes"), { waitUntil: "domcontentloaded" })
  const skeleton = page.getByTestId("skeleton")
  await expect(skeleton.first()).toBeVisible()
  await expect(page.getByTestId("node-card")).toHaveCount(0)
  await response
  await expect(page.getByTestId("node-card")).toHaveCount(16)
  await expect(skeleton).toHaveCount(0)
  const cls = await page.evaluate(async () => {
    await new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
    const state = (window as ShiftWindow).startupShift
    if (!state) throw new Error("Chromium layout-shift collection did not initialize")
    const pending = (state.observer.takeRecords() as ShiftEntry[]).filter((entry) => !entry.hadRecentInput).map((entry) => entry.value)
    return [...state.values, ...pending].reduce((sum, value) => sum + value, 0)
  })
  // Startup CLS across the whole page is a conservative upper bound for the card region.
  expect(cls).toBeLessThan(0.05)
})

test("v1.3: the footer has at most 24px bottom gap and contains the visitor bubble when visible", async ({ page }) => {
  await page.goto(mockUrl("normal"))
  await expect(page.getByTestId("node-card")).toHaveCount(16)
  const footer = page.locator("footer")
  const bubble = page.getByTestId("visitor-bubble")
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }))
  await expect(footer).toBeInViewport()
  await expect(bubble).toBeVisible()
  await expect.poll(() => footer.evaluate((element) => {
    const footerRect = element.getBoundingClientRect()
    const scroller = document.scrollingElement!
    return Math.round(scroller.scrollHeight - (footerRect.bottom + scroller.scrollTop))
  })).toBeLessThanOrEqual(24)
  await expect.poll(() => bubble.evaluate((element) => {
    const footer = document.querySelector("footer")
    if (!footer) return false
    if (footer.contains(element)) return true
    const outer = footer.getBoundingClientRect()
    const inner = element.getBoundingClientRect()
    return inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1 &&
      inner.left >= outer.left - 1 && inner.right <= outer.right + 1
  })).toBe(true)
})

test("v1.3: header and summary tiles use a glass backdrop", async ({ page }) => {
  await page.goto(mockUrl("normal"))
  await expect(page.getByRole("banner")).toHaveCSS("backdrop-filter", /blur\(/)
  const tiles = page.getByTestId("summary-tile")
  await expect(tiles).toHaveCount(6)
  for (const tile of await tiles.all()) await expect(tile).toHaveCSS("backdrop-filter", /blur\(/)
})

test("v1.3: reduced transparency disables the glass backdrop", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "The media preference is emulated via Chromium DevTools Protocol")
  const client = await page.context().newCDPSession(page)
  await client.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] })
  const supported = await page.evaluate(() => matchMedia("(prefers-reduced-transparency: reduce)").matches)
  test.skip(!supported, "This Chromium build does not support emulating reduced transparency")
  await page.goto(mockUrl("normal"))
  await expect(page.getByRole("banner")).toHaveCSS("backdrop-filter", "none")
  const tiles = page.getByTestId("summary-tile")
  await expect(tiles).toHaveCount(6)
  for (const tile of await tiles.all()) await expect(tile).toHaveCSS("backdrop-filter", "none")
})

test("v1.3: node cards have an 8px computed border radius", async ({ page }) => {
  await page.goto(mockUrl("normal"))
  await expect(tokyo(page)).toHaveCSS("border-radius", "8px")
})

async function checkGrid(cells: Locator, total: number, columns: number) {
  await expect(cells).toHaveCount(total)
  const boxes = await cells.evaluateAll((elements) => elements.map((element) => {
    const { top, left, width } = element.getBoundingClientRect()
    return { top, left, width }
  }))
  for (let row = 0; row < total; row += columns) {
    if (row) expect(boxes[row].top).toBeGreaterThan(boxes[row - columns].top + 1)
    for (let cell = row; cell < row + columns; cell++) {
      expect(boxes[cell].width).toBeGreaterThan(0)
      expect(Math.abs(boxes[cell].top - boxes[row].top)).toBeLessThan(1)
      if (cell > row) expect(boxes[cell].left).toBeGreaterThan(boxes[cell - 1].left)
    }
  }
}

test("v1.3: 390px uses three summary columns and two detail-stat columns", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 })
  await page.goto(mockUrl("normal"))
  await checkGrid(page.getByTestId("summary-tile"), 6, 3)
  await page.goto(mockUrl("normal", "/node/1"))
  // The first CPU label in the detail stat card is separate from the chart title and meters.
  const statsGrid = page.locator("main").getByText("CPU", { exact: true }).first().locator("xpath=../../..")
  const stats = statsGrid.locator(":scope > *")
  await expect(stats).toContainText(["CPU", "内存", "磁盘", "网络速率"])
  await checkGrid(stats, 4, 2)
})

test("v1.3: empty search state clears its filters and restores cards", async ({ page }) => {
  await page.goto(mockUrl("normal"))
  await expect(page.getByTestId("node-card")).toHaveCount(16)
  const search = page.getByTestId("search-input")
  await search.fill("no-matching-node-t17")
  const empty = page.getByTestId("empty-state")
  await expect(empty).toContainText("没有匹配的节点")
  await expect(page.getByTestId("node-card")).toHaveCount(0)
  await empty.getByRole("button", { name: "清除筛选" }).click()
  await expect(search).toHaveValue("")
  await expect(empty).toHaveCount(0)
  await expect(page.getByTestId("node-card")).toHaveCount(16)
})

for (const scenario of ["normal", "lossy"] as const) {
  test(`v1.3: ${scenario} Ping loss controls chart visibility and the no-loss badge`, async ({ page }) => {
    const response = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return url.pathname === "/api/nodes/1/metrics" && url.searchParams.get("series") === "ping" && response.ok()
    })
    await page.goto(mockUrl(scenario, "/node/1"))
    const { ping } = await (await response).json() as { ping: { loss: number }[] }
    expect(ping.length).toBeGreaterThan(0)
    expect(ping.some((point) => point.loss > 0)).toBe(scenario === "lossy")
    const latency = page.getByTestId("chart").filter({ has: page.getByRole("heading", { name: "Ping 延迟", exact: true }) })
    await expect(latency.locator("canvas")).toBeVisible()
    const loss = page.getByTestId("chart").filter({ has: page.getByRole("heading", { name: "Ping 丢包率", exact: true }) })
    if (scenario === "lossy") {
      await expect(loss.locator("canvas")).toBeVisible()
      await expect(latency.getByTestId("no-loss")).toHaveCount(0)
    } else {
      await expect(latency.getByTestId("no-loss")).toHaveText("无丢包")
      await expect(loss).toHaveCount(0)
    }
  })
}

test("v1.3: first HTTP snapshot ends 连接中 even before the first WS frame", async ({ page }) => {
  await page.routeWebSocket(wsRoute, () => {})
  const response = page.waitForResponse((response) => pathIs(response.url(), nodesPath) && response.ok())
  await page.goto(mockUrl("slownodes"), { waitUntil: "domcontentloaded" })
  const status = page.getByTestId("conn-status")
  await expect(status).toContainText("连接中")
  await response
  await expect(page.getByTestId("node-card")).toHaveCount(16)
  await expect(status).toContainText("已连接")
  await expect(status).not.toContainText(/连接中|实时更新|轮询更新/)
})


test("v1.3: the expiry column shows full prices at 1280px", async ({ page }) => {
  const examples = [
    { id: 4, name: "北京 01", price: 1188, currency: "CNY", billing_cycle: "monthly", amount: /1,188/ },
    { id: 3, name: "硅谷 01", price: 57.6, currency: "USD", billing_cycle: "yearly", amount: /57\.60/ },
    { id: 14, name: "东京 02", price: 629, currency: "CNY", billing_cycle: "once", amount: /629/ },
  ]
  await page.setViewportSize({ width: 1280, height: 900 })
  // Preserve the sample prices: the mock's unmodified WS pushes would replace the HTTP fixture.
  await page.routeWebSocket(wsRoute, () => {})
  await page.route((url) => url.pathname === nodesPath, async (route) => {
    const response = await route.fetch()
    if (!response.ok()) return route.fulfill({ response })
    const snapshot = await response.json() as { nodes: { id: number }[] }
    const nodes = snapshot.nodes.map((node) => {
      const sample = examples.find(({ id }) => id === node.id)
      return sample ? { ...node, price: sample.price, currency: sample.currency, billing_cycle: sample.billing_cycle } : node
    })
    await route.fulfill({ response, json: { ...snapshot, nodes } })
  })
  await page.goto(mockUrl("normal"))
  const cards = page.getByTestId("node-card")
  await expect(cards).toHaveCount(16)
  await page.evaluate(() => document.fonts.ready.then(() => undefined))

  for (const sample of examples) {
    const column = cards.filter({ hasText: sample.name }).getByText("到期", { exact: true }).locator("..")
    const price = column.getByText(sample.amount)
    await expect(price).toBeVisible()
    const { scrollWidth, clientWidth, text } = await price.evaluate((element) => {
      let line = element
      // An inline price label can be inside a block controlling the available width.
      while (!line.clientWidth && line.parentElement) line = line.parentElement
      return { scrollWidth: line.scrollWidth, clientWidth: line.clientWidth, text: element.textContent?.trim() }
    })
    expect(clientWidth, `${sample.name}: price line should have a layout width`).toBeGreaterThan(0)
    expect(scrollWidth, `${sample.name}: ${text} needs ${scrollWidth}px in a ${clientWidth}px column`).toBeLessThanOrEqual(clientWidth)
  }
})

test("v1.3: all detail range buttons share one row at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 })
  await page.goto(mockUrl("normal", "/node/1"))
  const range = page.getByRole("group", { name: "时间范围" })
  const buttons = range.getByTestId("range-btn")
  await expect(buttons).toHaveCount(6)
  await expect(range).toHaveCSS("overflow-x", "auto")
  await expect(buttons.first()).toBeVisible()
  const tops = await buttons.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top))
  expect(Math.max(...tops) - Math.min(...tops), `Range button top coordinates: ${tops.join(", ")}`).toBeLessThan(1)
})
