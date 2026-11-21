import { expect, test, type WebSocketRoute } from "@playwright/test"
import { rateDate, ratesPerCny } from "../fixtures/exchange-rates"
import { mockUrl } from "../fixtures/mock-origins"
import { ipsbResponse } from "../fixtures/visitor-geo"
import { countRateRequests, fulfillGeo, mockGeo, mockRates } from "./helpers"

test.beforeEach(async ({ page }) => {
  await mockGeo(page, "fail")
  await mockRates(page, "fail")
})

const cny = (amount: number) => new Intl.NumberFormat("zh-CN", {
  style: "currency", currency: "CNY", maximumFractionDigits: 2,
}).format(amount)

// Original-currency numerator of remaining value (monthly fee × remaining days)
// for the 11 estimable normal Mock Hub plans; expired and one-time plans are excluded.
const original = { CNY: 180, USD: 960, EUR: 1940, JPY: 34900, GBP: 150, CAD: 225, SGD: (120.5 / 18) * 5, KRW: 60_000 }
const convertedCny = (Object.keys(original) as (keyof typeof original)[])
  .reduce((sum, code) => sum + original[code] / ratesPerCny[code], 0) / 30.4375

for (const mode of ["open", "cdn"] as const) {
  test(`v1.2: ${mode} rates include all currencies and display their quote date`, async ({ page }) => {
    const requests = countRateRequests(page)
    await mockRates(page, mode)
    await page.goto(mockUrl("normal"))
    const tile = page.getByTestId("summary-tile").filter({ hasText: "剩余价值" })
    await expect(tile.getByTestId("remaining-value")).toHaveText(cny(convertedCny))
    await expect(tile.getByTestId("rate-date")).toContainText(`按 ${rateDate} 汇率折算`)
    await expect(tile).not.toContainText(/未计入|汇率不可用/)
    expect(requests).toEqual({ open: 1, cdn: mode === "cdn" ? 1 : 0 })
  })
}

test("v1.2: hovering the value tile opens its original/converted currency breakdown", async ({ page }) => {
  await mockRates(page, "open")
  await page.goto(mockUrl("normal"))
  const tile = page.getByTestId("summary-tile").filter({ hasText: "剩余价值" })
  await expect(tile.getByTestId("rate-date")).toBeVisible()
  const breakdown = page.getByTestId("value-breakdown")
  await expect(breakdown).toBeHidden()
  await tile.getByTestId("remaining-value").hover()
  await expect(breakdown).toBeVisible()
  for (const code of ["CNY", "CAD", "GBP", "USD"]) await expect(breakdown).toContainText(code)
  await expect(breakdown).toContainText(cny(original.CAD / 30.4375 / ratesPerCny.CAD))
})

test("v1.2: both failed rate providers leave only CNY and show 汇率不可用", async ({ page }) => {
  const requests = countRateRequests(page)
  await page.goto(mockUrl("normal"))
  const tile = page.getByTestId("summary-tile").filter({ hasText: "剩余价值" })
  await expect(tile).toContainText(/10\s*台未计入\s*·\s*汇率不可用/)
  await expect(tile.getByTestId("remaining-value")).toHaveText(cny(original.CNY / 30.4375))
  await expect(tile.getByTestId("rate-date")).toHaveCount(0)
  expect(requests).toEqual({ open: 1, cdn: 1 })
})

test("v1.2: config disabling rates sends no request before or after config loads", async ({ page }) => {
  const requests = countRateRequests(page)
  let release!: () => void
  const held = new Promise<void>((resolve) => { release = resolve })
  await page.route("**/api/themes/dys/config", async (route) => {
    await held
    await route.continue()
  })
  const config = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/themes/dys/config")
  try {
    await page.goto(mockUrl("config"))
    await expect(page.getByTestId("node-card")).toHaveCount(16)
    expect(requests).toEqual({ open: 0, cdn: 0 })
  } finally { release() }
  expect(await (await config).json()).toMatchObject({ exchange_rate_enabled: false })
  await expect(page.getByTestId("node-row")).toHaveCount(16)
  // Intentional observation window for a negative network assertion.
  await page.waitForTimeout(1_000)
  expect(requests).toEqual({ open: 0, cdn: 0 })
})

