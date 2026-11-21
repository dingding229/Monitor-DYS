import { beforeEach, expect, it } from "vitest"
import { loadPrefs, savePref } from "../../src/lib/prefs"

const values = new Map<string, string>()
const storage: Storage = {
  get length() { return values.size },
  clear: () => values.clear(),
  getItem: (key) => values.get(key) ?? null,
  key: (index) => [...values.keys()][index] ?? null,
  removeItem: (key) => { values.delete(key) },
  setItem: (key, value) => { values.set(key, value) },
}
beforeEach(() => storage.clear())

it("loads layout/sort and ignores old color preferences and site-level keys", () => {
  savePref("layout", "table", storage)
  savePref("sort", "cpu", storage)
  for (const key of ["accent", "poll_interval", "announcement", "show_billing", "visitor_info_enabled"]) storage.setItem(key, "ignored")
  storage.setItem("theme", "dark")
  storage.setItem("dys.color_scheme", "dark")
  expect(loadPrefs(storage)).toEqual({ layout: "table", sort: "cpu" })
})

it("ignores invalid stored values", () => {
  storage.setItem("dys.layout", "bad")
  storage.setItem("dys.sort", "bad")
  expect(loadPrefs(storage)).toEqual({})
})

it("keeps the app usable when storage is blocked", () => {
  const blocked = () => { throw new DOMException("blocked", "SecurityError") }
  const storage = { getItem: blocked, setItem: blocked } as unknown as Storage
  expect(loadPrefs(storage)).toEqual({})
  expect(() => savePref("layout", "grid", storage)).not.toThrow()
})
