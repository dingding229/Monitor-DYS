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

const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  AD: [1.6, 42.5], AE: [54.0, 24.0], AF: [65.0, 33.0], AG: [-61.8, 17.05],
  AI: [-63.05, 18.25], AL: [20.0, 41.0], AM: [45.0, 40.0], AO: [18.5, -12.5],
  AR: [-64.0, -34.0], AT: [13.33, 47.33], AU: [135.0, -25.0], AZ: [47.5, 40.5],
  BA: [18.0, 44.0], BD: [90.0, 24.0], BE: [4.5, 50.83], BG: [25.0, 43.0],
  BH: [50.55, 26.0], BO: [-65.0, -17.0], BR: [-53.0, -10.0], BY: [28.0, 53.0],
  CA: [-106.0, 56.0], CH: [8.23, 46.8], CL: [-71.0, -33.0], CN: [106.0, 35.0],
  CO: [-73.0, 4.0], CR: [-84.0, 10.0], CY: [33.0, 35.0], CZ: [15.5, 49.75],
  DE: [10.45, 51.16], DK: [10.0, 56.0], DO: [-70.67, 19.0], DZ: [3.0, 28.0],
  EC: [-78.5, -2.0], EE: [25.0, 59.0], EG: [30.0, 27.0], ES: [-3.7, 40.4],
  FI: [26.0, 64.0], FR: [2.2, 46.2], GB: [-1.5, 52.8], GE: [43.5, 42.0],
  GR: [22.0, 39.0], GT: [-90.25, 15.5], HK: [114.17, 22.3], HR: [15.5, 45.17],
  HU: [19.5, 47.16], ID: [117.0, -2.5], IE: [-8.0, 53.3], IL: [34.85, 31.5],
  IN: [78.96, 20.59], IQ: [44.0, 33.0], IR: [53.0, 32.0], IS: [-19.0, 65.0],
  IT: [12.5, 42.8], JM: [-77.5, 18.25], JO: [36.0, 31.0], JP: [138.25, 36.2],
  KE: [38.0, 1.0], KG: [75.0, 41.0], KH: [105.0, 13.0], KR: [127.76, 35.9],
  KW: [47.75, 29.5], KZ: [68.0, 48.0], LA: [102.5, 18.0], LB: [35.83, 33.83],
  LI: [9.53, 47.17], LK: [81.0, 7.0], LT: [24.0, 55.3], LU: [6.13, 49.8],
  LV: [25.0, 57.0], MA: [-6.0, 32.0], MC: [7.41, 43.73], MD: [29.0, 47.0],
  ME: [19.3, 42.7], MK: [21.7, 41.6], MM: [96.0, 21.0], MN: [104.0, 46.5],
  MO: [113.54, 22.2], MT: [14.4, 35.9], MX: [-102.5, 23.6], MY: [101.97, 4.21],
  NG: [8.67, 9.08], NL: [5.29, 52.13], NO: [9.0, 61.0], NP: [84.0, 28.0],
  NZ: [172.5, -41.5], OM: [57.0, 21.0], PA: [-80.0, 9.0], PE: [-75.5, -9.5],
  PH: [121.77, 12.87], PK: [69.34, 30.37], PL: [19.14, 51.91], PR: [-66.5, 18.2],
  PT: [-8.22, 39.39], PY: [-58.0, -23.0], QA: [51.25, 25.5], RO: [25.0, 45.9],
  RS: [21.0, 44.0], RU: [95.0, 61.5], SA: [45.0, 24.0], SE: [16.0, 62.0],
  SG: [103.82, 1.35], SI: [15.0, 46.15], SK: [19.7, 48.66], TH: [100.99, 15.87],
  TN: [9.5, 34.0], TR: [35.24, 38.96], TW: [120.96, 23.7], UA: [31.16, 48.38],
  US: [-98.5, 39.5], UY: [-56.0, -33.0], UZ: [64.5, 41.3], VE: [-66.5, 7.0],
  VN: [106.5, 16.0], ZA: [24.5, -29.0],
}

export function countryCentroid(code?: string | null): [number, number] | null {
  if (!code || typeof code !== "string") return null
  const upper = code.trim().toUpperCase()
  return COUNTRY_CENTROIDS[upper] ?? null
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