test("v1.2: card bottom has three equal-width columns without boxes or fills", async ({ page }) => {
  await page.goto(mockUrl("normal"))
  const card = page.getByTestId("node-card").filter({ hasText: "东京 01" })
  const row = card.getByText("实时速率", { exact: true }).locator("xpath=../..")
  const columns = row.locator(":scope > *")
  await expect(columns).toHaveCount(3)
  await expect(columns).toContainText(["实时速率", "当期流量", "到期与价值"])
  const { container, cells } = await row.evaluate((element) => {
    const styles = (target: Element) => {
      const css = getComputedStyle(target)
      return {
        background: css.backgroundColor, image: css.backgroundImage,
        borders: [css.borderTopWidth, css.borderRightWidth, css.borderBottomWidth, css.borderLeftWidth],
        width: target.getBoundingClientRect().width,
      }
    }
    return { container: styles(element), cells: Array.from(element.children, styles) }
  })
  expect(container).toMatchObject({ background: "rgba(0, 0, 0, 0)", image: "none", borders: ["1px", "0px", "0px", "0px"] })
  for (const cell of cells) {
    expect(cell).toMatchObject({ background: "rgba(0, 0, 0, 0)", image: "none", borders: ["0px", "0px", "0px", "0px"] })
    expect(Math.abs(cell.width - cells[0].width)).toBeLessThan(1)
  }
})

test("v1.2: Debian and iStoreOS use their specified brand icon keys", async ({ page }) => {
  await page.goto(mockUrl("normal"))
  const cards = page.getByTestId("node-card")
  await expect(cards.filter({ hasText: "东京 01" }).locator('[data-testid="brand-icon"][data-key="debian"]')).toBeVisible()
  await expect(cards.filter({ hasText: "新加坡 01" }).locator('[data-testid="brand-icon"][data-key="openwrt"]')).toBeVisible()
})

test("v1.2: visitor bubble localizes Hong Kong and renders the browser icon", async ({ page }) => {
  await page.route("https://api.ip.sb/**", (route) => fulfillGeo(route, {
    ...ipsbResponse, country_code: "HK", country: "Hong Kong", region: "Kowloon", city: "Kowloon City",
  }))
  await page.goto(mockUrl("normal"))
  const bubble = page.getByTestId("visitor-bubble")
  await expect(bubble.getByText("香港", { exact: true })).toBeVisible()
  await expect(bubble).not.toContainText("Kowloon City")
  await expect(bubble.locator('[data-testid="brand-icon"][data-key="chrome"]')).toBeVisible()
  await bubble.getByText("香港", { exact: true }).click()
  await expect(page.getByTestId("visitor-panel")).toContainText("Kowloon City")
})

test("v1.2: no view toggle in either header; home toolbar toggles both layouts", async ({ page }) => {
  await page.goto(mockUrl("normal"))
  const header = page.getByRole("banner")
  const viewNames = /^(?:切换为)?(?:卡片|列表)(?:视图)?$/
  await expect(header.getByRole("button", { name: viewNames })).toHaveCount(0)
  const toolbar = page.locator("main")
  await toolbar.getByRole("button", { name: "列表视图" }).click()
  await expect(page.getByTestId("node-row")).toHaveCount(16)
  await toolbar.getByRole("button", { name: "卡片视图" }).click()
  await expect(page.getByTestId("node-card")).toHaveCount(16)
  await page.getByTestId("node-card").filter({ hasText: "东京 01" }).click()
  await expect(page).toHaveURL(mockUrl("normal", "/node/1"))
  await expect(header.getByRole("button", { name: viewNames })).toHaveCount(0)
})

test("v1.2: connection starts at 连接中 and switches to live only after a frame", async ({ page }) => {
  const snapshot = await page.request.get(mockUrl("normal", "/api/nodes"))
  const frame = await snapshot.text()
  let socket: WebSocketRoute | undefined
  await page.routeWebSocket(/\/api\/ws(?:\?.*)?$/, (route) => { socket = route })
  let release!: () => void
  const held = new Promise<void>((resolve) => { release = resolve })
  await page.route("**/api/nodes", async (route) => { await held; await route.continue() })
  const status = page.getByTestId("conn-status")
  try {
    await page.goto(mockUrl("normal"))
    await expect(status).toContainText("连接中")
    await expect(status).not.toContainText("轮询更新")
  } finally { release() }
  await expect.poll(() => Boolean(socket)).toBe(true)
  socket!.send(frame)
  await expect(status).toContainText("实时更新")
})

