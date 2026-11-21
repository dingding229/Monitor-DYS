import { expect, test, type Response } from "@playwright/test"
import { mockUrl } from "../fixtures/mock-origins"
import { mockGeo } from "./helpers"

test.beforeEach(async ({ page }) => { await mockGeo(page, "fail") })

const isNodes = (url: string) => new URL(url).pathname === "/api/nodes"
const isSocket = (url: string) => new URL(url).pathname === "/api/ws"

test("ws503: two fallback polls arrive within 10 seconds and update the page", async ({ page }) => {
  const snapshots: Response[] = []
  const errors: string[] = []
  page.on("response", (response) => {
    if (isNodes(response.url()) && response.ok()) snapshots.push(response)
  })
  page.on("websocket", (socket) => {
    if (isSocket(socket.url())) socket.on("socketerror", (message) => errors.push(message))
  })
  await page.goto(mockUrl("ws503"))
  await expect.poll(() => errors.join(" ")).toContain("503")
  // Initial GET plus two polls. The fixture uses a valid 2-second polling interval.
  await expect.poll(() => snapshots.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(3)
  const [first, later] = await Promise.all([snapshots[0].json(), snapshots[2].json()])
  expect(later.nodes[0].metrics.cpu).not.toBe(first.nodes[0].metrics.cpu)
  const cpuRow = page.getByTestId("node-card").filter({ hasText: "东京 01" })
    .getByText(/^CPU(?:\s+\d+\s*核)?$/).locator("xpath=ancestor::div[1]")
  const percent = cpuRow.getByText(/^\d+(?:\.\d+)?%$/)
  const initial = first.nodes[0].metrics.cpu
  await expect.poll(async () => {
    const displayed = Number((await percent.innerText()).replace("%", ""))
    const polled = await Promise.all(snapshots.slice(2).map((response) => response.json()))
    return displayed !== initial && polled.some(({ nodes }) => nodes[0].metrics.cpu === displayed)
  }).toBe(true)
})

test("config: invalid poll_interval falls back to five seconds on disconnect", async ({ page }) => {
  const requests: number[] = []
  let disconnectedAt = 0
  page.on("request", (request) => { if (isNodes(request.url())) requests.push(performance.now()) })
  await page.routeWebSocket(/\/api\/ws(?:\?.*)?$/, async (socket) => {
    disconnectedAt ||= performance.now()
    await socket.close({ code: 1013, reason: "test fallback" })
  })
  await page.goto(mockUrl("config"))
  await expect(page.getByTestId("announcement")).toBeVisible()
  await expect.poll(() => requests.length, { timeout: 9000 }).toBeGreaterThanOrEqual(2)
  expect(disconnectedAt).toBeGreaterThan(0)
  const interval = requests[1] - disconnectedAt
  expect(interval).toBeGreaterThan(4500)
  expect(interval).toBeLessThan(6200)
})

test("visibility: closes the actual WS when hidden and fetches before opening a new one", async ({ page }) => {
  let receivedFrames = 0
  let trackResume = false
  const events: string[] = []
  page.on("websocket", (socket) => {
    if (!isSocket(socket.url())) return
    if (trackResume) events.push("ws")
    socket.on("framereceived", () => receivedFrames++)
  })
  page.on("request", (request) => {
    if (trackResume && isNodes(request.url())) events.push("nodes request")
  })
  page.on("response", (response) => {
    if (trackResume && isNodes(response.url())) events.push("nodes response")
  })

  const opening = page.waitForEvent("websocket", (socket) => isSocket(socket.url()))
  await page.goto(mockUrl("normal"))
  const first = await opening
  await expect.poll(() => receivedFrames).toBeGreaterThan(0)
  const closing = first.waitForEvent("close")
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await closing
  expect(first.isClosed()).toBe(true)

  const previousFrames = receivedFrames
  trackResume = true
  const reopening = page.waitForEvent("websocket", (socket) => isSocket(socket.url()))
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  const second = await reopening
  expect(second).not.toBe(first)
  expect(events).toEqual(["nodes request", "nodes response", "ws"])
  await expect.poll(() => receivedFrames).toBeGreaterThan(previousFrames)
})
