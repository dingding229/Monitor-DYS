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
  let current = $state<Route>(parsePath(win.location?.pathname ?? "/"))

  function scrollAfterMount(y: number) { win.requestAnimationFrame?.(() => win.scrollTo(0,y)) }
  const onPopState = () => {
    current = parsePath(win.location?.pathname ?? "/")
    scrollAfterMount(current.page === "home" ? win.history.state?.homeY ?? 0 : 0)
  }

  if (typeof win.addEventListener === "function") {
    win.addEventListener("popstate", onPopState)
  }

  function navigate(pathOrNodeId: string | number | null) {
    const targetPath =
      pathOrNodeId === null || pathOrNodeId === "/"
        ? "/"
        : typeof pathOrNodeId === "number"
          ? `/node/${pathOrNodeId}`
          : pathOrNodeId

    if (
      targetPath.startsWith("/admin") ||
      targetPath.startsWith("/api") ||
      targetPath === "/install.sh" ||
      targetPath.startsWith("/agent/")
    ) {
      if (win.location) win.location.href = targetPath
      return
    }

    if (win.location?.pathname !== targetPath) {
      const homeY = current.page === "home" ? win.scrollY : win.history.state?.homeY ?? 0
      if (current.page === "home") win.history.replaceState({...win.history.state,homeY}, "")
      win.history.pushState({homeY}, "", targetPath + win.location.search)
    }
    current = parsePath(targetPath)
    scrollAfterMount(current.page === "home" ? win.history.state?.homeY ?? 0 : 0)
  }

  function destroy() {
    if (typeof win.removeEventListener === "function") {
      win.removeEventListener("popstate", onPopState)
    }
  }

  return {
    get route() {
      return current
    },
    get nodeId() {
      return current.nodeId
    },
    navigate,
    destroy,
  }
}