test("v1.2: node cards have native hrefs and ordinary clicks stay in the SPA document", async ({ page }) => {
  await page.goto(mockUrl("normal"))
  const token = "t10-document-token"
  await page.evaluate((value) => document.documentElement.setAttribute("data-t10-document", value), token)
  let documentNavigations = 0
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documentNavigations++
  })
  const card = page.getByTestId("node-card").and(page.getByRole("link", { name: /东京 01/ }))
  await expect(card).toHaveAttribute("href", "/node/1")
  expect(await card.evaluate((element) => element.tagName)).toBe("A")
  await card.click()
  await expect(page).toHaveURL(mockUrl("normal", "/node/1"))
  await expect(page.getByRole("heading", { name: "东京 01" })).toBeVisible()
  await expect(page.locator("html")).toHaveAttribute("data-t10-document", token)
  expect(documentNavigations).toBe(0)
})

test("v1.2: map counts match the API and clicking a country filters cards and summary until cleared", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const response = await page.request.get(mockUrl("normal", "/api/nodes"))
  expect(response.ok()).toBe(true)
  const { nodes } = await response.json() as { nodes: { country: string }[] }
  const byCountry = new Map<string, number>()
  for (const { country } of nodes) byCountry.set(country, (byCountry.get(country) ?? 0) + 1)
  await page.goto(mockUrl("normal"))
  const map = page.getByTestId("world-map")
  await expect(map).toBeVisible()
  const countries = map.getByTestId("map-country")
  await expect(countries).toHaveCount(byCountry.size)
  const render = await countries.evaluateAll((elements) => elements.map((element) => ({
    country: element.getAttribute("data-country"), count: Number(element.getAttribute("data-count")),
  })))
  expect(render.reduce((sum, { count }) => sum + count, 0)).toBe(nodes.length)
  expect(render.map(({ country }) => country).sort()).toEqual([...byCountry.keys()].sort())
  for (const { country, count } of render) expect(count).toBe(byCountry.get(country!))

  const summary = page.getByTestId("summary")
  const cards = page.getByTestId("node-card")
  await expect(summary).toContainText(/680\s*GB/)
  await countries.and(page.locator('[data-country="CN"]')).click()
  const chip = page.getByTestId("country-filter-chip")
  await expect(chip).toContainText("中国")
  await expect(cards).toHaveCount(2)
  await expect(cards).toContainText(["北京 01", "上海 01"])
  await expect(summary).toContainText(/85(?:\.0+)?\s*GB/)
  await expect(chip).toHaveRole("button")
  await chip.click()
  await expect(chip).toHaveCount(0)
  await expect(cards).toHaveCount(nodes.length)
  await expect(summary).toContainText(/680\s*GB/)
})

test("v1.2: mobile hides the map but a country-list row applies the same filter", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 })
  await page.goto(mockUrl("normal"))
  await expect(page.getByTestId("world-map")).toBeHidden()
  const list = page.getByTestId("country-list")
  await expect(list).toBeVisible()
  const hongKong = list.getByTestId("country-row").and(page.locator('[data-country="HK"]'))
  await expect(hongKong).toContainText("香港")
  await hongKong.click()
  await expect(page.getByTestId("country-filter-chip")).toContainText("香港")
  const cards = page.getByTestId("node-card")
  await expect(cards).toHaveCount(1)
  await expect(cards.first()).toContainText("香港 01")
  await expect(page.getByTestId("summary")).toContainText(/25(?:\.0+)?\s*GB/)
})

type CanvasLabel = { text: string; x: number; left: number; right: number; top: number; bottom: number }
type CanvasProbeWindow = Window & { t10CanvasText?: WeakMap<HTMLCanvasElement, CanvasLabel[]> }

