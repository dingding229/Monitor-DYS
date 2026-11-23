/**
 * v2.0.1: `ThemeConfig.accent_color` is a normalized six-digit hex color.
 * Old color settings are ignored.
 * Derived in part from monitor-theme-default (MIT, Copyright (c) 2026 stqfdyr).
 */
import manifest from "../../theme.json"
import { api, isObj, num } from "@/lib/api"
import { resolveAccent } from "./theme"

type ConfigField = {
  type: "title" | "select" | "string" | "boolean" | "text" | "number"
  key?: string
  default?: unknown
  label?: string
  help?: string
  options?: (string | { value: string; label: string })[]
  min?: number
  max?: number
}

export type ThemeConfig = {
  accent_color: string
  layout: "grid" | "table"
  card_size: "compact" | "standard"
  show_summary: boolean
  show_ping: boolean
  show_map: boolean
  show_search: boolean
  show_sort: boolean
  announcement: string
  show_billing: boolean
  expiry_warning_days: number
  visitor_info_enabled: boolean
  footer: string
  footer_url: string
  poll_interval: number
}

function httpUrl(value: string): string | undefined {
  const text = value.trim()
  try {
    const { protocol } = new URL(text)
    if (protocol === "http:" || protocol === "https:") return text
  } catch { /* Invalid URLs fall back to the default. */ }
}

function extractFields(declared: unknown): ConfigField[] {
  if (Array.isArray(declared)) return declared as ConfigField[]
  if (isObj(declared) && Array.isArray(declared.config)) {
    return (declared as { config: ConfigField[] }).config
  }
  return manifest.config as ConfigField[]
}

export function resolveConfig(
  declared: unknown = manifest.config,
  saved?: Record<string, unknown> | null,
): ThemeConfig {
  const raw = isObj(saved) ? saved : {}
  const result: Record<string, unknown> = { accent_color: resolveAccent(raw.accent_color) }

  for (const { key, type, default: def, min, max, options } of extractFields(declared)) {
    if (!key || type === "title" || ["accent_color", "theme", "accent", "color_scheme"].includes(key)) continue
    const val = raw[key]

    switch (type) {
      case "boolean": result[key] = typeof val === "boolean" ? val : def; break
      case "number": result[key] = num(val) && val >= (min ?? -Infinity) && val <= (max ?? Infinity) ? val : def; break
      case "select": result[key] = options?.some(o => (typeof o === "string" ? o : o.value) === val) ? val : def; break
      case "string": case "text":
        result[key] = typeof val !== "string" ? def : key === "footer_url" ? httpUrl(val) ?? def : val
        break
      default: result[key] = typeof val === typeof def ? val : def
    }
  }
  return result as unknown as ThemeConfig
}

export async function loadSiteConfig(opts?: { fetch?: typeof globalThis.fetch }) {
  let saved: Record<string, unknown> | undefined
  let loaded = false
  try {
    saved = await api(`/themes/${manifest.short}/config`, opts)
    loaded = true
  } catch { /* Keep defaults on failure and do not start geolocation. */ }
  return { config: resolveConfig(undefined, saved), loaded }
}
