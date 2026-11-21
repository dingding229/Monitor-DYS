/**
 * Visitor information & User-Agent / GeoIP normalization per SPEC-v1.1 §F.
 * External requests may ONLY go to `https://api.ip.sb/geoip` and `https://ipwho.is/`.
 */

export type ParsedUA = {
  browser: string
  version: string
  os: string
  device: "desktop" | "mobile" | "tablet"
}

export type VisitorGeo = {
  ip: string
  countryCode: string
  country: string
  region: string
  city: string
  isp: string
}

const SESSION_CACHE_KEY = "dys.visitor.geo"
const SESSION_DISMISS_KEY = "dys.visitor.dismissed"

export function parseUA(ua = ""): ParsedUA {
  const s = typeof ua === "string" ? ua : ""

  // Device detection
  let device: "desktop" | "mobile" | "tablet" = "desktop"
  if (/iPad|Tablet|PlayBook|Silk/i.test(s) || (/Android/i.test(s) && !/Mobile/i.test(s))) {
    device = "tablet"
  } else if (/Mobile|iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|IEMobile|Opera Mini/i.test(s)) {
    device = "mobile"
  }

  // OS detection (Windows / macOS / iOS / Android / Linux)
  let os = "Unknown"
  if (/iPhone|iPad|iPod/i.test(s) || (/Macintosh/i.test(s) && /Mobile/i.test(s))) {
    os = "iOS"
  } else if (/Android/i.test(s)) {
    os = "Android"
  } else if (/Windows NT|Win64|Win32|Windows/i.test(s)) {
    os = "Windows"
  } else if (/Macintosh|Mac OS X/i.test(s)) {
    os = "macOS"
  } else if (/Linux|X11|Ubuntu|Debian|Fedora|CrOS/i.test(s)) {
    os = "Linux"
  }

  // Browser detection (Edge / Chrome / Safari / Firefox / Opera / 微信 / QQ 浏览器)
  let browser = "Browser"
  let version = ""

  const matchVer = (re: RegExp): string => {
    const m = re.exec(s)
    return m?.[1] ?? ""
  }

  if (/MicroMessenger\//i.test(s)) {
    browser = "微信"
    version = matchVer(/MicroMessenger\/([\d.]+)/i)
  } else if (/QQBrowser\//i.test(s) || /MQQBrowser\//i.test(s)) {
    browser = "QQ 浏览器"
    version = matchVer(/M?QQBrowser\/([\d.]+)/i)
  } else if (/EdgA?\//i.test(s) || /EdgiOS\//i.test(s) || /Edge\//i.test(s)) {
    browser = "Edge"
    version = matchVer(/(?:EdgA?|EdgiOS|Edge)\/([\d.]+)/i)
  } else if (/OPR\//i.test(s) || /Opera\//i.test(s)) {
    browser = "Opera"
    version = matchVer(/(?:OPR|Opera)\/([\d.]+)/i)
  } else if (/Firefox\//i.test(s) || /FxiOS\//i.test(s)) {
    browser = "Firefox"
    version = matchVer(/(?:Firefox|FxiOS)\/([\d.]+)/i)
  } else if (/Chrome\//i.test(s) || /CriOS\//i.test(s)) {
    browser = "Chrome"
    version = matchVer(/(?:Chrome|CriOS)\/([\d.]+)/i)
  } else if (/Safari\//i.test(s)) {
    browser = "Safari"
    version = matchVer(/Version\/([\d.]+)/i) || matchVer(/Safari\/([\d.]+)/i)
  }

  return { browser, version, os, device }
}

function cleanStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

export function normalizeGeo(source: "ipsb" | "ipwho", json: unknown): VisitorGeo | null {
  if (!json || typeof json !== "object") return null
  const data = json as Record<string, unknown>

  if (source === "ipsb") {
    const ip = cleanStr(data.ip)
    if (!ip) return null
    const countryCode = cleanStr(data.country_code).toUpperCase()
    const country = cleanStr(data.country)
    const region = cleanStr(data.region)
    const city = cleanStr(data.city)
    const org = cleanStr(data.isp) || cleanStr(data.organization)
    const asn = typeof data.asn === "number" ? `AS${data.asn}` : cleanStr(data.asn)
    const isp = [asn && !org.includes(asn) ? asn : "", org].filter(Boolean).join(" ").trim()
    if (!countryCode && !country && !city && !isp) return null
    return { ip, countryCode, country, region, city, isp }
  }

  if (source === "ipwho") {
    if (data.success === false) return null
    const ip = cleanStr(data.ip)
    if (!ip) return null
    const countryCode = cleanStr(data.country_code).toUpperCase()
    const country = cleanStr(data.country)
    const region = cleanStr(data.region)
    const city = cleanStr(data.city)
    const conn = data.connection && typeof data.connection === "object" ? (data.connection as Record<string, unknown>) : {}
    const org = cleanStr(conn.isp) || cleanStr(conn.org) || cleanStr(data.isp) || cleanStr(data.org)
    const asnRaw = conn.asn ?? data.asn
    const asn = typeof asnRaw === "number" ? `AS${asnRaw}` : cleanStr(asnRaw)
    const isp = [asn && !org.includes(asn) ? asn : "", org].filter(Boolean).join(" ").trim()
    if (!countryCode && !country && !city && !isp) return null
    return { ip, countryCode, country, region, city, isp }
  }

  return null
}

async function fetchJsonWithTimeout(fetchFn: typeof fetch, url: string, timeoutMs = 5000): Promise<unknown> {
  const signal =
    typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(timeoutMs)
      : undefined
  const res = await fetchFn(url, signal ? { signal } : undefined)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function fetchVisitor(
  fetchFn: typeof fetch = globalThis.fetch,
  storage?: Storage | null,
): Promise<VisitorGeo | null> {
  const store =
    storage !== undefined
      ? storage
      : typeof sessionStorage !== "undefined"
        ? sessionStorage
        : null

  try {
    const cached = store?.getItem(SESSION_CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached) as VisitorGeo
      if (parsed && typeof parsed.ip === "string" && parsed.ip) {
        return parsed
      }
    }
  } catch {
    // ignore storage read error
  }

  if (typeof fetchFn !== "function") return null

  let result: VisitorGeo | null = null

  try {
    const ipsbJson = await fetchJsonWithTimeout(fetchFn, "https://api.ip.sb/geoip", 5000)
    result = normalizeGeo("ipsb", ipsbJson)
  } catch {
    result = null
  }

  if (!result) {
    try {
      const ipwhoJson = await fetchJsonWithTimeout(fetchFn, "https://ipwho.is/", 5000)
      result = normalizeGeo("ipwho", ipwhoJson)
    } catch {
      result = null
    }
  }

  if (result) {
    try {
      store?.setItem(SESSION_CACHE_KEY, JSON.stringify(result))
    } catch {
      // ignore storage write error
    }
  }

  return result
}

export function isVisitorBubbleDismissed(storage?: Storage | null): boolean {
  try {
    const store = storage ?? (typeof sessionStorage !== "undefined" ? sessionStorage : null)
    return store?.getItem(SESSION_DISMISS_KEY) === "1"
  } catch {
    return false
  }
}

export function dismissVisitorBubble(storage?: Storage | null): void {
  try {
    const store = storage ?? (typeof sessionStorage !== "undefined" ? sessionStorage : null)
    store?.setItem(SESSION_DISMISS_KEY, "1")
  } catch {
    // ignore
  }
}
