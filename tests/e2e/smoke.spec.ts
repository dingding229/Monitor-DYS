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

test("home renders six summary tiles, 16 cards and a map from one HTTP snapshot", async ({ page }) => {
  let nodeGets = 0
  page.on("request", (request) => { if (request.method() === "GET" && pathIs(request.url(), nodesPath)) nodeGets++ })
  await page.goto(mockUrl("normal"))
  const summary = page.getByTestId("summary")
  await expect(summary.getByTestId("summary-tile")).toHaveCount(6)
  await expect(summary.getByTestId("summary-servers")).toContainText(/\b14\s*\/\s*16\b/)
  await expect(page.getByTestId("node-card")).toHaveCount(16)
  const map = page.getByTestId("world-map")
  await expect(map).toBeVisible()
  await expect(map.getByTestId("map-country")).toHaveCount(12)
  expect(nodeGets).toBe(1)
})

test("list columns put name first, status last and Ping next to the rates", async ({ page }) => {
  await page.goto(mockUrl("normal"))
  await page.getByRole("button", { name: "列表视图" }).click()
  const headers = page.getByRole("table").getByRole("columnheader")
  await expect(headers).toHaveText(["名称", "地区", "CPU", "内存", "硬盘", "↑", "↓", "延迟", "丢包", "本期流量", "到期", "状态"])
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
  for (const label of [/负载/, /进程/, /TCP\s*\/\s*UDP/, /运行/]) await expect(stats).toContainText(label)
  await expect(nameCard.getByTestId("chart")).toHaveCount(0)
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

test("visible home card loads and displays latency and zero loss", async ({ page }) => {
  const pending = firstNodePing(page)
  await page.goto(mockUrl("normal"))
  await tokyo(page).scrollIntoViewIfNeeded()
  const response = await pending
  expect(await response.json()).toMatchObject({ metrics: [], loss: { 9: 0, 2: 0 } })
  const ping = tokyo(page).getByTestId("node-ping")
  await expect(ping).toHaveAttribute("data-latency", "42")
  await expect(ping).toHaveAttribute("data-loss", /^0(?:\.0+)?$/)
  await expect(ping).toContainText(/42\s*ms/)
  await expect(ping).toContainText(/0\s*%/)
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
