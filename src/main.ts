import { mount } from "svelte"
import "./app.css"
import App from "./App.svelte"
import { api, type Me, type Node } from "@/lib/api"
import { loadSiteConfig } from "@/lib/config"
import { accentPalette, DEFAULT_ACCENT, paintAccent, readCachedAccent, type AccentPalette } from "@/lib/theme"

// Start all three reads before deciding whether to wait for the color.
const initialMe = api<Me>("/me")
const initialNodes = api<{ nodes: Node[] }>("/nodes", { retries: 2 })
const initialConfig = loadSiteConfig()

function start(palette: AccentPalette) {
  paintAccent(palette)
  const target = document.getElementById("app") || document.body
  target.replaceChildren()
  mount(App, { target, props: { initialMe, initialNodes, initialConfig } })
}

const cached = readCachedAccent()
if (cached) start(cached)
else {
  // The original promises still report errors to the app when it mounts.
  for (const pending of [initialMe, initialNodes]) void pending.catch(() => {})
  let timer: number
  const deadline = new Promise<undefined>(done => { timer = window.setTimeout(done, 1500) })
  void Promise.race([initialConfig, deadline]).then(result => {
    clearTimeout(timer)
    start(accentPalette(result?.config.accent_color ?? DEFAULT_ACCENT))
  })
}
