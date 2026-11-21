// Synthetic quotes, not real rates. Each value is units per 1 CNY.
export const rateDate = "2026-11-20"
export const ratesPerCny = { CNY: 1, USD: 0.125, EUR: 0.1, HKD: 1, JPY: 20, GBP: 0.09, CAD: 0.17, SGD: 0.18, KRW: 175 }
export const openRateUrl = (base = "CNY") => `https://open.er-api.com/v6/latest/${base}`
export const cdnRateUrl = (base = "CNY") =>
  `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base.toLowerCase()}.json`

function tableFor(base: keyof typeof ratesPerCny) {
  return Object.fromEntries(Object.entries(ratesPerCny).map(([code, rate]) => [code, rate / ratesPerCny[base]]))
}

export function openRatePayload(base: keyof typeof ratesPerCny = "CNY") {
  return { result: "success", base_code: base, time_last_update_utc: new Date(`${rateDate}T00:00:00Z`).toUTCString(), rates: tableFor(base) }
}

export function cdnRatePayload(base: keyof typeof ratesPerCny = "CNY") {
  const lower = Object.fromEntries(Object.entries(tableFor(base)).map(([code, rate]) => [code.toLowerCase(), rate]))
  return { date: rateDate, [base.toLowerCase()]: lower }
}
