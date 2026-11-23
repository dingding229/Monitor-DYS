/**
 * v3: `ThemeConfig.theme` is one of the six `ThemeKey` presets; use
 * `resolveTheme(value)` for untrusted input. Old color settings are ignored.
 * Derived in part from monitor-theme-default (MIT, Copyright (c) 2026 stqfdyr).
 */
import manifest from "../../theme.json"
import { api, isObj, num } from "@/lib/api"

type ConfigField = {
  type: "title" | "select" | "string" | "boolean" | "text" | "number"
  key?: string
  default?: unknown
  label?: string
  help?: string
  options?: { value: string; label: string }[]
  min?: number
  max?: number
}

const themes = ["emerald", "ocean", "indigo", "amber", "rose", "slate"] as const
export type ThemeKey = typeof themes[number]

export function resolveTheme(value: unknown): ThemeKey {
  return themes.find(theme => theme === value) ?? "emerald"
}

export type ThemeConfig = {
  theme: ThemeKey
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
  if (isObj(declared) && Array.isArray(declared.config)) {
    return (declared as { config: ConfigField[] }).config
  }
  return manifest.config as ConfigField[]
}

export function resolveConfig(
  declared: unknown = manifest.config,
  saved?: Record<string, unknown> | null,
): ThemeConfig {
  const fields = extractFields(declared)
  const raw = isObj(saved) ? saved : {}
  const result: Record<string, unknown> = { theme: resolveTheme(raw.theme) }

  for (const field of fields) {
    const { key } = field
    if (!key || field.type === "title" || key === "theme" || key === "accent" || key === "color_scheme") continue
    const def = field.default
    const val = raw[key]

    let valid = false
    switch (field.type) {
      case 'boolean': valid = typeof val === 'boolean'; break
      case 'number': valid = num(val) && val >= (field.min ?? -Infinity) && val <= (field.max ?? Infinity); break
      case 'select': valid = !!field.options?.some(o => o.value === val); break
      case 'string': case 'text':
        valid = typeof val === 'string' && (key !== 'footer_url' || isValidHttpUrl(val))
        break
      default: valid = typeof val === typeof def
    }
    result[key] = !valid ? def : typeof val === 'string' && key === 'footer_url' ? val.trim() : val
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

