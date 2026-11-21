export const loadDetail = () => import("@/pages/NodeDetail.svelte")
export const prefetchDetail = () => { void loadDetail().catch(() => {}) }
