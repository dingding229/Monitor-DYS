/**
 * Derived in part from monitor-theme-default (MIT, Copyright (c) 2026 stqfdyr).
 */
import manifest from "../../theme.json"
import { api } from "@/lib/api"

export type ConfigField = {
  type: "title" | "select" | "string" | "boolean" | "text" | "number"
  key?: string
  default?: unknown
  label?: string
  help?: string
  options?: { value: string; label: string }[]
  min?: number
  max?: number
}

export type ThemeConfig = {
  layout: "grid" | "table"
  card_size: "compact" | "standard"
  accent: string
  show_summary: boolean
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

function isValidCssColor(v: string): boolean {
  const s = v.trim()
  if (!s) return false
  if (typeof CSS !== "undefined" && typeof CSS.supports === "function") {
    return CSS.supports("color", s)
  }
  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    const span = document.createElement("span")
    span.style.color = ""
    span.style.color = s
    return span.style.color !== ""
  }
  return false
}

function isValidHttpUrl(v: string): boolean {
  const s = v.trim()
  if (!s) return false
  try {
    const u = new URL(s)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

function extractFields(declared: unknown): ConfigField[] {
  if (Array.isArray(declared)) return declared as ConfigField[]
  if (declared && typeof declared === "object" && "config" in declared && Array.isArray((declared as { config: unknown }).config)) {
    return (declared as { config: ConfigField[] }).config
  }
  return manifest.config as ConfigField[]
}

export function resolveConfig(
  declared: unknown = manifest.config,
  saved?: Record<string, unknown> | null,
): ThemeConfig {
  const fields = extractFields(declared)
  const raw = saved && typeof saved === "object" ? saved : {}
  const result: Record<string, unknown> = {}

  for (const field of fields) {
    if (field.type === "title" || !field.key) continue
    const key = field.key
    const def = field.default
    const val = raw[key]

    if (val === undefined) {
      result[key] = def
      continue
    }

    switch (field.type) {
      case "boolean":
        result[key] = typeof val === "boolean" ? val : def
        break
      case "select":
        if (typeof val === "string" && Array.isArray(field.options) && field.options.some((o) => o.value === val)) {
          result[key] = val
        } else {
          result[key] = def
        }
        break
      case "number":
        if (typeof val === "number" && Number.isFinite(val)) {
          const minOK = field.min === undefined || val >= field.min
          const maxOK = field.max === undefined || val <= field.max
          result[key] = minOK && maxOK ? val : def
        } else {
          result[key] = def
        }
        break
      case "string":
      case "text":
        if (typeof val === "string") {
          if (key === "accent") {
            result[key] = isValidCssColor(val) ? val.trim() : def
          } else if (key === "footer_url") {
            result[key] = isValidHttpUrl(val) ? val.trim() : def
          } else {
            result[key] = val
          }
        } else {
          result[key] = def
        }
        break
      default:
        result[key] = typeof val === typeof def ? val : def
    }
  }

  return result as unknown as ThemeConfig
}

export async function loadSiteConfig(opts?: { fetch?: typeof globalThis.fetch }) {
  try {
    const saved = await api<Record<string, unknown>>(`/themes/${manifest.short}/config`, opts)
    return { config: resolveConfig(manifest.config, saved), loaded: true }
  } catch {
    // Keep the manifest defaults for rendering, but never start geolocation on a failed read.
    return { config: resolveConfig(), loaded: false }
  }
}

export async function loadConfig(opts?: { fetch?: typeof globalThis.fetch }): Promise<ThemeConfig> {
  return (await loadSiteConfig(opts)).config
}
