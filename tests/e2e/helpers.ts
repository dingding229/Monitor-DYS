import type { Page, Route } from "@playwright/test"
import { ipsbResponse, ipwhoFailure, ipwhoResponse } from "../fixtures/visitor-geo"

export type GeoMode = "ipsb" | "ipwho" | "fail"

export function fulfillGeo(route: Route, json: unknown, status = 200): Promise<void> {
  return route.fulfill({ status, json, headers: { "access-control-allow-origin": "*" } })
}

// Install before navigation. All geo modes, including fallback, stay off the network.
export async function mockGeo(page: Page, mode: GeoMode): Promise<void> {
  await page.route("https://api.ip.sb/**", (route) => mode === "ipsb"
    ? fulfillGeo(route, ipsbResponse)
    : fulfillGeo(route, { message: "Test: IP.SB unavailable" }, 503))
  await page.route("https://ipwho.is/**", (route) => mode === "ipwho"
    ? fulfillGeo(route, ipwhoResponse)
    : fulfillGeo(route, ipwhoFailure))
}

// The returned counters update on requests, including requests that fail or are intercepted.
export function countGeoRequests(page: Page): Readonly<{ ipsb: number; ipwho: number }> {
  const counts = { ipsb: 0, ipwho: 0 }
  page.on("request", (request) => {
    const { hostname } = new URL(request.url())
    if (hostname === "api.ip.sb") counts.ipsb++
    if (hostname === "ipwho.is") counts.ipwho++
  })
  return counts
}

export function historyRangeSelect(page: Page) {
  return page.getByRole("combobox", { name: /时间范围/ })
}

// Keep the legacy check runnable before and after the v1.1 dropdown replaces v1.0's buttons.
export async function historyRangeLabels(page: Page): Promise<string[]> {
  const options = historyRangeSelect(page).locator("option")
  if (await options.count()) return options.allTextContents()
  return page.getByTestId("range-btn").allTextContents()
}
