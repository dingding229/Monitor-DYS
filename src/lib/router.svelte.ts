/**
 * Minimal History Router for `/` and `/node/:id`.
 * Per SPEC §6:
 * - `/` Home, `/node/:id` Node Detail.
 * - Cannot occupy `/admin`, `/api`, `/install.sh`, `/agent/*`.
 */

export type Route = { page: "home"; nodeId: null } | { page: "node"; nodeId: number }

function parsePath(pathname: string): Route {
  const match = /^\/node\/(\d+)\/?$/.exec(pathname)
  if (match) {
    return { page: "node", nodeId: Number(match[1]) }
  }
  return { page: "home", nodeId: null }
}

export function createRouter(win: Window = typeof window !== "undefined" ? window : ({} as Window)) {
  let current = $state.raw(parsePath(win.location?.pathname ?? "/"))
  const scroll = () => win.requestAnimationFrame?.(() => win.scrollTo(0, current.page === "home" ? win.history.state?.homeY ?? 0 : 0))
  function onPopState() {
    current = parsePath(win.location.pathname)
    scroll()
  }
  win.addEventListener?.("popstate", onPopState)

  return {
    get route() { return current },
    navigate(id: number | null) {
      // Only these two paths belong to the theme; native links handle Hub routes.
      const path = id === null ? "/" : `/node/${id}`
      if (win.location?.pathname !== path) {
        const homeY = current.page === "home" ? win.scrollY : win.history.state?.homeY ?? 0
        if (current.page === "home") win.history.replaceState({ ...win.history.state, homeY }, "")
        win.history.pushState({ homeY }, "", path + win.location.search)
      }
      current = parsePath(path)
      scroll()
    },
    destroy() { win.removeEventListener?.("popstate", onPopState) },
  }
}
