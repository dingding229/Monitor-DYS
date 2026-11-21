/**
 * Daily exchange rates & currency conversion per SPEC-v1.2 §1.
 */

export type Rates = {
  base: string
  date: string
  rates: Record<string, number>
}

const CACHE_TTL_MS = 12 * 3600 * 1000
const TIMEOUT_MS = 5000

type CachedRates = {
  ts: number
  data: Rates
}

function parseUtcDateToYMD(utcStr: unknown): string {
  if (typeof utcStr === "string" && utcStr.trim()) {
    const d = new Date(utcStr)
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10)
    }
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(utcStr.trim())
    if (m) return m[1]
  }
  return new Date().toISOString().slice(0, 10)
}

function normalizeRateTable(raw: unknown, baseUpper: string): Record<string, number> | null {
  if (!raw || typeof raw !== "object") return null
  const out: Record<string, number> = { [baseUpper]: 1 }
  let count = 0
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      out[k.trim().toUpperCase()] = v
      count++
    }
  }
  return count > 0 ? out : null
}

async function fetchJsonWithTimeout(fetchFn: typeof fetch, url: string): Promise<unknown> {
  const signal =
    typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(TIMEOUT_MS)
      : undefined
  const res = await fetchFn(url, signal ? { signal } : undefined)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function fetchRates(
  base: string,
  fetchFn: typeof fetch = globalThis.fetch,
  nowMs = Date.now(),
): Promise<Rates | null> {
  if (!base || typeof base !== "string") return null
  const baseUpper = base.trim().toUpperCase()
  if (!baseUpper) return null
  const baseLower = baseUpper.toLowerCase()
  const cacheKey = `dys:rates:${baseUpper}`

  // 1. Read localStorage cache (valid for 12 hours)
  try {
    if (typeof localStorage !== "undefined") {
      const cachedRaw = localStorage.getItem(cacheKey)
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw) as CachedRates
        if (
          parsed &&
          typeof parsed.ts === "number" &&
          nowMs - parsed.ts >= 0 &&
          nowMs - parsed.ts < CACHE_TTL_MS &&
          parsed.data &&
          parsed.data.base === baseUpper &&
          parsed.data.rates &&
          typeof parsed.data.rates === "object"
        ) {
          return parsed.data
        }
      }
    }
  } catch {
    // ignore storage read error
  }

  if (typeof fetchFn !== "function") return null

  let result: Rates | null = null

  // 2. Primary: https://open.er-api.com/v6/latest/<BASE>
  try {
    const json = (await fetchJsonWithTimeout(
      fetchFn,
      `https://open.er-api.com/v6/latest/${baseUpper}`,
    )) as Record<string, unknown>
    if (json && json.result === "success") {
      const rates = normalizeRateTable(json.rates, baseUpper)
      if (rates) {
        const resolvedBase =
          typeof json.base_code === "string" && json.base_code.trim()
            ? json.base_code.trim().toUpperCase()
            : baseUpper
        result = {
          base: resolvedBase,
          date: parseUtcDateToYMD(json.time_last_update_utc),
          rates,
        }
      }
    }
  } catch {
    result = null
  }

  // 3. Fallback: https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/<baseLower>.json
  if (!result) {
    try {
      const json = (await fetchJsonWithTimeout(
        fetchFn,
        `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${baseLower}.json`,
      )) as Record<string, unknown>
      if (json && typeof json === "object") {
        const table = json[baseLower]
        const rates = normalizeRateTable(table, baseUpper)
        if (rates) {
          result = {
            base: baseUpper,
            date: parseUtcDateToYMD(json.date),
            rates,
          }
        }
      }
    } catch {
      result = null
    }
  }

  // Save to localStorage
  if (result) {
    try {
      if (typeof localStorage !== "undefined") {
        const payload: CachedRates = { ts: nowMs, data: result }
        localStorage.setItem(cacheKey, JSON.stringify(payload))
      }
    } catch {
      // ignore storage write error
    }
  }

  return result
}

/**
 * Convert `amount` from `from` currency to `to` currency using `rates`.
 * - Same currency returns `amount` directly (even if `rates` is null).
 * - If conversion is required and `rates` is null or currency is missing, returns `null`.
 */
export function convert(
  amount: number,
  from: string,
  to: string,
  rates: Rates | null,
): number | null {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null
  const fromCode = (from || "").trim().toUpperCase()
  const toCode = (to || "").trim().toUpperCase()
  if (!fromCode || !toCode) return null
  if (fromCode === toCode) return amount

  if (!rates || !rates.rates || typeof rates.rates !== "object") return null

  const baseCode = (rates.base || "").trim().toUpperCase()
  const getRate = (code: string): number | null => {
    if (code === baseCode) return 1
    const r = rates.rates[code]
    return typeof r === "number" && Number.isFinite(r) && r > 0 ? r : null
  }

  const fromRate = getRate(fromCode)
  const toRate = getRate(toCode)
  if (fromRate === null || toRate === null) return null

  // 1 base = fromRate FROM = toRate TO  =>  1 FROM = (toRate / fromRate) TO
  return (amount / fromRate) * toRate
}