test("v1.2: four points in a 30-day range draw unique MM-DD ticks without clipping the last label", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() => {
    const labels = new WeakMap<HTMLCanvasElement, CanvasLabel[]>()
    const probe = window as CanvasProbeWindow
    probe.t10CanvasText = labels
    const context = CanvasRenderingContext2D.prototype
    const originalClear = context.clearRect
    context.clearRect = function (x, y, width, height) {
      if (x === 0 && y === 0 && width >= this.canvas.width && height >= this.canvas.height) labels.delete(this.canvas)
      originalClear.call(this, x, y, width, height)
    }
    const originalFill = context.fillText
    context.fillText = function (text, x, y, maxWidth?) {
      if (/\d{2}[-/:]\d{2}/.test(text)) {
        const metrics = this.measureText(text)
        const matrix = this.getTransform()
        // TextMetrics are relative to the drawing origin with its current textAlign and baseline.
        const corners = [x - metrics.actualBoundingBoxLeft, x + metrics.actualBoundingBoxRight].flatMap((tx) =>
          [y - metrics.actualBoundingBoxAscent, y + metrics.actualBoundingBoxDescent].map((ty) => matrix.transformPoint({ x: tx, y: ty })),
        )
        const marks = labels.get(this.canvas) ?? []
        marks.push({
          text, x: matrix.transformPoint({ x, y }).x,
          left: Math.min(...corners.map((point) => point.x)), right: Math.max(...corners.map((point) => point.x)),
          top: Math.min(...corners.map((point) => point.y)), bottom: Math.max(...corners.map((point) => point.y)),
        })
        labels.set(this.canvas, marks)
      }
      if (maxWidth === undefined) originalFill.call(this, text, x, y)
      else originalFill.call(this, text, x, y, maxWidth)
    }
  })
  const isMonthHistory = (url: URL) =>
    url.pathname === "/api/nodes/1/metrics" && url.searchParams.get("hours") === "720"
  async function selectThirtyDays() {
    const response = page.waitForResponse((res) => {
      const url = new URL(res.url())
      return isMonthHistory(url) && url.searchParams.get("series") === "metrics"
    })
    await page.getByTestId("range-btn").filter({ hasText: /^30 天$/ }).click()
    return await (await response).json() as { metrics: { ts: number }[] }
  }

  const canvas = page.getByTestId("chart").filter({ hasText: "CPU 使用率" }).locator("canvas")
  const draws = () => canvas.evaluate((element: HTMLCanvasElement) => ({
    width: element.width, height: element.height,
    labels: (window as CanvasProbeWindow).t10CanvasText?.get(element) ?? [],
  }))
  async function assertDateAxis(minTicks: number) {
    await expect(canvas).toBeVisible()
    await expect.poll(async () => (await draws()).labels.filter(({ text }) => /^\d{2}-\d{2}$/.test(text)).length)
      .toBeGreaterThanOrEqual(minTicks)
    const { labels, width, height } = await draws()
    expect(labels.every(({ text }) => /^\d{2}-\d{2}$/.test(text))).toBe(true)
    // No uPlot instance or DOM tick labels are exposed; read the actual draw of this chart.
    const ticks = labels.map(({ text }) => text)
    expect(ticks, `Repeated X-axis labels on the CPU chart: ${ticks.join(", ")}`).toEqual([...new Set(ticks)])
    const last = [...labels].sort((a, b) => b.x - a.x)[0]
    expect(last.right).toBeGreaterThan(last.left)
    expect(last.bottom).toBeGreaterThan(last.top)
    expect(last.left).toBeGreaterThanOrEqual(0)
    expect(last.right).toBeLessThanOrEqual(width)
    expect(last.top).toBeGreaterThanOrEqual(0)
    expect(last.bottom).toBeLessThanOrEqual(height)
  }

  await test.step("four hourly points straddle local midnight regardless of when CI runs", async () => {
    await page.goto(mockUrl("fewpoints", "/node/1"))
    const start = await page.evaluate(() => new Date(2026, 10, 21, 22, 30).getTime() / 1000)
    const origin = new URL(mockUrl("fewpoints")).origin
    await page.route((url) => url.origin === origin && isMonthHistory(url), async (route) => {
      // Use the real fewpoints response and preserve spacing, values and bucket count.
      // Shift both series onto a known local midnight to avoid time-of-day flakiness.
      const upstream = await route.fetch()
      if (!upstream.ok()) return route.fulfill({ response: upstream })
      const history = await upstream.json() as { metrics: { ts: number }[]; ping: { ts: number }[] }
      const first = history.metrics[0] ?? history.ping[0]
      if (first) {
        const offset = start - first.ts
        for (const point of [...history.metrics, ...history.ping]) point.ts += offset
      }
      await route.fulfill({ response: upstream, json: history })
    })
    const history = await selectThirtyDays()
    expect(history.metrics).toHaveLength(4)
    expect(history.metrics.at(-1)!.ts - history.metrics[0].ts).toBe(3 * 3600)
    await assertDateAxis(1)
  })

  await test.step("a full 30-day chart renders multiple different date labels", async () => {
    await page.goto(mockUrl("normal", "/node/1"))
    const history = await selectThirtyDays()
    expect(history.metrics.length).toBeGreaterThan(4)
    await assertDateAxis(2)
  })
})
