/**
 * Country centroids (ISO 3166-1 alpha-2 -> [lon, lat]), country names, and compressed world dot-matrix map per SPEC-v1.1 §C.1.
 */

export const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  AD: [1.6, 42.5],
  AE: [54.0, 24.0],
  AF: [65.0, 33.0],
  AG: [-61.8, 17.05],
  AI: [-63.05, 18.25],
  AL: [20.0, 41.0],
  AM: [45.0, 40.0],
  AO: [18.5, -12.5],
  AR: [-64.0, -34.0],
  AT: [13.33, 47.33],
  AU: [135.0, -25.0],
  AZ: [47.5, 40.5],
  BA: [18.0, 44.0],
  BD: [90.0, 24.0],
  BE: [4.5, 50.83],
  BG: [25.0, 43.0],
  BH: [50.55, 26.0],
  BO: [-65.0, -17.0],
  BR: [-53.0, -10.0],
  BY: [28.0, 53.0],
  CA: [-106.0, 56.0],
  CH: [8.23, 46.8],
  CL: [-71.0, -33.0],
  CN: [106.0, 35.0],
  CO: [-73.0, 4.0],
  CR: [-84.0, 10.0],
  CY: [33.0, 35.0],
  CZ: [15.5, 49.75],
  DE: [10.45, 51.16],
  DK: [10.0, 56.0],
  DO: [-70.67, 19.0],
  DZ: [3.0, 28.0],
  EC: [-78.5, -2.0],
  EE: [25.0, 59.0],
  EG: [30.0, 27.0],
  ES: [-3.7, 40.4],
  FI: [26.0, 64.0],
  FR: [2.2, 46.2],
  GB: [-1.5, 52.8],
  GE: [43.5, 42.0],
  GR: [22.0, 39.0],
  GT: [-90.25, 15.5],
  HK: [114.17, 22.3],
  HR: [15.5, 45.17],
  HU: [19.5, 47.16],
  ID: [117.0, -2.5],
  IE: [-8.0, 53.3],
  IL: [34.85, 31.5],
  IN: [78.96, 20.59],
  IQ: [44.0, 33.0],
  IR: [53.0, 32.0],
  IS: [-19.0, 65.0],
  IT: [12.5, 42.8],
  JM: [-77.5, 18.25],
  JO: [36.0, 31.0],
  JP: [138.25, 36.2],
  KE: [38.0, 1.0],
  KG: [75.0, 41.0],
  KH: [105.0, 13.0],
  KR: [127.76, 35.9],
  KW: [47.75, 29.5],
  KZ: [68.0, 48.0],
  LA: [102.5, 18.0],
  LB: [35.83, 33.83],
  LI: [9.53, 47.17],
  LK: [81.0, 7.0],
  LT: [24.0, 55.3],
  LU: [6.13, 49.8],
  LV: [25.0, 57.0],
  MA: [-6.0, 32.0],
  MC: [7.41, 43.73],
  MD: [29.0, 47.0],
  ME: [19.3, 42.7],
  MK: [21.7, 41.6],
  MM: [96.0, 21.0],
  MN: [104.0, 46.5],
  MO: [113.54, 22.2],
  MT: [14.4, 35.9],
  MX: [-102.5, 23.6],
  MY: [101.97, 4.21],
  NG: [8.67, 9.08],
  NL: [5.29, 52.13],
  NO: [9.0, 61.0],
  NP: [84.0, 28.0],
  NZ: [172.5, -41.5],
  OM: [57.0, 21.0],
  PA: [-80.0, 9.0],
  PE: [-75.5, -9.5],
  PH: [121.77, 12.87],
  PK: [69.34, 30.37],
  PL: [19.14, 51.91],
  PR: [-66.5, 18.2],
  PT: [-8.22, 39.39],
  PY: [-58.0, -23.0],
  QA: [51.25, 25.5],
  RO: [25.0, 45.9],
  RS: [21.0, 44.0],
  RU: [95.0, 61.5],
  SA: [45.0, 24.0],
  SE: [16.0, 62.0],
  SG: [103.82, 1.35],
  SI: [15.0, 46.15],
  SK: [19.7, 48.66],
  TH: [100.99, 15.87],
  TN: [9.5, 34.0],
  TR: [35.24, 38.96],
  TW: [120.96, 23.7],
  UA: [31.16, 48.38],
  US: [-98.5, 39.5],
  UY: [-56.0, -33.0],
  UZ: [64.5, 41.3],
  VE: [-66.5, 7.0],
  VN: [106.5, 16.0],
  ZA: [24.5, -29.0],
}

