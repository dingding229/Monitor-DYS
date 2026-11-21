import { expect, it } from "vitest"
import { rangesFor } from "../../src/lib/ranges"

const sevenDays = [1, 6, 24, 168]

it.each<[unknown, number[]]>([
  [1, [1, 6, 24]],
  [7, sevenDays],
  [30, [1, 6, 24, 168, 720]],
  [90, [1, 6, 24, 168, 720, 2160]],
  [365, [1, 6, 24, 168, 720, 2160, 8760]],
  [undefined, sevenDays], [null, sevenDays], [0, sevenDays], [-1, sevenDays],
  [NaN, sevenDays], [Infinity, sevenDays], ["30", sevenDays],
  [8, [1, 6, 24, 192]], [9, [1, 6, 24, 168, 216]],
])("rangesFor(%s) returns the expected hours", (days, expected) => {
  expect(rangesFor(days as number | undefined)).toEqual(expected)
})
