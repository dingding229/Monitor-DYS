import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';

const { values: args } = parseArgs({ options: {
  port: { type: 'string', default: '9911' },
  scenario: { type: 'string', default: 'normal' },
  dist: { type: 'string', default: 'dist' },
} });
const port = Number(args.port);
if (!/^\d+$/.test(args.port) || port > 65535) throw new Error('--port 必须是 0–65535 的整数');
if (!/^[a-z0-9][a-z0-9.-]*$/.test(args.scenario)) throw new Error('--scenario 名称无效');

function fixture(name) {
  return JSON.parse(readFileSync(new URL(`../fixtures/scenarios/${name}.json`, import.meta.url), 'utf8'));
}

const normal = fixture('normal');
const scenario = args.scenario === 'normal' ? normal : fixture(args.scenario);
const me = { ...normal.me, ...scenario.me };
if (scenario.legacy) delete me.history_days;
const dist = resolve(args.dist);
const started = Date.now();
const GiB = 1024 ** 3;
const MiB = 1024 ** 2;
const own = (obj, key) => Object.hasOwn(obj, key);
const omit = (obj, fields) => { for (const field of fields ?? []) delete obj[field]; };
const groups = ['亚太', '欧洲', '美洲'];
const nodeSeeds = normal.nodes.map((seed, index) => ({
  ...seed,
  ...(scenario.groupMode === 'none' ? { group: '' } : {}),
  ...(scenario.groupMode === 'all' && !seed.group ? { group: groups[index % groups.length] } : {}),
  ...scenario.nodeOverrides?.[seed.id],
})).filter((seed) => me.authed || seed.public !== false);

