import { expect, test } from "@playwright/test"
import { mockUrl } from "../fixtures/mock-origins"
import { mockGeo } from "./helpers"

test.beforeEach(async ({ page }) => {
  await mockGeo(page, "fail")
})

const longRanges = ["1 小时", "6 小时", "1 天", "7 天", "30 天", "90 天"]

test("normal: 16 cards, first-seen groups, and ungrouped filtering", async ({ page }) => {
  await page.goto(mockUrl("normal"))
  const cards = page.getByTestId("node-card")
  const tabs = page.getByTestId("group-tab")
  const summary = page.getByTestId("summary")
  await expect(cards).toHaveCount(16)
  await expect(tabs).toHaveText(["全部 16", "亚太 4", "欧洲 4", "美洲 4", "未分组 4"])
  await expect(summary).toContainText(/\b14\s*\/\s*16\b/)
  await expect(summary).toContainText(/680\s*GB/)

  const ungrouped = page.getByRole("tab", { name: /^未分组/ })
  await ungrouped.click()
  await expect(ungrouped).toHaveAttribute("aria-selected", "true")
  await expect(cards).toHaveCount(4)
  await expect(cards).toContainText(["北京 01", "悉尼 01", "首尔 01", "东京 02"])
  await expect(summary).toContainText(/\b4\s*\/\s*4\b/)
  await expect(summary).toContainText(/195\s*GB/)
})

test("normal: table layout is restored after a reload", async ({ page }) => {
  await page.goto(mockUrl("normal"))
  await expect(page.getByTestId("node-card")).toHaveCount(16)
  await page.locator("main").getByRole("button", { name: "列表视图" }).click()
  await expect(page.getByTestId("node-row")).toHaveCount(16)
  await page.reload()
  await expect(page.getByTestId("node-row")).toHaveCount(16)
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
  const range = page.getByRole("group", { name: "时间范围" })
  const month = range.getByTestId("range-btn").filter({ hasText: /^30 天$/ })
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
  await expect(page.getByRole("combobox", { name: /时间范围/ })).toHaveCount(0)
  await expect(page.getByTestId("chart").filter({ hasText: "网络速率" }).locator("canvas")).toBeVisible()
  const ping = page.getByTestId("chart").filter({ hasText: "Ping 延迟" })
  await expect(ping).toContainText(/东京探测.*法兰克福探测/)
})

test("normal: 360px home and detail have no document overflow", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto(mockUrl("normal"))
  await expect(page.getByTestId("node-card")).toHaveCount(16)
  expect(await page.evaluate(() => window.innerWidth)).toBe(360)
  const horizontalScroll = () => page.evaluate(() => {
    window.scrollTo({ left: 10_000, top: window.scrollY, behavior: "instant" })
    return window.scrollX
  })
  await expect.poll(horizontalScroll).toBe(0)
  await page.goto(mockUrl("normal", "/node/1"))
  await expect(page.getByTestId("chart").filter({ hasText: "CPU 使用率" }).locator("canvas")).toBeVisible()
  await expect.poll(horizontalScroll).toBe(0)
})
