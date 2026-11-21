/**
 * Visitor preferences stored in localStorage.
 * Per SPEC-v1.1 §A & §C.2:
 * - Only layout and sort are stored in localStorage (colorScheme removed in v1.1).
 * - Site-level settings must NEVER be stored in localStorage.
 * - All localStorage access must be wrapped in try/catch.
 */

export type SortKey = "default" | "name" | "cpu" | "mem" | "disk" | "tx" | "rx" | "expiry" | "traffic"

export type VisitorPrefs = {
  layout?: "grid" | "table"
  sort?: SortKey
}

const KEYS = {
  layout: "dys.layout",
  sort: "dys.sort",
} as const

const VALID_SORTS = new Set<SortKey>(["default", "name", "cpu", "mem", "disk", "tx", "rx", "expiry", "traffic"])

export function loadPrefs(storage?: Storage): VisitorPrefs {
  const prefs: VisitorPrefs = {}
  try {
    const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined)
    if (!store) return prefs

    const layout = store.getItem(KEYS.layout)
    if (layout === "grid" || layout === "table") prefs.layout = layout

    const sort = store.getItem(KEYS.sort) as SortKey | null
    if (sort && VALID_SORTS.has(sort)) prefs.sort = sort
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
