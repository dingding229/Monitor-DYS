import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { geoBounds, geoContains } from "d3-geo"
import { feature } from "topojson-client"

const ISO_NUMERIC_TO_ALPHA2 = {
  "004": "AF", "008": "AL", "010": "AQ", "012": "DZ", "024": "AO",
  "031": "AZ", "032": "AR", "036": "AU", "040": "AT", "044": "BS",
  "050": "BD", "051": "AM", "056": "BE", "064": "BT", "068": "BO",
  "070": "BA", "072": "BW", "076": "BR", "084": "BZ", "090": "SB",
  "096": "BN", "100": "BG", "104": "MM", "108": "BI", "112": "BY",
  "116": "KH", "120": "CM", "124": "CA", "140": "CF", "144": "LK",
  "148": "TD", "152": "CL", "156": "CN", "158": "TW", "170": "CO",
  "178": "CG", "180": "CD", "188": "CR", "191": "HR", "192": "CU",
  "196": "CY", "203": "CZ", "204": "BJ", "208": "DK", "214": "DO",
  "218": "EC", "222": "SV", "226": "GQ", "231": "ET", "232": "ER",
  "233": "EE", "238": "FK", "242": "FJ", "246": "FI", "250": "FR",
  "260": "TF", "262": "DJ", "266": "GA", "268": "GE", "270": "GM",
  "275": "PS", "276": "DE", "288": "GH", "300": "GR", "304": "GL",
  "320": "GT", "324": "GN", "328": "GY", "332": "HT", "340": "HN",
  "348": "HU", "352": "IS", "356": "IN", "360": "ID", "364": "IR",
  "368": "IQ", "372": "IE", "376": "IL", "380": "IT", "384": "CI",
  "388": "JM", "392": "JP", "398": "KZ", "400": "JO", "404": "KE",
  "408": "KP", "410": "KR", "414": "KW", "417": "KG", "418": "LA",
  "422": "LB", "426": "LS", "428": "LV", "430": "LR", "434": "LY",
  "440": "LT", "442": "LU", "450": "MG", "454": "MW", "458": "MY",
  "466": "ML", "478": "MR", "484": "MX", "496": "MN", "498": "MD",
  "499": "ME", "504": "MA", "508": "MZ", "512": "OM", "516": "NA",
  "524": "NP", "528": "NL", "540": "NC", "548": "VU", "554": "NZ",
  "558": "NI", "562": "NE", "566": "NG", "578": "NO", "586": "PK",
  "591": "PA", "598": "PG", "600": "PY", "604": "PE", "608": "PH",
  "616": "PL", "620": "PT", "624": "GW", "626": "TL", "630": "PR",
  "634": "QA", "642": "RO", "643": "RU", "646": "RW", "682": "SA",
  "686": "SEN", "688": "RS", "694": "SL", "703": "SK", "704": "VN",
  "705": "SI", "706": "SO", "710": "ZA", "716": "ZW", "724": "ES",
  "728": "SS", "729": "SD", "732": "EH", "740": "SR", "748": "SZ",
  "752": "SE", "756": "CH", "760": "SY", "762": "TJ", "764": "TH",
  "768": "TG", "780": "TT", "784": "AE", "788": "TN", "792": "TR",
  "795": "TM", "800": "UG", "804": "UA", "807": "MK", "818": "EG",
  "826": "GB", "834": "TZ", "840": "US", "854": "BF", "858": "UY",
  "860": "UZ", "862": "VE", "887": "YE", "894": "ZM",
}
ISO_NUMERIC_TO_ALPHA2["686"] = "SN"

const NAME_TO_ALPHA2 = {
  "N. Cyprus": "CY",
  "Somaliland": "SO",
  "Kosovo": "XK",
}

// Sub-110m microstates / territories commonly hosting VPS nodes
const MICRO_PINS = [
  ["HK", 114.17, 22.3],
  ["SG", 103.82, 1.35],
  ["MO", 113.54, 22.2],
  ["MT", 14.4, 35.9],
  ["BH", 50.55, 26.0],
  ["AD", 1.6, 42.5],
  ["LI", 9.53, 47.17],
  ["MC", 7.41, 43.73],
]

