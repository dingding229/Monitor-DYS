import { describe, expect, it } from "vitest"
import { browserKey, osKey } from "@/lib/icons"

describe("osKey", () => {
  it.each([
    ["Debian 12", "debian"], ["Debian 13", "debian"], ["Ubuntu 24.04", "ubuntu"], ["CentOS 7", "centos"],
    ["Rocky 9", "rocky"], ["Alpine 3.20", "alpine"], ["Arch", "arch"], ["iStoreOS 25.12.6", "openwrt"],
    ["Windows Server 2022", "windows"], ["FreeBSD 14", "freebsd"], ["ImmortalWrt 24.10", "openwrt"], ["OpenWrt", "openwrt"],
    ["AlmaLinux", "almalinux"], ["Fedora Linux", "fedora"], ["openSUSE Leap", "opensuse"], ["macOS", "macos"], ["Linux", "linux"],
  ])("matches %s as %s regardless of case", (name, key) => {
    for (const value of [name, name.toLowerCase(), name.toUpperCase()]) expect(osKey(value)).toBe(key)
  })
  it.each(["", "   ", "Unrecognized OS"])("returns unknown for %j", (name) => expect(osKey(name)).toBe("unknown"))
})

describe("browserKey", () => {
  it.each([
    ["Chrome", "chrome"], ["Edge", "edge"], ["Safari", "safari"], ["Firefox", "firefox"],
    ["Opera", "opera"], ["微信", "wechat"], ["QQ 浏览器", "qq"], ["", "unknown"], ["Other Browser", "unknown"],
  ])("maps %j to %s", (name, key) => {
    expect(browserKey(name)).toBe(key)
    expect(browserKey(name.toUpperCase())).toBe(key)
  })
})
