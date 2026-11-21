import { expect, test } from "@playwright/test"
import { mockUrl } from "../fixtures/mock-origins"
import { ipsbResponse, ipwhoResponse } from "../fixtures/visitor-geo"
import { countGeoRequests, fulfillGeo, mockGeo } from "./helpers"

// Activate after Antigravity's v1.1 UI build is integrated. These are contract tests, not snapshots.
test.beforeEach(async ({ page }) => { await mockGeo(page, "fail") })

test.fixme("v1.1: public visitors see neither an admin link nor login text; admins see /admin", async ({ page }) => {
  await page.goto(mockUrl("normal"))
  await expect(page.getByTestId("node-card")).toHaveCount(16)
  await expect(page.getByTestId("admin-link")).toHaveCount(0)
  await expect(page.locator('a[href="/admin"]')).toHaveCount(0)
  await expect(page.locator("body")).not.toContainText("登录")

  await page.goto(mockUrl("admin"))
  await expect(page.getByTestId("admin-link")).toBeVisible()
  await expect(page.getByTestId("admin-link")).toHaveAttribute("href", "/admin")
})

test.fixme("v1.1: dark OS preference and old storage do not add dark mode or any color-scheme control", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" })
  await page.addInitScript(() => localStorage.setItem("theme", "dark"))
  await page.goto(mockUrl("normal"))
  await expect(page.getByTestId("node-card")).toHaveCount(16)
  await expect(page.locator("html.dark")).toHaveCount(0)
  await expect(page.getByRole("button", { name: /浅色|深色|配色/ })).toHaveCount(0)
  await expect(page.getByRole("combobox", { name: /浅色|深色|配色/ })).toHaveCount(0)
})

test.fixme("v1.1: IP.SB visitor location, expandable panel and same-session cache", async ({ page }) => {
  const requests = countGeoRequests(page)
  await mockGeo(page, "ipsb")
  await page.goto(mockUrl("normal"))
  const bubble = page.getByTestId("visitor-bubble")
  await expect(bubble).toContainText(ipsbResponse.city)
  await expect(bubble).toContainText(/Chrome/i)
  await expect(page.getByTestId("visitor-panel")).toBeHidden()
  await bubble.getByText(ipsbResponse.city, { exact: false }).click()
  const panel = page.getByTestId("visitor-panel")
  await expect(panel).toBeVisible()
  await expect(panel).toContainText(ipsbResponse.ip)
  await expect(panel).toContainText(ipsbResponse.isp)
  expect(requests).toEqual({ ipsb: 1, ipwho: 0 })
  await page.reload()
  await expect(bubble).toContainText(ipsbResponse.city)
  expect(requests).toEqual({ ipsb: 1, ipwho: 0 })
})

test.fixme("v1.1: visitor location falls back from IP.SB to ipwho.is", async ({ page }) => {
  const requests = countGeoRequests(page)
  await mockGeo(page, "ipwho")
  await page.goto(mockUrl("normal"))
  await expect(page.getByTestId("visitor-bubble")).toContainText(ipwhoResponse.city)
  expect(requests).toEqual({ ipsb: 1, ipwho: 1 })
})

test.fixme("v1.1: both GeoIP failures leave browser-only visitor bubble", async ({ page }) => {
  const requests = countGeoRequests(page)
  const geoFailure = page.waitForResponse((response) => new URL(response.url()).hostname === "ipwho.is")
  await page.goto(mockUrl("normal"))
  await geoFailure
  const bubble = page.getByTestId("visitor-bubble")
  await expect(bubble).toContainText(/Chrome/i)
  await expect(bubble).not.toContainText(/Tokyo|Frankfurt|Reserved range|未知地区/)
  await expect(bubble.locator("img")).toHaveCount(0)
  expect(requests).toEqual({ ipsb: 1, ipwho: 1 })
})

test.fixme("v1.1: visitor_info_enabled=false hides the bubble and sends zero provider requests", async ({ page }) => {
  const requests = countGeoRequests(page)
  const config = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/themes/dys/config")
  await page.goto(mockUrl("config"))
  expect(await (await config).json()).toMatchObject({ visitor_info_enabled: false })
  // Controls that depend on the config prove the page applied it before checking absence.
  await expect(page.getByTestId("announcement")).toBeVisible()
  await expect(page.getByTestId("node-row")).toHaveCount(16)
  await expect(page.getByTestId("visitor-bubble")).toHaveCount(0)
  await expect(page.getByTestId("visitor-panel")).toHaveCount(0)
  expect(requests).toEqual({ ipsb: 0, ipwho: 0 })
})

test.fixme("v1.1: untrusted GeoIP location fields are rendered as text, not img elements", async ({ page }) => {
  const path = "/__geo_injection_probe__"
  const locationText = `<img src="${path}">`
  await page.route("https://api.ip.sb/**", (route) => fulfillGeo(route, {
    ...ipsbResponse, city: locationText, region: locationText,
  }))
  await page.goto(mockUrl("normal"))
  const bubble = page.getByTestId("visitor-bubble")
  await expect(bubble).toContainText(locationText)
  // Legitimate local flag images are allowed; assert the injected tag never becomes an element.
  await expect(page.locator(`img[src*="${path}"]`)).toHaveCount(0)
})

