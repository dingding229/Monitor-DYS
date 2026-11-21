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
  color_scheme: "auto" | "light" | "dark"
  accent: string
  show_summary: boolean
  show_billing: boolean
  announcement: string
  footer: string
  poll_interval: number
}

function isValidCssColor(v: string): boolean {
  const s = v.trim()
  if (!s) return false
  if (typeof CSS !== "undefined" && typeof CSS.supports === "function") {
    return CSS.supports("color", s)
  }
  if (typeof document === "undefined") return false
  const style = document.createElement("span").style
  style.color = s
  return style.color !== ""
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

export function loadConfig(opts?: { fetch?: typeof globalThis.fetch }): Promise<ThemeConfig> {
  return api<Record<string, unknown>>(`/themes/${manifest.short}/config`, opts)
    .then((saved) => resolveConfig(manifest.config, saved))
    .catch(() => resolveConfig(manifest.config, {}))
}
