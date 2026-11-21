import type { Page, Route } from "@playwright/test"
import { cdnRatePayload, openRatePayload, ratesPerCny } from "../fixtures/exchange-rates"
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

export type RatesMode = "open" | "cdn" | "fail"

export async function mockRates(page: Page, mode: RatesMode): Promise<void> {
  const baseFrom = (code?: string) => {
    const key = code?.toUpperCase()
    return key && Object.hasOwn(ratesPerCny, key) ? key as keyof typeof ratesPerCny : null
  }
  await page.route("https://open.er-api.com/**", (route) => {
    const base = baseFrom(new URL(route.request().url()).pathname.match(/^\/v6\/latest\/([A-Z]{3})$/)?.[1])
    return mode === "open" && base
      ? fulfillGeo(route, openRatePayload(base))
      : fulfillGeo(route, { result: "error", "error-type": "test-unavailable" }, 503)
  })
  await page.route("https://cdn.jsdelivr.net/**", (route) => {
    const base = baseFrom(new URL(route.request().url()).pathname.match(/^\/npm\/@fawazahmed0\/currency-api@latest\/v1\/currencies\/([a-z]{3})\.json$/)?.[1])
    return mode === "cdn" && base ? fulfillGeo(route, cdnRatePayload(base)) : fulfillGeo(route, {}, 503)
  })
}

export function countRateRequests(page: Page): Readonly<{ open: number; cdn: number }> {
  const counts = { open: 0, cdn: 0 }
  page.on("request", (request) => {
    const { hostname } = new URL(request.url())
    if (hostname === "open.er-api.com") counts.open++
    if (hostname === "cdn.jsdelivr.net") counts.cdn++
  })
  return counts
}
