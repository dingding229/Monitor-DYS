import { expect, test } from "@playwright/test"
import { mockUrl } from "../fixtures/mock-origins"
import { mockGeo, mockRates } from "./helpers"

test.beforeEach(async ({ page }) => {
  await mockGeo(page, "fail")
  await mockRates(page, "fail")
})

test("corrupt: bad CPU and load are unavailable; a healthy node still shows metrics", async ({ page }) => {
  await page.goto(mockUrl("corrupt"))
  const cards = page.getByTestId("node-card")
  await expect(cards).toHaveCount(16)
  await expect(page.getByTestId("status-unavailable")).toHaveText(["不可用", "不可用"])
  const healthy = cards.filter({ hasText: "硅谷 01" })
  await expect(healthy.getByText(/CPU/)).toBeVisible()
  await expect(healthy.getByTestId("status-unavailable")).toHaveCount(0)
})

test("waiting: online without a report shows waiting rather than unavailable", async ({ page }) => {
  await page.goto(mockUrl("waiting"))
  const card = page.getByTestId("node-card").filter({ hasText: "东京 01" })
  await expect(card.getByTestId("status-waiting")).toHaveText("等待数据")
  await expect(card.getByTestId("status-unavailable")).toHaveCount(0)
})

test("private: renders login-required with the admin route", async ({ page }) => {
  await page.goto(mockUrl("private"))
  const gate = page.getByTestId("login-required")
  await expect(gate).toContainText("需要登录后查看")
  await expect(gate.getByRole("link")).toHaveAttribute("href", "/admin")
  await expect(page.getByTestId("node-card")).toHaveCount(0)
})

test("proxy502: shows the status code, not the proxy's HTML body", async ({ page }) => {
  await page.goto(mockUrl("proxy502"))
  await expect(page.getByRole("alert")).toContainText("HTTP 502")
  await expect(page.locator("body")).not.toContainText("502 Bad Gateway")
  await expect(page.getByTestId("node-card")).toHaveCount(0)
})

test("legacy-1.2: renders history without current-only data and offers the seven-day fallback", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto(mockUrl("legacy-1.2"))
  await expect(page.getByTestId("node-card")).toHaveCount(16)
  await expect(page.getByTestId("group-tab")).toHaveCount(0)
  await page.getByTestId("node-card").filter({ hasText: "东京 01" }).click()
  await expect(page.getByTestId("range-btn")).toHaveText(["1 小时", "6 小时", "1 天", "7 天"])
  const cpu = page.getByTestId("chart").filter({ hasText: "CPU 使用率" })
  await expect(cpu.locator("canvas")).toBeVisible()
  await expect(cpu).not.toContainText("峰值")
  await expect(page.getByRole("alert")).toHaveCount(0)
  await expect(page.getByText(/读取历史数据失败/)).toHaveCount(0)
  expect(errors).toEqual([])
})

test("nogroups: omits the entire group tab list", async ({ page }) => {
  await page.goto(mockUrl("nogroups"))
  await expect(page.getByTestId("node-card")).toHaveCount(16)
  await expect(page.getByTestId("group-tab")).toHaveCount(0)
  await expect(page.getByRole("tablist")).toHaveCount(0)
})

test("allgrouped: shows real groups but no ungrouped tab", async ({ page }) => {
  await page.goto(mockUrl("allgrouped"))
  await expect(page.getByTestId("node-card")).toHaveCount(16)
  await expect(page.getByTestId("group-tab")).toHaveCount(4)
  await expect(page.getByRole("tab", { name: /^未分组/ })).toHaveCount(0)
})

test("anonymous: only the public nodes are displayed", async ({ page }) => {
  await page.goto(mockUrl("anonymous"))
  await expect(page.getByTestId("node-card")).toHaveCount(15)
  await expect(page.getByRole("heading", { name: "首尔 01" })).toHaveCount(0)
})

test("config: applies valid settings, falls back for an invalid accent, and renders announcement as text", async ({ page }) => {
  const dialogs: string[] = []
  page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss() })
  await page.goto(mockUrl("config"))
  await expect(page.getByTestId("node-row")).toHaveCount(16)
  await expect(page.getByTestId("summary-tile")).toHaveCount(0)
  const html = page.locator("html")
  await expect.poll(() => html.evaluate((element) => element.style.getPropertyValue("--accent").trim())).toBe("#10b981")

  const announcement = page.getByTestId("announcement")
  await expect(announcement).toContainText("<img src=x onerror=alert(1)>")
  await expect(announcement).toHaveCSS("white-space", "pre-line")
  expect(await announcement.textContent()).toMatch(/今晚维护\s*\n\s*第二行/)
  await expect(announcement.locator("img")).toHaveCount(0)
  await expect(page.locator('img[src="x"]')).toHaveCount(0) // country flags are real images elsewhere
  expect(dialogs).toEqual([])

  await page.locator("main").getByRole("button", { name: "卡片视图" }).click()
  await page.reload()
  await expect(page.getByTestId("announcement")).toBeVisible()
  await expect(page.getByTestId("node-card")).toHaveCount(16)
})
