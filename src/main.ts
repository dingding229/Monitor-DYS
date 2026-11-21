import { mount } from "svelte"
import "./app.css"
import App from "./App.svelte"
import { api, type Me, type Node } from "@/lib/api"
import { loadSiteConfig } from "@/lib/config"

// Start all three reads before mounting; the store consumes this snapshot exactly once.
const initialMe = api<Me>("/me")
const initialNodes = api<{ nodes: Node[] }>("/nodes", { retries: 2 })
const initialConfig = loadSiteConfig()
const target = document.getElementById("app") || document.body
target.replaceChildren()
export default mount(App, { target, props: { initialMe, initialNodes, initialConfig } })
