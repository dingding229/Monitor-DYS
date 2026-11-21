import type { Metrics, Node } from "../../src/lib/api"

export function metricFixture(overrides: Partial<Metrics> = {}): Metrics {
  return {
    uptime: 123, cpu: 0.5, load: [0.1, 0.2, 0.3], mem_total: 4096, mem_used: 2048,
    disk_total: 8192, disk_used: 1024, net_rx: 600, net_tx: 300,
    total_rx: 90_000, total_tx: 45_000, month_rx: 9000, month_tx: 4500,
    ...overrides,
  }
}

export function nodeFixture(overrides: Partial<Node> = {}): Node {
  return {
    id: 1, name: "Test node", sort: 0, online: true, country: "JP", group: "",
    last_seen: 1_700_000_000, metrics: metricFixture(), os: "Debian", kernel: "6.1",
    arch: "x86_64", virt: "kvm", cpu_name: "EPYC", cpu_cores: 2,
    mem_total: 4096, disk_total: 8192, agent_version: "1.4.3", price: 12, currency: "JPY",
    billing_cycle: "monthly", expires_at: null, traffic_limit: 1024, traffic_mode: "sum",
    traffic_reset_day: 1, total_rx: 90_000, total_tx: 45_000, month_rx: 9000, month_tx: 4500,
    month_start: "2026-11-01", day_rx: 900, day_tx: 450,
    ...overrides,
  }
}