function dateAfter(days) {
  const date = new Date(started);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function storageFor(id) {
  return { mem_total: (2 + (id % 4) * 2) * GiB, swap_total: (id % 2) * GiB, disk_total: (20 + id * 10) * GiB };
}

// Sample the same bounded resource usage for the live snapshot and historical buckets.
function usageAt(storage, id, ts) {
  const minute = Math.floor(ts / 60);
  return {
    mem_used: Math.round(storage.mem_total * (0.45 + 0.035 * Math.sin(minute / 17 + id))),
    swap_used: Math.round(storage.swap_total * (0.10 + 0.009 * Math.sin(minute / 29 + id))),
    disk_used: Math.round(storage.disk_total * (0.30 + 0.012 * Math.sin(minute / 47 + id))),
  };
}

function snapshot() {
  const now = Math.floor(Date.now() / 1000);
  const elapsed = Math.max(0, Math.floor((Date.now() - started) / 1000));
  const tick = Math.floor(elapsed / 2);
  const nodes = nodeSeeds.map((seed, index) => {
    const { id } = seed;
    const online = seed.online ?? true;
    const age = own(seed, 'last_seen_ago') ? (seed.last_seen_ago === null ? null : seed.last_seen_ago + elapsed) : 1;
    const storage = storageFor(id);
    const traffic = { total_rx: id * 38 * GiB + tick * 23456, total_tx: id * 23 * GiB + tick * 12345,
      month_rx: id * 3 * GiB + tick * 23456, month_tx: id * 2 * GiB + tick * 12345 };
    const custom = scenario.metricOverrides ?? {};
    const metrics = !online || (own(custom, id) && custom[id] === null) ? null : {
      uptime: 86400 * id + elapsed, cpu: 7 + ((id * 11 + tick) % 75), load: [0.8, 0.6, 0.4],
      ...storage, ...usageAt(storage, id, now), net_rx: id * 20000 + (tick % 20) * 6200,
      net_tx: id * 9000 + (tick % 16) * 4100, ...traffic, tcp: 90 + id, udp: 10 + id, procs: 100 + id,
      ...custom[id],
    };
    const node = {
      public: true, public_remark: '', ...seed, online, sort: index, metrics,
      last_seen: age === null ? 0 : now - age, last_seen_ago: age,
      os: id % 3 ? 'Debian GNU/Linux 12' : 'Ubuntu 24.04 LTS', kernel: '6.1.0',
      arch: id % 4 ? 'x86_64' : 'aarch64', virt: id % 5 ? 'kvm' : 'lxc',
      cpu_name: 'AMD EPYC 7B13', cpu_cores: 2 + (id % 4) * 2, ...storage,
      agent_version: '1.4.3', expires_at: seed.expires_in === null ? null : dateAfter(seed.expires_in),
      traffic_limit: id % 3 ? 2 * 1024 * GiB : 0, traffic_mode: 'sum', traffic_reset_day: 1,
      ...traffic, month_used: traffic.month_rx + traffic.month_tx, month_start: `${dateAfter(0).slice(0, 7)}-01`,
      day_rx: id * 20 * MiB, day_tx: id * 12 * MiB,
    };
    if (!me.authed) omit(node, ['hostname', 'ip', 'ipv4', 'ipv6', 'ipv4_pin', 'ipv6_pin', 'ipv4_auto', 'ipv6_auto', 'addresses', 'remark']);
    omit(node, ['token', ...(scenario.omitNodeFields ?? [])]);
    return node;
  });
  return { admin: me.authed, nodes };
}

const probes = [[9, '东京探测'], [2, '法兰克福探测']];
function positiveInt(value, fallback) {
  return value && /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : fallback;
}
function history(id, query) {
  const hours = Math.min(positiveInt(query.get('hours'), 6), (me.history_days ?? 7) * 24);
  const points = Math.max(60, Math.min(1440, positiveInt(query.get('points'), 1440)));
  const series = query.get('series');
  const duration = hours * 3600;
  const quantum = hours <= 168 ? 60 : 3600;
  const step = Math.ceil(duration / (points * quantum)) * quantum;
  const end = Math.floor(Date.now() / 60000) * 60;
  const start = end - duration;
  const times = Array.from({ length: Math.ceil(duration / step) }, (_, i) => start + i * step);
  const storage = storageFor(id);
  const metrics = series === 'ping' ? [] : times.map((ts, i) => {
    const available = Math.min(step, end - ts) / 60;
    const minutes = i % 13 === 4 ? Math.floor(available / 2) : available;
    const cpu = 8 + ((id * 7 + i * 3) % 50);
    const net_rx = 20000 + ((i * 23511 + id * 563) % 600000);
    const net_tx = 10000 + ((i * 8251 + id * 271) % 250000);
    const midpoint = ts + available * 30;
    const point = { ts, minutes, cpu, cpu_max: cpu + 12, ...usageAt(storage, id, midpoint), net_rx, net_tx,
      net_rx_max: net_rx * 3, net_tx_max: net_tx * 2, tcp: 80 + (i % 20), udp: 8 + (i % 9), procs: 90 + (i % 12) };
    omit(point, scenario.omitHistoryFields);
    return point;
  });
  if (series === 'metrics') return { ...(scenario.legacy ? {} : { step }), metrics, ping: [], probes: {} };
  const ping = probes.flatMap(([task_id], probe) => times.map((ts, i) => {
    if (i % 37 === 7) return { task_id, ts, latency: null, loss: 100 };
    const latency = 16 + probe * 42 + (i % 9);
    return { task_id, ts, latency, band: [latency - 2, latency + 3], ...(i % 19 === 9 ? { loss: 25 } : {}) };
  }));
  if (scenario.legacy) ping.sort((a, b) => a.ts - b.ts);
  return { ...(scenario.legacy ? {} : { step }), metrics, ping, probes: Object.fromEntries(probes) };
}

const errors = {
  400: '请求格式不正确', 401: '需要登录后查看', 404: '未找到请求的资源', 405: '不支持该请求方法',
  426: '需要 WebSocket 连接', 500: '服务暂时无法访问', 503: '实时连接暂不可用，稍后再试',
};
function errorPayload(status) {
  return status === 502
    ? { type: 'text/html; charset=utf-8', body: '<!doctype html><html><title>502 Bad Gateway</title><h1>502 Bad Gateway</h1></html>' }
    : { type: 'text/plain; charset=utf-8', body: errors[status] };
}
function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
  res.end(body);
}
function error(res, status) {
  const { type, body } = errorPayload(status);
  send(res, status, type, body);
}
const json = (res, data) => send(res, 200, 'application/json; charset=utf-8', JSON.stringify(data));
const urlFor = (req) => new URL(`http://localhost${req.url}`);
const apiStatus = (path) => scenario.apiStatus ?? scenario.routeStatus?.[path];
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.wasm': 'application/wasm',
};
async function staticFile(root, filename) {
  try {
    const target = await realpath(filename);
    if (!target.startsWith(`${root}${sep}`)) return null;
    const info = await stat(target);
    return info.isFile() ? { target, size: info.size } : null;
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return null;
    throw err;
  }
}
async function serveStatic(path, req, res) {
  let decoded;
  try { decoded = decodeURIComponent(path); } catch { return error(res, 400); }
  if (decoded.includes('\0')) return error(res, 400);
  if (/^\/(?:api|admin|install\.sh|agent)(?:\/|$)/.test(decoded) && decoded !== path) return error(res, 404);
  let root;
  try { root = await realpath(dist); } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return error(res, 404);
    throw err;
  }
  const file = await staticFile(root, resolve(root, `.${decoded}`)) ?? await staticFile(root, resolve(root, 'index.html'));
  if (!file) return error(res, 404);
  res.writeHead(200, { 'Content-Type': types[extname(file.target)] ?? 'application/octet-stream',
    'Content-Length': file.size, 'Cache-Control': 'no-store' });
  if (req.method === 'HEAD') res.end();
  else pipeline(createReadStream(file.target), res, () => {});
}

