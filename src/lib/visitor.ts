import { isObj } from "./api"
/**
 * Visitor information & User-Agent / GeoIP normalization per SPEC-v1.1 §F.
 * External requests may ONLY go to `https://api.ip.sb/geoip` and `https://ipwho.is/`.
 */

type ParsedUA = {
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

  const browsers: [string,RegExp][] = [["微信",/MicroMessenger\/([\d.]+)/i], ["QQ 浏览器",/M?QQBrowser\/([\d.]+)/i],
    ["Edge",/(?:EdgA?|EdgiOS|Edge)\/([\d.]+)/i], ["Opera",/(?:OPR|Opera)\/([\d.]+)/i], ["Firefox",/(?:Firefox|FxiOS)\/([\d.]+)/i],
    ["Chrome",/(?:Chrome|CriOS)\/([\d.]+)/i], ["Safari",/Version\/([\d.]+).*Safari/i], ["Safari",/Safari\/([\d.]+)/i]]
  let browser="Browser", version=""
  for(const [name,pattern] of browsers) {const match=pattern.exec(s); if(match){browser=name;version=match[1];break}}
  return { browser, version, os, device }
}

function cleanStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

function normalizeGeo(source: "ipsb" | "ipwho", json: unknown): VisitorGeo | null {
  if (!json || typeof json !== "object") return null
  const data = json as Record<string, unknown>

  if (source === 'ipwho' && data.success === false) return null
  const ip=cleanStr(data.ip), countryCode=cleanStr(data.country_code).toUpperCase(), country=cleanStr(data.country)
  const region=cleanStr(data.region), city=cleanStr(data.city), conn=isObj(data.connection)?data.connection:{}
  const org=cleanStr(conn.isp)||cleanStr(conn.org)||cleanStr(data.isp)||cleanStr(data.organization)||cleanStr(data.org)
  const raw=conn.asn??data.asn, asn=typeof raw==='number'?`AS${raw}`:cleanStr(raw)
  const isp=[asn && !org.includes(asn)?asn:'',org].filter(Boolean).join(' ')
  return ip && (countryCode||country||city||isp) ? {ip,countryCode,country,region,city,isp} : null
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
  let store = storage
  try {
    if(store === undefined) store = sessionStorage
    const cached = JSON.parse(store?.getItem(SESSION_CACHE_KEY) || 'null') as VisitorGeo | null
    if(cached && typeof cached.ip === 'string' && cached.ip) return cached
  } catch { /* memory-only if storage is unavailable */ }
  for(const [source,url] of [['ipsb','https://api.ip.sb/geoip'],['ipwho','https://ipwho.is/']] as const) {
    try {
      const geo=normalizeGeo(source, await fetchJsonWithTimeout(fetchFn,url))
      if(!geo) continue
      try {store?.setItem(SESSION_CACHE_KEY,JSON.stringify(geo))} catch { /* cache optional */ }
      return geo
    } catch { /* try the next provider */ }
  }
  return null
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
