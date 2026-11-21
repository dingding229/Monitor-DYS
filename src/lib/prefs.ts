/**
 * Visitor preferences stored in localStorage.
 * Per SPEC §5.13:
 * - Only layout, color_scheme (theme), and sort can be stored in localStorage.
 * - Site-level settings (show_summary, show_billing, announcement, footer, poll_interval, accent) must NEVER be stored in localStorage.
 * - All localStorage access must be wrapped in try/catch.
 */

export type VisitorPrefs = {
  layout?: "grid" | "table"
  color_scheme?: "auto" | "light" | "dark"
  sort?: "default" | "name" | "cpu" | "traffic"
}

const KEYS = {
  layout: "dys.layout",
  color_scheme: "theme",
  sort: "dys.sort",
} as const

export function loadPrefs(storage?: Storage): VisitorPrefs {
  const prefs: VisitorPrefs = {}
  try {
    const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined)
    if (!store) return prefs

    const layout = store.getItem(KEYS.layout)
    if (layout === "grid" || layout === "table") prefs.layout = layout

    const scheme = store.getItem(KEYS.color_scheme) ?? store.getItem("dys.color_scheme")
    if (scheme === "auto" || scheme === "light" || scheme === "dark") prefs.color_scheme = scheme

    const sort = store.getItem(KEYS.sort)
    if (sort === "default" || sort === "name" || sort === "cpu" || sort === "traffic") prefs.sort = sort
  } catch {
    // Storage disabled or blocked
  }
  return prefs
}

export function savePref<K extends keyof VisitorPrefs>(key: K, value: NonNullable<VisitorPrefs[K]>, storage?: Storage): void {
  try {
    const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined)
    if (!store) return
    store.setItem(KEYS[key], value)
  } catch {
    // Storage disabled or blocked
  }
}
