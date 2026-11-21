/**
 * Derived in part from monitor-theme-default (MIT, Copyright (c) 2026 stqfdyr).
 */
import { ApiError, api, safeNodes, sample, speedHistory, type Node } from "@/lib/api"

export type NodeStoreOptions = {
  WebSocket?: typeof globalThis.WebSocket
  fetch?: typeof globalThis.fetch
  document?: Pick<Document, "hidden" | "addEventListener" | "removeEventListener">
  location?: Pick<Location, "protocol" | "host">
  pollInterval?: number
  pollIntervalMs?: number
  staleTimeoutMs?: number
  reconnectBaseMs?: number
  autoStart?: boolean
}

async function frameText(data: unknown): Promise<string> {
  if (typeof data === "string") return data
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    if (typeof DecompressionStream === "function") {
      return new Response(data.stream().pipeThrough(new DecompressionStream("gzip"))).text()
    }
    return data.text()
  }
  if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
    const buf = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    // Check gzip magic header 0x1f 0x8b
    if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b && typeof DecompressionStream === "function") {
      const copy = new Uint8Array(buf)
      const stream = new Blob([copy.buffer]).stream().pipeThrough(new DecompressionStream("gzip"))
      return new Response(stream).text()
    }
    return new TextDecoder().decode(buf)
  }
  return String(data)
}

export function createNodeStore(opts: NodeStoreOptions = {}) {
  const WS = opts.WebSocket ?? globalThis.WebSocket
  const fetchFn = opts.fetch ?? globalThis.fetch
  const doc = opts.document ?? (typeof document !== "undefined" ? document : undefined)
  const loc = opts.location ?? (typeof location !== "undefined" ? location : { protocol: "http:", host: "127.0.0.1:9911" })

  let pollMs = opts.pollIntervalMs ?? (opts.pollInterval ? opts.pollInterval * 1000 : 5000)
  const staleMs = opts.staleTimeoutMs ?? 10_000
  const baseRetryMs = opts.reconnectBaseMs ?? 2000

  let nodes = $state<Node[] | null>(null)
  let error = $state<string | null>(null)
  let closed = $state<boolean>(false)
  let connected = $state<boolean>(false)

  let socket: WebSocket | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let silentTimer: ReturnType<typeof setTimeout> | null = null

  let gap = false
  let epoch = 0
  let retryAttempts = 0
  let active = false

  function receive(list: Node[]) {
    const safe = safeNodes(list)
    if (gap) speedHistory.clear()
    gap = false
    sample(safe)
    nodes = safe
    error = null
    closed = false
  }

  function fetchOnce(): Promise<void> {
    const started = epoch
    return api<{ nodes: Node[] }>("/nodes", { fetch: fetchFn, retries: 2 })
      .then((d) => {
        if (started === epoch && d && Array.isArray(d.nodes)) {
          receive(d.nodes)
        }
      })
      .catch((e: unknown) => {
        if (started !== epoch) return
        const openState = (WS as { OPEN?: number })?.OPEN ?? 1
        if (e instanceof ApiError && e.status === 0 && socket?.readyState === openState) return
        error = e instanceof Error ? e.message : "网络连接失败，稍后再试"
        if (e instanceof ApiError && e.status === 401) {
          closed = true
        }
      })
  }

  function startPolling() {
    if (!pollTimer) {
      pollTimer = setInterval(fetchOnce, pollMs)
    }
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function connect() {
    if (!WS) {
      startPolling()
      return
    }
    const gzipQuery = typeof DecompressionStream === "function" ? "?gzip" : ""
    const wsProto = loc.protocol === "https:" ? "wss" : "ws"
    const url = `${wsProto}://${loc.host}/api/ws${gzipQuery}`

    let opened: WebSocket
    try {
      opened = new WS(url)
    } catch {
      startPolling()
      scheduleReconnect()
      return
    }
    socket = opened

    const armWatchdog = () => {
      if (silentTimer) clearTimeout(silentTimer)
      silentTimer = setTimeout(() => {
        error = "实时数据中断，正在重新连接"
        connected = false
        resume()
      }, staleMs)
    }

    armWatchdog()

    let decoded = Promise.resolve()
    opened.onmessage = (event: MessageEvent) => {
      decoded = decoded
        .then(async () => {
          const text = await frameText(event.data)
          const parsed = JSON.parse(text) as { nodes?: Node[] }
          if (!parsed || !Array.isArray(parsed.nodes)) throw new Error("invalid frame")
          const openState = (WS as { OPEN?: number })?.OPEN ?? 1
          if (socket !== opened || (opened.readyState !== undefined && opened.readyState !== openState)) return
          retryAttempts = 0
          connected = true
          // Only reset stale connection timer AFTER successfully decoding a frame (SPEC §5.11)
          armWatchdog()
          receive(parsed.nodes)
          stopPolling()
        })
        .catch(() => {
          // Malformed frame is ignored; watchdog is NOT reset
        })
    }

    opened.onerror = () => {
      try {
        opened.close()
      } catch {
        // ignore
      }
    }

    opened.onclose = () => {
      if (socket !== opened) return
      connected = false
      if (silentTimer) {
        clearTimeout(silentTimer)
        silentTimer = null
      }
      startPolling()
      scheduleReconnect()
    }
  }

  function scheduleReconnect() {
    if (retryTimer) clearTimeout(retryTimer)
    const delay = Math.min(30_000, baseRetryMs * 2 ** retryAttempts)
    retryAttempts++
    retryTimer = setTimeout(() => {
      retryTimer = null
      connect()
    }, delay)
  }

  function pause() {
    epoch++
    connected = false
    if (socket) {
      socket.onclose = null
      socket.onerror = null
      socket.onmessage = null
      try {
        socket.close()
      } catch {
        // ignore
      }
      socket = null
    }
    stopPolling()
    if (retryTimer) clearTimeout(retryTimer)
    if (silentTimer) clearTimeout(silentTimer)
    retryTimer = silentTimer = null
  }

  function resume() {
    pause()
    retryAttempts = 0
    gap = true
    const resumedEpoch = epoch
    void fetchOnce().then(() => {
      if (resumedEpoch === epoch && !doc?.hidden) connect()
    })
  }

  function onVisibilityChange() {
    if (doc?.hidden) {
      pause()
    } else {
      resume()
    }
  }

  function start() {
    if (active) return
    active = true
    doc?.addEventListener?.("visibilitychange", onVisibilityChange)
    if (!doc?.hidden) {
      resume()
    }
  }

  function stop() {
    active = false
    doc?.removeEventListener?.("visibilitychange", onVisibilityChange)
    pause()
  }

  function setPollInterval(seconds: number) {
    if (typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 1) {
      pollMs = seconds * 1000
      if (pollTimer) {
        stopPolling()
        startPolling()
      }
    }
  }

  if (opts.autoStart !== false) {
    start()
  }

  return {
    get nodes() {
      return nodes
    },
    get error() {
      return error
    },
    get closed() {
      return closed
    },
    get connected() {
      return connected
    },
    start,
    stop,
    destroy: stop,
    pause,
    resume,
    fetchOnce,
    setPollInterval,
  }
}

export const useNodes = createNodeStore