export const COUNTRY_NAMES: Record<string, string> = {
  AD: "安道尔",
  AE: "阿联酋",
  AR: "阿根廷",
  AT: "奥地利",
  AU: "澳大利亚",
  BE: "比利时",
  BG: "保加利亚",
  BR: "巴西",
  CA: "加拿大",
  CH: "瑞士",
  CL: "智利",
  CN: "中国",
  CO: "哥伦比亚",
  CZ: "捷克",
  DE: "德国",
  DK: "丹麦",
  EE: "爱沙尼亚",
  EG: "埃及",
  ES: "西班牙",
  FI: "芬兰",
  FR: "法国",
  GB: "英国",
  GR: "希腊",
  HK: "香港",
  HU: "匈牙利",
  ID: "印度尼西亚",
  IE: "爱尔兰",
  IL: "以色列",
  IN: "印度",
  IT: "意大利",
  JP: "日本",
  KH: "柬埔寨",
  KR: "韩国",
  KZ: "哈萨克斯坦",
  LT: "立陶宛",
  LU: "卢森堡",
  LV: "拉脱维亚",
  MO: "澳门",
  MX: "墨西哥",
  MY: "马来西亚",
  NG: "尼日利亚",
  NL: "荷兰",
  NO: "挪威",
  NZ: "新西兰",
  PH: "菲律宾",
  PK: "巴基斯坦",
  PL: "波兰",
  PT: "葡萄牙",
  RO: "罗马尼亚",
  RS: "塞尔维亚",
  RU: "俄罗斯",
  SA: "沙特",
  SE: "瑞典",
  SG: "新加坡",
  SI: "斯洛文尼亚",
  SK: "斯洛伐克",
  TH: "泰国",
  TR: "土耳其",
  TW: "台湾",
  UA: "乌克兰",
  US: "美国",
  VN: "越南",
  ZA: "南非",
}

export function countryCentroid(code?: string | null): [number, number] | null {
  if (!code || typeof code !== "string") return null
  const upper = code.trim().toUpperCase()
  return COUNTRY_CENTROIDS[upper] ?? null
}

export function countryName(code?: string | null): string {
  if (!code || typeof code !== "string") return ""
  const upper = code.trim().toUpperCase()
  return COUNTRY_NAMES[upper] ?? upper
}

/**
 * Project [lon, lat] onto the map SVG coordinate system.
 * Default map viewBox is `width = 360, height = 160` covering lon [-170..180], lat [-56..78].
 */
export function projectGeo(
  lon: number,
  lat: number,
  width = 360,
  height = 160,
): { x: number; y: number } {
  const minLon = -170
  const maxLon = 180
  const minLat = -56
  const maxLat = 78
  const clampedLon = Math.min(maxLon, Math.max(minLon, lon))
  const clampedLat = Math.min(maxLat, Math.max(minLat, lat))
  const x = ((clampedLon - minLon) / (maxLon - minLon)) * width
  const y = ((maxLat - clampedLat) / (maxLat - minLat)) * height
  return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) }
}

/**
 * Compact RLE world land mask on a 72x32 grid (5° lon × ~4.2° lat).
 * Each row lists `[startCol, endCol]` inclusive pairs encoded as `"start-end,start-end"`.
 */
