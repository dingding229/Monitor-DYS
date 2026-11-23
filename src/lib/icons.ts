/**
 * OS and Browser brand icon key mapping & individually bundled SVG assets per SPEC-v1.2 §2 & §4.
 */
import siDebian from "simple-icons/icons/debian.svg?icon-path"
import siUbuntu from "simple-icons/icons/ubuntu.svg?icon-path"
import siCentos from "simple-icons/icons/centos.svg?icon-path"
import siRockylinux from "simple-icons/icons/rockylinux.svg?icon-path"
import siAlmalinux from "simple-icons/icons/almalinux.svg?icon-path"
import siFedora from "simple-icons/icons/fedora.svg?icon-path"
import siAlpinelinux from "simple-icons/icons/alpinelinux.svg?icon-path"
import siArchlinux from "simple-icons/icons/archlinux.svg?icon-path"
import siOpensuse from "simple-icons/icons/opensuse.svg?icon-path"
import siOpenwrt from "simple-icons/icons/openwrt.svg?icon-path"
import siFreebsd from "simple-icons/icons/freebsd.svg?icon-path"
import siMacos from "simple-icons/icons/macos.svg?icon-path"
import siLinux from "simple-icons/icons/linux.svg?icon-path"
import siGooglechrome from "simple-icons/icons/googlechrome.svg?no-inline"
import siFirefoxbrowser from "simple-icons/icons/firefoxbrowser.svg?no-inline"
import siSafari from "simple-icons/icons/safari.svg?no-inline"
import siOpera from "simple-icons/icons/opera.svg?no-inline"
import siWechat from "simple-icons/icons/wechat.svg?no-inline"
import siQq from "simple-icons/icons/qq.svg?no-inline"

type OsKey =
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

type BrowserKey =
  | "chrome"
  | "edge"
  | "safari"
  | "firefox"
  | "opera"
  | "wechat"
  | "qq"
  | "unknown"

// Match in the same priority order even when a name contains several aliases.
const osAliases = [
  ["openwrt", /istoreos|immortalwrt/], ["debian", /raspbian/], ["ubuntu"], ["rocky"],
  ["almalinux", /alma/], ["centos"], ["fedora"], ["alpine"], ["arch", /manjaro/],
  ["opensuse", /suse/], ["freebsd"], ["windows", /win32|win64/], ["macos", /mac os|darwin|os x/],
  ["linux", /red hat|rhel|gentoo|kali|nixos|oracle|amazon/],
] as const
const browserAliases = [
  ["wechat", /微信|micromessenger/], ["qq"], ["edge", /edg/], ["opera", /opr/],
  ["firefox"], ["chrome", /chromium/], ["safari"],
] as const

function matchBrand<K extends string>(name: unknown, rules: readonly (readonly [K, RegExp?])[]): K | "unknown" {
  if (typeof name === "string") {
    const text = name.toLowerCase()
    for (const [key, alias] of rules) if (text.includes(key) || alias?.test(text)) return key
  }
  return "unknown"
}

export const osKey = (name?: string | null): OsKey => matchBrand(name, osAliases)
export const browserKey = (name?: string | null): BrowserKey => matchBrand(name, browserAliases)

type IconDef = {
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
  debian: { paths: [siDebian], color: "#A81D33" },
  ubuntu: { paths: [siUbuntu], color: "#E95420" },
  centos: { paths: [siCentos], color: "#262577" },
  rocky: { paths: [siRockylinux], color: "#10B981" },
  almalinux: { paths: [siAlmalinux], color: "#0f4266" },
  fedora: { paths: [siFedora], color: "#51A2DA" },
  alpine: { paths: [siAlpinelinux], color: "#0D597F" },
  arch: { paths: [siArchlinux], color: "#1793D1" },
  opensuse: { paths: [siOpensuse], color: "#73BA25" },
  openwrt: { paths: [siOpenwrt], color: "#00B5E2" },
  freebsd: { paths: [siFreebsd], color: "#AB2B28" },
  macos: { paths: [siMacos], color: "#374151" },
  // Per SPEC-v1.2 §2: icons missing from simple-icons (e.g. windows) use Tux (siLinux)
  windows: { paths: [siLinux], color: "#4b5563" },
  linux: { paths: [siLinux], color: "#4b5563" },
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
  const browser = BROWSER_ICON_MAP[key as BrowserKey]
  if (kind === "browser") return browser ?? BROWSER_ICON_MAP.unknown
  return (key !== "unknown" && OS_ICON_MAP[key as OsKey]) || browser || OS_ICON_MAP.unknown
}