for (const [width, minimum] of [[1280, 4], [1440, 5]] as const) {
  test.fixme(`v1.1: compact layout fits at least ${minimum} first-row cards at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(mockUrl("normal"))
    const cards = page.getByTestId("node-card")
    await expect(cards).toHaveCount(16)
    await expect.poll(() => cards.evaluateAll((elements) => {
      const tops = elements.map((element) => element.getBoundingClientRect().top)
      const first = Math.min(...tops)
      return tops.filter((top) => Math.abs(top - first) < 1).length
    })).toBeGreaterThanOrEqual(minimum)
  })
}

for (const { currency, amount, skipped } of [
  { currency: "CNY", amount: 60 * 3 / 30.4375, skipped: 10 },
  { currency: "USD", amount: (360 / 60 * 60 + 120 / 3 * 15) / 30.4375, skipped: 9 },
]) {
  test.fixme(`v1.1: six summary tiles and remaining value only in ${currency}`, async ({ page }) => {
    if (currency !== "CNY") await page.route("**/api/themes/dys/config", (route) => route.fulfill({ json: { finance_currency: currency } }))
    await page.goto(mockUrl("normal"))
    const tiles = page.getByTestId("summary-tile")
    await expect(tiles).toHaveCount(6)
    const value = tiles.filter({ hasText: "剩余价值" })
    const formatted = new Intl.NumberFormat("zh-CN", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount)
    await expect(value).toContainText(formatted)
    await expect(value).toContainText(new RegExp(`${skipped}\\s*台未计入`))
  })
}

test.fixme("v1.1: desktop map has one marker per country and is hidden at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(mockUrl("normal"))
  const response = await page.request.get(mockUrl("normal", "/api/nodes"))
  const { nodes } = await response.json() as { nodes: { country: string }[] }
  const countryCount = new Set(nodes.map(({ country }) => country).filter(Boolean)).size
  expect(countryCount).toBeGreaterThanOrEqual(8)
  const map = page.getByTestId("world-map")
  await expect(map).toBeVisible()
  await expect(map.getByTestId("map-marker")).toHaveCount(countryCount)
  await page.setViewportSize({ width: 390, height: 850 })
  await expect(map).toBeHidden()
})

test.fixme("v1.1: searching for 东京 leaves only matching cards", async ({ page }) => {
  await page.goto(mockUrl("normal"))
  const cards = page.getByTestId("node-card")
  await expect(cards).toHaveCount(16)
  await page.getByTestId("search-input").fill("东京")
  await expect(cards).toHaveCount(2)
  await expect(cards).toContainText(["东京 01", "东京 02"])
})

test.fixme("v1.1: CPU sort orders cards descending and persists on reload", async ({ page }) => {
  const snapshot = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/nodes")
  await page.goto(mockUrl("normal"))
  const { nodes } = await (await snapshot).json() as { nodes: { name: string; metrics: { cpu: number } | null }[] }
  const ranked = nodes.filter(({ metrics }) => metrics !== null).sort((a, b) => b.metrics!.cpu - a.metrics!.cpu).map(({ name }) => name)
  const cards = page.getByTestId("node-card")
  const withCpu = cards.filter({ hasNotText: /香港 01|巴黎 01/ })
  const select = page.getByTestId("sort-select")
  await select.selectOption("cpu")
  await expect(withCpu).toContainText(ranked)
  await page.reload()
  await expect(select).toHaveValue("cpu")
  await expect(withCpu).toContainText(ranked)
})

test.fixme("v1.1: detail previous/next navigation, four resource charts and opt-in peak legend", async ({ page }) => {
  await page.goto(mockUrl("normal", "/node/2"))
  const switcher = page.getByTestId("node-switcher")
  await switcher.getByRole("button", { name: /上一个|上一台/ }).click()
  await expect(page).toHaveURL(mockUrl("normal", "/node/1"))
  await switcher.getByRole("button", { name: /下一个|下一台/ }).click()
  await expect(page).toHaveURL(mockUrl("normal", "/node/2"))

  const chartFor = (label: RegExp) => page.getByTestId("chart").filter({ has: page.getByRole("heading", { name: label }) })
  const cpu = chartFor(/^CPU 使用率$/i)
  await expect(cpu).toBeVisible()
  const resourceGrid = cpu.locator("..").getByTestId("chart")
  await expect(resourceGrid).toHaveCount(4)
  for (const label of [/^CPU 使用率$/i, /^内存(?:用量|使用)$/, /^(?:硬盘|磁盘)(?:用量|使用)$/, /^网络速率$/]) {
    const chart = resourceGrid.filter({ has: page.getByRole("heading", { name: label }) })
    await expect(chart.locator("canvas")).toBeVisible()
  }
  const peak = page.getByRole("checkbox", { name: "显示峰值" })
  await expect(peak).not.toBeChecked()
  await expect(cpu).not.toContainText("峰值")
  await peak.check()
  await expect(cpu).toContainText("峰值")
})