const WORLD_LAND_RLE: string[] = [
  "10-18,22-29,46-54", // 75N: N.Canada, Greenland, N.Siberia
  "3-30,36-70", // 71N: Alaska, Canada, Greenland, Scandinavia, Russia
  "2-27,36-69", // 67N: Alaska, Canada, Scandinavia, Russia
  "4-24,35-66", // 63N: Alaska, Canada, Iceland/Nordics, Russia
  "7-25,33-64", // 59N: Canada, UK/Nordics, Russia
  "8-25,32-63", // 55N: Canada, UK/Europe, Russia
  "9-25,33-64", // 51N: Canada/USA, Europe, Russia/Kazakhstan, Sakhalin
  "9-24,33-63", // 47N: USA/Canada, France-China-Japan
  "9-23,32-63", // 43N: USA, Spain-Italy-Balkans-CentralAsia-Japan
  "10-22,32-62", // 39N: USA, Iberia-Greece-Turkey-China-Korea-Japan
  "11-21,33-61", // 35N: USA, N.Africa-MiddleEast-China-Japan
  "12-20,32-59", // 31N: USA/Mexico, N.Africa-Arabia-India-China
  "13-19,31-58", // 27N: Mexico/Florida, Sahara-Arabia-India-China
  "14-21,31-58", // 23N: Mexico/Caribbean, Sahara-Arabia-India-SE.Asia-Taiwan
  "15-21,31-50,53-59", // 19N: Mexico/Caribbean, W.Africa-Arabia-India-Indochina-Philippines
  "16-21,31-49,53-59", // 15N: CentralAmerica, Sahel-Yemen-India-SE.Asia-Philippines
  "17-24,31-47,53-59", // 11N: CentralAmerica/Venezuela, W.Africa-Horn-S.India-SE.Asia
  "18-25,32-46,53-59", // 7N: Colombia/Venezuela, W.Africa-Ethiopia-SriLanka-Malaysia
  "18-26,34-45,53-60", // 3N: Colombia/Brazil, Cameroon-Kenya, Sumatra-Borneo
  "18-27,35-44,54-62", // 1S: Ecuador/Brazil, Congo-Kenya, Indonesia-Papua
  "18-28,36-44,55-63", // 5S: Peru/Brazil, Congo-Tanzania, Indonesia-Papua
  "19-28,36-44,46-47,56-63", // 9S: Peru/Brazil, Angola-Mozambique, Java-Timor
  "19-27,36-43,46-47,58-63", // 13S: Peru/Bolivia/Brazil, Angola-Mozambique, Madagascar, N.Australia
  "20-27,36-42,46-47,57-64", // 17S: Chile/Brazil, Namibia-Zimbabwe, Madagascar, Australia
  "20-26,36-41,46-47,56-65", // 21S: Chile/Argentina/Brazil, Namibia-Mozambique, Madagascar, Australia
  "20-25,37-41,56-65", // 25S: Chile/Argentina/Brazil, S.Africa, Australia
  "20-24,37-40,56-65", // 29S: Chile/Argentina, S.Africa, Australia
  "20-23,37-39,57-64", // 33S: Chile/Argentina, Cape, S.Australia
  "20-23,60-63,68-69", // 37S: Chile/Argentina, SE.Australia, New Zealand
  "20-22,61-62,67-69", // 41S: Patagonia, Tasmania, New Zealand
  "20-22,67-68", // 45S: Patagonia, S.New Zealand
  "20-22", // 49S: Southern Patagonia
]

export const MAP_COLS = 72
export const MAP_ROWS = WORLD_LAND_RLE.length

export function getWorldLandDots(width = 360, height = 160): { x: number; y: number }[] {
  const dots: { x: number; y: number }[] = []
  const stepX = width / MAP_COLS
  const stepY = height / MAP_ROWS

  for (let row = 0; row < MAP_ROWS; row++) {
    const rle = WORLD_LAND_RLE[row]
    if (!rle) continue
    const y = Number(((row + 0.5) * stepY).toFixed(1))
    const segments = rle.split(",")
    for (const seg of segments) {
      const [sStr, eStr] = seg.split("-")
      const start = Number(sStr)
      const end = eStr !== undefined ? Number(eStr) : start
      for (let col = start; col <= end; col++) {
        const x = Number(((col + 0.5) * stepX).toFixed(1))
        dots.push({ x, y })
      }
    }
  }
  return dots
}
