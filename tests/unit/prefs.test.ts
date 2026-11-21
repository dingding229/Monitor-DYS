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

it("loads only the three visitor preferences and ignores site-level keys", () => {
  savePref("layout", "table", storage)
  savePref("color_scheme", "dark", storage)
  savePref("sort", "cpu", storage)
  for (const key of ["accent", "poll_interval", "announcement", "show_billing"]) storage.setItem(key, "ignored")
  expect(loadPrefs(storage)).toEqual({ layout: "table", color_scheme: "dark", sort: "cpu" })
})

it("ignores invalid stored values", () => {
  storage.setItem("dys.layout", "bad")
  storage.setItem("theme", "bad")
  storage.setItem("dys.sort", "bad")
  expect(loadPrefs(storage)).toEqual({})
})

it("keeps the app usable when storage is blocked", () => {
  const blocked = () => { throw new DOMException("blocked", "SecurityError") }
  const storage = { getItem: blocked, setItem: blocked } as unknown as Storage
  expect(loadPrefs(storage)).toEqual({})
  expect(() => savePref("layout", "grid", storage)).not.toThrow()
})
