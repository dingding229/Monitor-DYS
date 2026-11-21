let pending: Promise<typeof import("@/pages/NodeDetail.svelte")> | undefined
export const loadDetail = () => pending ??= import("@/pages/NodeDetail.svelte").catch(err => { pending = undefined; throw err })
export const prefetchDetail = () => { void loadDetail().catch(() => {}) }
