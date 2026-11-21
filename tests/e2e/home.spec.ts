import { expect, test } from "@playwright/test"
import { mockUrl } from "../fixtures/mock-origins"

const longRanges = ["1 小时", "6 小时", "1 天", "7 天", "30 天", "90 天"]

test("normal: 12 cards, first-seen groups, and filtered summary totals", async ({ page }) => {
  await page.goto(mockUrl("normal"))
  const cards = page.getByTestId("node-card")
  const tabs = page.getByTestId("group-tab")
  const summary = page.getByTestId("summary")
  await expect(cards).toHaveCount(12)
  await expect(tabs).toHaveText(["全部 12", "亚太 3", "欧洲 3", "美洲 3", "未分组 3"])
  await expect(summary).toContainText("10 / 12")
  await expect(summary).toContainText("390 GB")

  const ungrouped = page.getByRole("tab", { name: /^未分组/ })
  await ungrouped.click()
  await expect(ungrouped).toHaveAttribute("aria-selected", "true")
  await expect(cards).toHaveCount(3)
  await expect(cards.getByRole("heading")).toHaveText(["北京 01", "悉尼 01", "首尔 01"])
  await expect(summary).toContainText("3 / 3")
  await expect(summary).toContainText("125 GB")
})

test("normal: table layout is restored after a reload", async ({ page }) => {
  await page.goto(mockUrl("normal"))
  await expect(page.getByTestId("node-card")).toHaveCount(12)
  await page.getByRole("button", { name: "切换为列表视图" }).click()
  await expect(page.getByTestId("node-row")).toHaveCount(12)
  await page.reload()
  await expect(page.getByTestId("node-row")).toHaveCount(12)
  await expect(page.getByTestId("node-card")).toHaveCount(0)
})

test("normal: opening a card renders charts; changing the range requests both history series", async ({ page }) => {
  await page.goto(mockUrl("normal"))
  await page.getByTestId("node-card").filter({ hasText: "东京 01" }).click()
  await expect(page).toHaveURL(mockUrl("normal", "/node/1"))
  await expect(page.getByRole("heading", { name: "东京 01" })).toBeVisible()
  await expect(page.getByTestId("chart").filter({ hasText: "CPU 使用率" }).locator("canvas")).toBeVisible()
  const requests = ["metrics", "ping"].map((series) => page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === "/api/nodes/1/metrics" && url.searchParams.get("hours") === "720" && url.searchParams.get("series") === series
  }))
  const month = page.getByRole("button", { name: "30 天", exact: true })
  await month.click()
  await expect(month).toHaveAttribute("aria-pressed", "true")
  for (const request of await Promise.all(requests)) {
    const points = Number(new URL(request.url()).searchParams.get("points"))
    expect(points).toBeGreaterThanOrEqual(60)
    expect(points).toBeLessThanOrEqual(1440)
  }
})

test("normal: /node/1 loads directly with all 90-day history ranges", async ({ page }) => {
  const response = await page.goto(mockUrl("normal", "/node/1"))
  expect(response?.status()).toBe(200)
  await expect(page).toHaveTitle("东京 01 · DYS Mock Hub")
  await expect(page.getByTestId("range-btn")).toHaveText(longRanges)
  await expect(page.getByTestId("chart").filter({ hasText: "网络速率" }).locator("canvas")).toBeVisible()
  const ping = page.getByTestId("chart").filter({ hasText: "Ping 延迟" })
  await expect(ping).toContainText(/东京探测.*法兰克福探测/)
  await expect(page.locator("dl")).toContainText(/总 ↓ 38\.0 GB ↑ 23\.0 GB/)
})

test("normal: 360px layout has no document overflow and dark mode toggles html.dark", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto(mockUrl("normal"))
  await expect(page.getByTestId("node-card")).toHaveCount(12)
  expect(await page.evaluate(() => window.innerWidth)).toBe(360)
  const horizontalScroll = () => page.evaluate(() => {
    window.scrollTo({ left: 10_000, top: window.scrollY, behavior: "instant" })
    return window.scrollX
  })
  await expect.poll(horizontalScroll).toBe(0)
  const html = page.locator("html")
  await expect(html).not.toHaveClass(/\bdark\b/)
  await page.getByRole("button", { name: "切换为深色模式" }).click()
  await expect(html).toHaveClass(/\bdark\b/)
  await page.reload()
  await expect(html).toHaveClass(/\bdark\b/)
  await page.goto(mockUrl("normal", "/node/1"))
  await expect(page.getByTestId("chart").filter({ hasText: "CPU 使用率" }).locator("canvas")).toBeVisible()
  await expect.poll(horizontalScroll).toBe(0)
})
