/**
 * Country centroids (ISO 3166-1 alpha-2 -> [lon, lat]), country names, and Natural Earth 110m dot-matrix decoding per SPEC-v1.2 §7.
 */
import {
  MAP_GRID_COLS,
  MAP_GRID_MAX_LAT,
  MAP_GRID_MAX_LON,
  MAP_GRID_MIN_LAT,
  MAP_GRID_MIN_LON,
  MAP_GRID_ROWS,
  MAP_LAND_MOVES,
  MAP_LAND_PALETTE,
  MAP_LAND_SPANS,
} from "@/lib/map-data"

// Two-letter keys and [lon, lat] pairs share offsets in these parallel tables.
const centroidCodes = "ADAEAFAGAIALAMAOARATAUAZBABDBEBGBHBOBRBYCACHCLCNCOCRCYCZDEDKDODZECEEEGESFIFRGBGEGRGTHKHRHUIDIEILINIQIRISITJMJOJPKEKGKHKRKWKZLALBLILKLTLULVMAMCMDMEMKMMMNMOMTMXMYNGNLNONPNZOMPAPEPHPKPLPRPTPYQARORSRUSASESGSISKTHTNTRTWUAUSUYUZVEVNZA"
const centroidCoordinates = [
  1.6, 42.5,  54, 24,  65, 33,  -61.8, 17.05,  -63.05, 18.25, // AD AE AF AG AI
  20, 41,  45, 40,  18.5, -12.5,  -64, -34,  13.33, 47.33, // AL AM AO AR AT
  135, -25,  47.5, 40.5,  18, 44,  90, 24,  4.5, 50.83, // AU AZ BA BD BE
  25, 43,  50.55, 26,  -65, -17,  -53, -10,  28, 53, // BG BH BO BR BY
  -106, 56,  8.23, 46.8,  -71, -33,  106, 35,  -73, 4, // CA CH CL CN CO
  -84, 10,  33, 35,  15.5, 49.75,  10.45, 51.16,  10, 56, // CR CY CZ DE DK
  -70.67, 19,  3, 28,  -78.5, -2,  25, 59,  30, 27, // DO DZ EC EE EG
  -3.7, 40.4,  26, 64,  2.2, 46.2,  -1.5, 52.8,  43.5, 42, // ES FI FR GB GE
  22, 39,  -90.25, 15.5,  114.17, 22.3,  15.5, 45.17,  19.5, 47.16, // GR GT HK HR HU
  117, -2.5,  -8, 53.3,  34.85, 31.5,  78.96, 20.59,  44, 33, // ID IE IL IN IQ
  53, 32,  -19, 65,  12.5, 42.8,  -77.5, 18.25,  36, 31, // IR IS IT JM JO
  138.25, 36.2,  38, 1,  75, 41,  105, 13,  127.76, 35.9, // JP KE KG KH KR
  47.75, 29.5,  68, 48,  102.5, 18,  35.83, 33.83,  9.53, 47.17, // KW KZ LA LB LI
  81, 7,  24, 55.3,  6.13, 49.8,  25, 57,  -6, 32, // LK LT LU LV MA
  7.41, 43.73,  29, 47,  19.3, 42.7,  21.7, 41.6,  96, 21, // MC MD ME MK MM
  104, 46.5,  113.54, 22.2,  14.4, 35.9,  -102.5, 23.6,  101.97, 4.21, // MN MO MT MX MY
  8.67, 9.08,  5.29, 52.13,  9, 61,  84, 28,  172.5, -41.5, // NG NL NO NP NZ
  57, 21,  -80, 9,  -75.5, -9.5,  121.77, 12.87,  69.34, 30.37, // OM PA PE PH PK
  19.14, 51.91,  -66.5, 18.2,  -8.22, 39.39,  -58, -23,  51.25, 25.5, // PL PR PT PY QA
  25, 45.9,  21, 44,  95, 61.5,  45, 24,  16, 62, // RO RS RU SA SE
  103.82, 1.35,  15, 46.15,  19.7, 48.66,  100.99, 15.87,  9.5, 34, // SG SI SK TH TN
  35.24, 38.96,  120.96, 23.7,  31.16, 48.38,  -98.5, 39.5,  -56, -33, // TR TW UA US UY
  64.5, 41.3,  -66.5, 7,  106.5, 16,  24.5, -29, // UZ VE VN ZA
]

export function countryCentroid(code?: string | null): [number, number] | null {
  if (typeof code !== "string") return null
  const key = code.trim().toUpperCase()
  if (key.length !== 2) return null
  for (let i = 0; i < centroidCodes.length; i += 2) {
    if (centroidCodes.startsWith(key, i)) return [centroidCoordinates[i], centroidCoordinates[i + 1]]
  }
  return null
}

/**
 * Project [lon, lat] onto the map SVG coordinate system.
 * Default map viewBox is `width = 360, height = 160` covering lon [MAP_GRID_MIN_LON..MAP_GRID_MAX_LON], lat [MAP_GRID_MIN_LAT..MAP_GRID_MAX_LAT].
 */
export function projectGeo(
  lon: number,
  lat: number,
  width = 360,
  height = 160,
): { x: number; y: number } {
  const minLon = MAP_GRID_MIN_LON
  const maxLon = MAP_GRID_MAX_LON
  const minLat = MAP_GRID_MIN_LAT
  const maxLat = MAP_GRID_MAX_LAT
  const clampedLon = Math.min(maxLon, Math.max(minLon, lon))
  const clampedLat = Math.min(maxLat, Math.max(minLat, lat))
  const x = ((clampedLon - minLon) / (maxLon - minLon)) * width
  const y = ((maxLat - clampedLat) / (maxLat - minLat)) * height
  return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) }
}

type MapDot = {
  x: number
  y: number
  country: string
}

export function getWorldLandDots(width = 360, height = 160): MapDot[] {
  const dots: MapDot[] = []
  const stepX = width / MAP_GRID_COLS
  const stepY = height / MAP_GRID_ROWS

  const spans = atob(MAP_LAND_SPANS), moves = atob(MAP_LAND_MOVES)
  const palette: string[] = MAP_LAND_PALETTE.match(/../g) ?? []
  let pos = 0, index = 0
  for (let row = 0; row < MAP_GRID_ROWS; row++) {
    const y = Number(((row + 0.5) * stepY).toFixed(2))
    let col = 0
    for (let runs = spans.charCodeAt(pos++); runs > 0; runs--) {
      col += spans.charCodeAt(pos++)
      const end = col + spans.charCodeAt(pos++)
      const [country] = palette.splice(moves.charCodeAt(index++), 1)
      palette.unshift(country)
      for (; col < end; col++) {
        const x = Number(((col + 0.5) * stepX).toFixed(2))
        dots.push({ x, y, country })
      }
    }
  }
  return dots
}