const MIN_LAT = -56
const MAX_LAT = 78
const MIN_LON = -178.5
const MAX_LON = 180
const STEP = 1.5

const lats = []
for (let lat = MAX_LAT; lat >= MIN_LAT - 1e-6; lat -= STEP) {
  lats.push(Number(lat.toFixed(2)))
}
const lons = []
for (let lon = MIN_LON; lon <= MAX_LON + 1e-6; lon += STEP) {
  lons.push(Number(lon.toFixed(2)))
}

const rootDir = resolve(import.meta.dirname, "..")
const topoPath = resolve(rootDir, "node_modules/world-atlas/countries-110m.json")
const topo = JSON.parse(readFileSync(topoPath, "utf8"))
const geo = feature(topo, topo.objects.countries)

const countryFeatures = geo.features
  .map((f) => {
    const code = ISO_NUMERIC_TO_ALPHA2[String(f.id)] || NAME_TO_ALPHA2[f.properties?.name] || ""
    if (!code || code === "AQ") return null
    const bounds = geoBounds(f)
    return { code, feature: f, bounds }
  })
  .filter(Boolean)

function inBounds(lon, lat, [[w, s], [e, n]]) {
  if (lat < s - 0.5 || lat > n + 0.5) return false
  if (w <= e) return lon >= w - 0.5 && lon <= e + 0.5
  return lon >= w - 0.5 || lon <= e + 0.5
}

// Build 2D grid of ISO2 codes ("" for ocean)
const grid = Array.from({ length: lats.length }, () => Array(lons.length).fill(""))

for (let r = 0; r < lats.length; r++) {
  const lat = lats[r]
  for (let c = 0; c < lons.length; c++) {
    const lon = lons[c]
    for (const item of countryFeatures) {
      if (!inBounds(lon, lat, item.bounds)) continue
      if (geoContains(item.feature, [lon, lat])) {
        grid[r][c] = item.code
        break
      }
    }
  }
}

// Stamp microstates onto their nearest grid cell so they also have a highlighted dot
for (const [code, lon, lat] of MICRO_PINS) {
  const r = Math.round((MAX_LAT - lat) / STEP)
  const c = Math.round((lon - MIN_LON) / STEP)
  if (r >= 0 && r < lats.length && c >= 0 && c < lons.length) {
    grid[r][c] = code
  }
}

// Encode each row as compact RLE: `startCol:len:CODE,startCol:len:CODE`
const rleRows = []
let totalDots = 0

for (let r = 0; r < lats.length; r++) {
  const row = grid[r]
  const runs = []
  let c = 0
  while (c < row.length) {
    const code = row[c]
    if (!code) {
      c++
      continue
    }
    let len = 1
    while (c + len < row.length && row[c + len] === code) {
      len++
    }
    totalDots += len
    runs.push(`${c.toString(36)}.${len.toString(36)}.${code}`)
    c += len
  }
  rleRows.push(runs.join(","))
}

const outPath = resolve(rootDir, "src/lib/map-data.ts")
const content = `// Auto-generated by scripts/gen-map.mjs from Natural Earth 110m (world-atlas). Do not edit manually.
export const MAP_GRID_MIN_LAT = ${MIN_LAT}
export const MAP_GRID_MAX_LAT = ${MAX_LAT}
export const MAP_GRID_MIN_LON = ${MIN_LON}
export const MAP_GRID_MAX_LON = ${MAX_LON}
export const MAP_GRID_STEP = ${STEP}
export const MAP_GRID_ROWS = ${lats.length}
export const MAP_GRID_COLS = ${lons.length}

/**
 * Each row corresponds to lat = MAP_GRID_MAX_LAT - row * MAP_GRID_STEP.
 * Comma-separated runs of \`<col36>.<len36>.<ISO2>\`.
 */
export const MAP_LAND_RLE: readonly string[] = ${JSON.stringify(rleRows)}
`

writeFileSync(outPath, content, "utf8")
console.log(`Generated ${outPath}: ${lats.length}x${lons.length} grid, ${totalDots} land dots, ${content.length} bytes`)