async function handle(req, res) {
  const url = urlFor(req);
  const path = url.pathname;
  if (/^\/api(?:\/|$)/.test(path)) {
    const status = apiStatus(path);
    if (status) return error(res, status);
    if (req.method !== 'GET' && req.method !== 'HEAD') return error(res, 405);
    if (path === '/api/me') return json(res, me);
    if (path === '/api/nodes') return json(res, snapshot());
    if (path === '/api/themes/dys/config') return json(res, scenario.config ?? normal.config);
    if (path === '/api/ws') return error(res, 426);
    const match = /^\/api\/nodes\/(\d+)\/metrics$/.exec(path);
    if (match) {
      const id = Number(match[1]);
      return nodeSeeds.some((node) => node.id === id) ? json(res, history(id, url.searchParams)) : error(res, 404);
    }
    return error(res, 404);
  }
  if (/^\/(?:admin|install\.sh|agent)(?:\/|$)/.test(path)) return error(res, 404);
  if (req.method !== 'GET' && req.method !== 'HEAD') return error(res, 405);
  return serveStatic(path, req, res);
}

const server = createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error(err);
    if (res.headersSent) res.destroy(err);
    else error(res, 500);
  });
});

function frame(opcode, payload) {
  const n = payload.length;
  const header = Buffer.alloc(n < 126 ? 2 : n <= 65535 ? 4 : 10);
  header[0] = 0x80 | opcode;
  if (n < 126) header[1] = n;
  else if (n <= 65535) { header[1] = 126; header.writeUInt16BE(n, 2); }
  else { header[1] = 127; header.writeBigUInt64BE(BigInt(n), 2); }
  return Buffer.concat([header, payload]);
}

function rejectUpgrade(socket, status) {
  const { type, body } = errorPayload(status);
  const reason = { 400: 'Bad Request', 401: 'Unauthorized', 404: 'Not Found', 426: 'Upgrade Required', 502: 'Bad Gateway', 503: 'Service Unavailable' }[status];
  socket.end(`HTTP/1.1 ${status} ${reason}\r\nContent-Type: ${type}\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`);
}

server.on('upgrade', (req, socket, head) => {
  socket.on('error', () => socket.destroy());
  let url;
  try { url = urlFor(req); } catch { return rejectUpgrade(socket, 400); }
  if (url.pathname !== '/api/ws') return rejectUpgrade(socket, 404);
  const status = apiStatus(url.pathname);
  if (status) return rejectUpgrade(socket, status);
  const key = req.headers['sec-websocket-key'];
  if (req.method !== 'GET' || req.headers.upgrade?.toLowerCase() !== 'websocket' ||
      req.headers['sec-websocket-version'] !== '13' || typeof key !== 'string' || !/^[A-Za-z0-9+/]{22}==$/.test(key)) {
    return rejectUpgrade(socket, 400);
  }
  const accept = createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  const gzip = url.searchParams.has('gzip') && !scenario.legacy && !me.authed;
  const push = () => {
    if (!socket.writable || socket.writableLength) return;
    const payload = Buffer.from(JSON.stringify(snapshot()));
    socket.write(frame(gzip ? 0x2 : 0x1, gzip ? gzipSync(payload) : payload));
  };
  const timer = setInterval(push, 2000);
  socket.once('close', () => clearInterval(timer));
  // Read-only stream; the only supported client frames are masked control frames.
  let pending = Buffer.alloc(0);
  const close = (payload) => { clearInterval(timer); socket.end(frame(0x8, payload)); };
  function receive(chunk) {
    if (socket.writableEnded) return;
    pending = Buffer.concat([pending, chunk]);
    while (pending.length >= 2) {
      const opcode = pending[0] & 0x0f;
      const length = pending[1] & 0x7f;
      if ((pending[0] & 0xf0) !== 0x80 || !(pending[1] & 0x80) || length > 125 || ![0x8, 0x9, 0xa].includes(opcode) || (opcode === 0x8 && length === 1)) {
        return close(Buffer.from([0x03, 0xea])); // protocol error (1002)
      }
      if (pending.length < 6 + length) return;
      const payload = Buffer.from(pending.subarray(6, 6 + length));
      for (let i = 0; i < length; i++) payload[i] ^= pending[2 + i % 4];
      pending = pending.subarray(6 + length);
      if (opcode === 0x8) return close(payload);
      if (opcode === 0x9) socket.write(frame(0xa, payload));
    }
  }
  socket.on('data', receive);
  if (head.length) receive(head);
  push();
});

server.listen(port, '127.0.0.1', () => console.log(`Mock Hub (${args.scenario}): http://127.0.0.1:${server.address().port} → ${dist}`));
