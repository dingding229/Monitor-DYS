// Synthetic IPs and places; field shapes follow the providers' public docs.
// https://ip.sb/api/ and https://ipwhois.io/documentation
export const IPSB_URL = "https://api.ip.sb/geoip"
export const IPWHO_URL = "https://ipwho.is/"

export const ipsbResponse = {
  ip: "203.0.113.10",
  country_code: "JP",
  country: "Japan",
  region: "Tokyo Metropolis",
  city: "Tokyo",
  isp: "Tokyo Test Network",
  organization: "Tokyo Test Hosting",
  asn: 64500,
}

export const ipwhoResponse = {
  ip: "2001:db8::20",
  success: true,
  type: "IPv6",
  country_code: "DE",
  country: "Germany",
  region: "Hesse",
  city: "Frankfurt am Main",
  connection: { asn: 64501, org: "Frankfurt Test Hosting", isp: "Frankfurt Test Network" },
}

export const ipwhoFailure = { success: false, message: "Reserved range" }
