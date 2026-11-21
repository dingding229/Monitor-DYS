/**
 * OS and Browser brand icon key mapping & individually bundled SVG assets per SPEC-v1.2 §2 & §4.
 */
import { siDebian, siUbuntu, siCentos, siRockylinux, siAlmalinux, siFedora, siAlpinelinux, siArchlinux, siOpensuse, siOpenwrt, siFreebsd, siMacos, siLinux } from "simple-icons"
import siGooglechrome from "simple-icons/icons/googlechrome.svg?no-inline"
import siFirefoxbrowser from "simple-icons/icons/firefoxbrowser.svg?no-inline"
import siSafari from "simple-icons/icons/safari.svg?no-inline"
import siOpera from "simple-icons/icons/opera.svg?no-inline"
import siWechat from "simple-icons/icons/wechat.svg?no-inline"
import siQq from "simple-icons/icons/qq.svg?no-inline"

export type OsKey =
  | "debian"
  | "ubuntu"
  | "centos"
  | "rocky"
  | "almalinux"
  | "fedora"
  | "alpine"
  | "arch"
  | "opensuse"
  | "openwrt"
  | "freebsd"
  | "windows"
  | "macos"
  | "linux"
  | "unknown"

export type BrowserKey =
  | "chrome"
  | "edge"
  | "safari"
  | "firefox"
  | "opera"
  | "wechat"
  | "qq"
  | "unknown"

export type BrandKey = OsKey | BrowserKey

export function osKey(os?: string | null): OsKey {
  if (!os || typeof os !== "string") return "unknown"
  const s = os.trim().toLowerCase()
  if (!s) return "unknown"

  if (s.includes("istoreos") || s.includes("immortalwrt") || s.includes("openwrt")) return "openwrt"
  if (s.includes("debian") || s.includes("raspbian")) return "debian"
  if (s.includes("ubuntu")) return "ubuntu"
  if (s.includes("rocky")) return "rocky"
  if (s.includes("almalinux") || s.includes("alma")) return "almalinux"
  if (s.includes("centos")) return "centos"
  if (s.includes("fedora")) return "fedora"
  if (s.includes("alpine")) return "alpine"
  if (s.includes("arch") || s.includes("manjaro")) return "arch"
  if (s.includes("opensuse") || s.includes("suse")) return "opensuse"
  if (s.includes("freebsd")) return "freebsd"
  if (s.includes("windows") || s.includes("win32") || s.includes("win64")) return "windows"
  if (s.includes("macos") || s.includes("mac os") || s.includes("darwin") || s.includes("os x")) return "macos"
  if (
    s.includes("linux") ||
    s.includes("red hat") ||
    s.includes("rhel") ||
    s.includes("gentoo") ||
    s.includes("kali") ||
    s.includes("nixos") ||
    s.includes("oracle") ||
    s.includes("amazon")
  ) {
    return "linux"
  }

  return "unknown"
}

export function browserKey(name?: string | null): BrowserKey {
  if (!name || typeof name !== "string") return "unknown"
  const s = name.trim().toLowerCase()
  if (!s) return "unknown"

  if (s.includes("微信") || s.includes("wechat") || s.includes("micromessenger")) return "wechat"
  if (s.includes("qq")) return "qq"
  if (s.includes("edge") || s.includes("edg")) return "edge"
  if (s.includes("opera") || s.includes("opr")) return "opera"
  if (s.includes("firefox")) return "firefox"
  if (s.includes("chrome") || s.includes("chromium")) return "chrome"
  if (s.includes("safari")) return "safari"

  return "unknown"
}

export type IconDef = {
  color: string
  paths?: string[]
  src?: string
}

// Neutral server SVG paths (24x24 viewBox) for unknown OS
const NEUTRAL_SERVER_PATHS = [
  "M4 4h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v3h16V6H4zm2 1h2v1H6V7zm12 6H4a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2zm-14 2h16v3H4v-3zm2 1h2v1H6v-1z",
]

// Neutral globe SVG paths (24x24 viewBox) for browsers not in simple-icons (e.g. Edge / unknown)
const NEUTRAL_GLOBE_PATHS = [
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm7.93 9h-3.02a15.6 15.6 0 0 0-1.18-5.02A8.03 8.03 0 0 1 19.93 11zM12 4.04c.83 1.2 1.85 3.6 2.13 6.96H9.87C10.15 7.64 11.17 5.24 12 4.04zM4.07 13h3.02c.18 1.82.6 3.55 1.18 5.02A8.03 8.03 0 0 1 4.07 13zm3.02-2H4.07a8.03 8.03 0 0 1 4.2-5.02A15.6 15.6 0 0 0 7.09 11zM12 19.96c-.83-1.2-1.85-3.6-2.13-6.96h4.26c-.28 3.36-1.3 5.76-2.13 6.96zm3.73-1.94c.58-1.47 1-3.2 1.18-5.02h3.02a8.03 8.03 0 0 1-4.2 5.02z",
]


const OS_ICON_MAP: Record<OsKey, IconDef> = {
  debian: { paths: [siDebian.path], color: "#A81D33" },
  ubuntu: { paths: [siUbuntu.path], color: "#E95420" },
  centos: { paths: [siCentos.path], color: "#262577" },
  rocky: { paths: [siRockylinux.path], color: "#10B981" },
  almalinux: { paths: [siAlmalinux.path], color: "#0f4266" },
  fedora: { paths: [siFedora.path], color: "#51A2DA" },
  alpine: { paths: [siAlpinelinux.path], color: "#0D597F" },
  arch: { paths: [siArchlinux.path], color: "#1793D1" },
  opensuse: { paths: [siOpensuse.path], color: "#73BA25" },
  openwrt: { paths: [siOpenwrt.path], color: "#00B5E2" },
  freebsd: { paths: [siFreebsd.path], color: "#AB2B28" },
  macos: { paths: [siMacos.path], color: "#374151" },
  // Per SPEC-v1.2 §2: icons missing from simple-icons (e.g. windows) use Tux (siLinux)
  windows: { paths: [siLinux.path], color: "#4b5563" },
  linux: { paths: [siLinux.path], color: "#4b5563" },
  unknown: { color: "#6b7280", paths: NEUTRAL_SERVER_PATHS },
}

const BROWSER_ICON_MAP: Record<BrowserKey, IconDef> = {
  chrome: { src: siGooglechrome, color: "#4285F4" },
  firefox: { src: siFirefoxbrowser, color: "#FF7139" },
  safari: { src: siSafari, color: "#006CFF" },
  opera: { src: siOpera, color: "#FF1B2D" },
  wechat: { src: siWechat, color: "#07C160" },
  qq: { src: siQq, color: "#1EBAFC" },
  // Per SPEC-v1.2 §4: browsers not in simple-icons (e.g. Edge) use neutral globe icon
  edge: { color: "#0284c7", paths: NEUTRAL_GLOBE_PATHS },
  unknown: { color: "#6b7280", paths: NEUTRAL_GLOBE_PATHS },
}

export function getBrandIcon(key: string, kind: "os" | "browser" = "os"): IconDef {
  if (kind === "browser") {
    return BROWSER_ICON_MAP[(key as BrowserKey) in BROWSER_ICON_MAP ? (key as BrowserKey) : "unknown"]
  }
  if ((key as OsKey) in OS_ICON_MAP && key !== "unknown") {
    return OS_ICON_MAP[key as OsKey]
  }
  if ((key as BrowserKey) in BROWSER_ICON_MAP) {
    return BROWSER_ICON_MAP[key as BrowserKey]
  }
  return OS_ICON_MAP.unknown
}
