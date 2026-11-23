/**
 * Derived in part from monitor-theme-default (MIT, Copyright (c) 2026 stqfdyr).
 */
import { ApiError, api, safeNodes, type Node } from "@/lib/api"

type ConnectionState = "connecting" | "connected" | "live" | "polling"
type Snapshot = { nodes: Node[] }

type NodeStoreOptions = {
  WebSocket?: typeof globalThis.WebSocket
  fetch?: typeof globalThis.fetch
  document?: Pick<Document, "hidden" | "addEventListener" | "removeEventListener">
  location?: Pick<Location, "protocol" | "host">
  pollInterval?: number
  pollIntervalMs?: number
  staleTimeoutMs?: number
  reconnectBaseMs?: number
  cachedNodes?: Node[] | null
  onHttpSnapshot?: (nodes: Node[]) => void
  /** After each accepted network frame, even when all node references are reused. */
  onFrame?: () => void
  onRemoved?: (id: number) => void
  autoStart?: boolean
}

function inflateText(data: Blob): Promise<string> {
  return new Response(data.stream().pipeThrough(new DecompressionStream("gzip"))).text()
}

async function frameText(data: unknown): Promise<string> {
  if (typeof data === "string") return data
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    return typeof DecompressionStream === "function" ? inflateText(data) : data.text()
  }
  if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
    const buf = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    // Check gzip magic header 0x1f 0x8b
    if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b && typeof DecompressionStream === "function") {
      return inflateText(new Blob([new Uint8Array(buf)]))
    }
    return new TextDecoder().decode(buf)
  }
  return String(data)
}

// Compare JSON values, including optional fields. V8 can discard the prior frame
// once the longest-lived consumers (startup props and offscreen stubs) release it.
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return false
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>, keys = Object.keys(x)
  return keys.length === Object.keys(y).length && keys.every(k => Object.hasOwn(y,k) && same(x[k],y[k]))
}
function mergeNodes(prev: Node[] | null, next: Node[], onRemoved?: (id: number) => void): Node[] {
  if (!prev) return next
  const old = new Map(prev.map(n => [n.id, n]))
  let changed = prev.length !== next.length
  const merged = next.map((n,i) => {
    const p = old.get(n.id)
    old.delete(n.id)
    const node = p && same(p,n) ? p : n
    if (node !== prev[i]) changed = true
    return node
  })
  if (onRemoved) for (const id of old.keys()) onRemoved(id)
  return changed ? merged : prev
}

export function createNodeStore(opts: NodeStoreOptions = {}) {
  const WS = opts.WebSocket ?? globalThis.WebSocket
  const open = WS?.OPEN ?? 1
  const fetchFn = opts.fetch ?? globalThis.fetch
  const doc = opts.document ?? globalThis.document
  const loc = opts.location ?? globalThis.location ?? { protocol: "http:", host: "127.0.0.1:9911" }

  let pollMs = opts.pollIntervalMs ?? (opts.pollInterval ? opts.pollInterval * 1000 : 5000)
  const staleMs = opts.staleTimeoutMs ?? 10_000
  const baseRetryMs = opts.reconnectBaseMs ?? 2000

  let nodes = $state.raw<Node[] | null>(opts.cachedNodes ?? null)
  let error = $state<string | null>(null)
  let closed = $state<boolean>(false)
  let connected = $state<boolean>(false)
  let polling = $state<boolean>(false)
  let lastUpdated = $state<number | null>(null)

  let socket: WebSocket | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let silentTimer: ReturnType<typeof setTimeout> | null = null

  let epoch = 0
  let retryAttempts = 0
  let active = false

  function receive(list: Node[]) {
    nodes = mergeNodes(nodes, safeNodes(list), opts.onRemoved)
    lastUpdated = Date.now()
    error = null
    closed = false
    opts.onFrame?.()
  }

  function fetchOnce(initial?: Promise<Snapshot>): Promise<void> {
    const started = epoch
    return (initial ?? api<Snapshot>("/nodes", { fetch: fetchFn, retries: 2 }))
      .then((d) => {
        if (started === epoch && d && Array.isArray(d.nodes)) {
          receive(d.nodes)
          opts.onHttpSnapshot?.(d.nodes)
        }
      })
      .catch((e: unknown) => {
        if (started !== epoch) return
        if (e instanceof ApiError) {
          if (e.status === 0 && socket?.readyState === open) return
          if (e.status === 401) closed = true
        }
        error = e instanceof Error ? e.message : "网络连接失败，稍后再试"
      })
  }

  function startPolling() {
    polling = true
    if (!pollTimer) {
      pollTimer = setInterval(fetchOnce, pollMs)
    }
  }

  function stopPolling() {
    polling = false
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
      reconnect()
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
    const isCurrent = () => socket === opened && (opened.readyState ?? open) === open
    opened.onmessage = ({ data }: MessageEvent) => {
      decoded = decoded
        .then(async () => {
          if (!isCurrent()) return
          const text = await frameText(data)
          if (!isCurrent()) return
          const parsed = JSON.parse(text) as { nodes?: Node[] }
          if (!Array.isArray(parsed?.nodes)) return
          receive(parsed.nodes)
          retryAttempts = 0
          connected = true
          // Only reset stale connection timer AFTER successfully decoding a frame (SPEC §5.11)
          armWatchdog()
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
      reconnect()
    }
  }

  function reconnect() {
    startPolling()
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

  function resume(initial?: Promise<Snapshot>) {
    pause()
    retryAttempts = 0
    const resumedEpoch = epoch
    void fetchOnce(initial).then(() => {
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

  function start(initial?: Promise<Snapshot>) {
    if (active) return
    active = true
    doc?.addEventListener?.("visibilitychange", onVisibilityChange)
    if (!doc?.hidden) {
      resume(initial)
    } else {
      void initial?.catch(() => {}) // Hidden launches ignore this snapshot, including its errors.
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
    get connectionState(): ConnectionState {
      return connected ? "live" : polling ? "polling" : lastUpdated !== null ? "connected" : "connecting"
    },
    get lastUpdated() {
      return lastUpdated
    },
    start,
    stop,
    resume,
    setPollInterval,
  }
}
