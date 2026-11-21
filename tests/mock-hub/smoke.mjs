import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const root = dirname(fileURLToPath(import.meta.url));
const tmp = mkdtempSync(join(root, '.smoke-'));
const staticIndex = '<!doctype html><title>Mock smoke</title>\n';
const upgrade = ['Connection: Upgrade', 'Upgrade: websocket', 'Sec-WebSocket-Version: 13', 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ=='];
const reads = ['/api/me', '/api/nodes', '/api/nodes/1/metrics', '/api/themes/dys/config', '/api/ws'];

function curl(base, path, headers = []) {
  const output = execFileSync('curl', ['-sS', '--max-time', '5', '--http1.1',
    ...headers.flatMap((header) => ['-H', header]), '-w', '\n%{http_code}\n%{content_type}', `${base}${path}`], { encoding: 'utf8' });
  const info = /\n(\d{3})\n([^\n]*)$/.exec(output);
  assert.ok(info);
  return { status: Number(info[1]), type: info[2], body: output.slice(0, info.index) };
}
function get(base, path) {
  const { status, type, body } = curl(base, path);
  assert.equal(status, 200, path);
  assert.match(type, /^application\/json/);
  return JSON.parse(body);
}

async function scenario(name, test, extraArgs = []) {
  const child = spawn(process.execPath, [join(root, 'server.mjs'), '--port', '0', '--scenario', name, '--dist', tmp, ...extraArgs], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const exit = once(child, 'exit');
  const lines = createInterface({ input: child.stdout });
  try {
    const [line] = await Promise.race([once(lines, 'line', { signal: AbortSignal.timeout(5000) }), exit.then(() => [])]);
    const match = /http:\/\/127\.0\.0\.1:\d+/.exec(line ?? '');
    assert.ok(match, `Mock Hub failed to start: ${name}`);
    const message = await test(match[0]);
    console.log(`${name}: ${message}`);
  } finally {
    lines.close();
    child.kill();
    await exit;
  }
}

async function frames(base, { query = '', gzip = false, count = 1, intervalMs = 2000 } = {}) {
  const ws = new WebSocket(`${base.replace(/^http:/, 'ws:')}/api/ws${query}`);
  ws.binaryType = 'arraybuffer';
  const received = [];
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for WebSocket frames')), 7500);
      const done = (err) => { clearTimeout(timeout); if (err) reject(err); else resolve(); };
      ws.addEventListener('error', () => done(new Error('Unexpected WebSocket error')), { once: true });
      ws.addEventListener('message', ({ data }) => {
        try {
          let text;
          if (gzip) { assert.ok(data instanceof ArrayBuffer); text = gunzipSync(Buffer.from(data)).toString(); }
          else { assert.equal(typeof data, 'string'); text = data; }
          const payload = JSON.parse(text);
          const { nodes } = payload;
          assert.ok(nodes.length > 0);
          received.push({ at: performance.now(), payload });
          if (received.length === count) done();
        } catch (err) { done(err); }
      });
    });
    for (let i = 1; i < received.length; i++) {
      const interval = received[i].at - received[i - 1].at;
      assert.ok(interval >= intervalMs * 0.75 && interval <= intervalMs * 1.5, `Expected ≈${intervalMs}ms; got ${interval}ms`);
    }
    return received.map(({ payload }) => payload);
  } finally { ws.close(); }
}

try {
  mkdirSync(join(tmp, 'assets'));
  writeFileSync(join(tmp, 'index.html'), staticIndex);
  writeFileSync(join(tmp, 'assets', 'site.css'), 'body { color: black; }');
  await scenario('normal', async (base) => {
    const me = get(base, '/api/me');
    assert.equal(me.public_page, true);
    assert.equal(me.authed, false);
    assert.equal(me.history_days, 90);
    const { nodes } = get(base, '/api/nodes');
    assert.equal(nodes.length, 16);
    const countries = new Set(nodes.map(({ country }) => country));
    assert.equal(countries.size, 12);
    for (const country of ['CN', 'HK', 'JP', 'SG', 'US', 'DE', 'GB', 'KR']) assert.ok(countries.has(country));
    assert.deepEqual([...new Set(nodes.map(({ group }) => group))], ['亚太', '欧洲', '美洲', '']);
    assert.deepEqual([...new Set(nodes.map(({ expires_in }) => expires_in))].sort((a, b) => (a ?? 100) - (b ?? 100)), [-3, 0, 3, 5, 15, 30, 60, null]);
    const offlineAges = nodes.filter(({ online }) => !online).map(({ last_seen_ago }) => last_seen_ago);
    assert.equal(offlineAges.length, 2);
    assert.ok(offlineAges[0] >= 4500);
    assert.equal(offlineAges[1], null);
    assert.ok(nodes.some(({ billing_cycle }) => /^\d+m$/.test(billing_cycle)));
    assert.ok(nodes.some(({ billing_cycle }) => billing_cycle === 'once'));
    const operatingSystems = new Set(nodes.map(({ os }) => os));
    for (const name of ['Debian 12', 'Debian 13', 'Ubuntu 24.04', 'CentOS 7', 'Rocky 9', 'Alpine 3.20', 'Arch', 'iStoreOS 25.12.6', 'Windows Server 2022', 'FreeBSD 14']) {
      assert.ok(operatingSystems.has(name), name);
    }
    const currencies = new Set(nodes.map(({ currency }) => currency));
    for (const code of ['CNY', 'USD', 'EUR', 'JPY', 'HKD', 'CAD', 'GBP']) assert.ok(currencies.has(code));
    assert.ok(nodes.some(({ traffic_limit }) => traffic_limit === 0));
    assert.deepEqual([...new Set(nodes.map(({ traffic_mode }) => traffic_mode))].sort(), ['down', 'max', 'sum', 'up']);
    for (const node of nodes) {
      for (const key of ['traffic_limit', 'month_used', 'day_rx', 'day_tx', 'price', 'swap_total', 'cpu_cores']) {
        assert.ok(Number.isFinite(node[key]) && node[key] >= 0, `${node.id}: ${key}`);
      }
      assert.match(node.month_start, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(node.traffic_reset_day >= 1 && node.traffic_reset_day <= 31);
      assert.equal(typeof node.cpu_name, 'string');
      assert.equal(typeof node.public_remark, 'string');
      const { month_rx: rx, month_tx: tx } = node;
      assert.equal(node.month_used, { down: rx, max: Math.max(rx, tx), sum: rx + tx, up: tx }[node.traffic_mode]);
    }
    assert.match(nodes.find(({ id }) => id === 13).month_start, /-(?:28|29|30|31)$/);
    assert.deepEqual(get(base, '/api/themes/dys/config'), {});
    assert.equal(curl(base, '/').body, staticIndex);
    assert.equal(curl(base, '/node/1').body, staticIndex);
    assert.match(curl(base, '/assets/site.css').type, /^text\/css/);
    assert.equal(curl(base, '/api/unknown').status, 404);
    assert.equal(curl(base, '/api/nodes/999/metrics').status, 404);
    assert.equal(curl(base, '/admin').status, 404);
    const short = get(base, '/api/nodes/1/metrics?hours=6&points=61&series=metrics');
    assert.equal(short.step, 360);
    assert.ok(short.metrics.length <= 61 && short.metrics.some(({ minutes }) => minutes < short.step / 60));
    assert.ok(short.metrics.every(({ cpu, cpu_max }) => cpu_max >= cpu));
    assert.deepEqual(short.ping, []);
    for (const key of ['mem_used', 'disk_used', 'swap_used']) {
      const live = nodes[0].metrics[key];
      assert.ok(live > 0);
      assert.ok(short.metrics.every((bucket) => Math.abs(bucket[key] - live) / live < 0.25), key);
      assert.ok(new Set(short.metrics.map((bucket) => bucket[key])).size > 1, key);
    }
    for (const node of nodes.slice(12)) {
      const history = get(base, `/api/nodes/${node.id}/metrics?hours=6&series=metrics`);
      assert.ok(history.metrics.length > 0);
      for (const key of ['mem_used', 'disk_used', 'swap_used']) {
        const live = node.metrics[key];
        assert.ok(history.metrics.every((bucket) => live === 0 ? bucket[key] === 0 : Math.abs(bucket[key] - live) / live < 0.25), `${node.id}: ${key}`);
      }
    }
    const noSwap = get(base, '/api/nodes/2/metrics?hours=6&series=metrics');
    assert.ok(noSwap.metrics.every(({ swap_used }) => swap_used === 0));
    const long = get(base, '/api/nodes/1/metrics?hours=9999&points=30&series=ping');
    assert.equal(long.step, 129600);
    assert.deepEqual(long.metrics, []);
    assert.deepEqual([...new Set(long.ping.map(({ task_id }) => task_id))], [9, 2]);
    assert.equal(long.probes['9'], '东京探测');
    assert.ok(long.ping.length > 0 && long.ping.every(({ loss, latency }) => loss === 0 && latency !== null));
    assert.ok(Object.values(long.loss).every((loss) => loss === 0));
    const homePing = get(base, '/api/nodes/1/metrics?hours=1&points=12&series=ping');
    assert.equal(homePing.step, 60);
    assert.deepEqual(homePing.metrics, []);
    assert.deepEqual(homePing.probes, { 9: '东京探测', 2: '法兰克福探测' });
    assert.deepEqual(homePing.loss, { 9: 0, 2: 0 });
    for (const id of [9, 2]) {
      const points = homePing.ping.filter(({ task_id }) => task_id === id);
      assert.equal(points.length, 60);
      assert.ok(points.every((point, i) => point.loss === 0 && Number.isFinite(point.latency) && (!i || point.ts - points[i - 1].ts === 60)));
    }
    const full = get(base, '/api/nodes/1/metrics');
    assert.equal(full.step, 60);
    assert.ok(full.metrics.length && full.ping.length);
    const streams = await Promise.all([frames(base, { count: 2 }), frames(base, { query: '?gzip=0', gzip: true, count: 2 })]);
    assert.ok(streams.flat().every(({ nodes, admin }) => nodes.length === 16 && admin === false));
    for (const [a, b] of streams) assert.notEqual(a.nodes[0].metrics.net_rx, b.nodes[0].metrics.net_rx);
    return '16 nodes / 12 countries; OS, CAD/GBP billing + traffic, static/SPA and API OK; history step 360s/129600s and storage near live; homepage ping (hours=1, points=12): 60 minute samples per probe, loss=0; text + gzip pushes ≈2s apart';
  });
  await scenario('many', async (base) => {
    const { nodes } = get(base, '/api/nodes');
    assert.equal(nodes.length, 500);
    assert.equal(new Set(nodes.map(({ id }) => id)).size, 500);
    assert.equal(new Set(nodes.map(({ country }) => country)).size, 20);
    assert.equal(new Set(nodes.map(({ group }) => group)).size, 6);
    assert.ok(nodes.every((node) => node.price > 0 && node.currency && node.billing_cycle && Number.isInteger(node.expires_in)));

    const ping = get(base, '/api/nodes/500/metrics?series=ping&hours=1&points=12');
    assert.deepEqual(ping.metrics, []);
    assert.equal(ping.step, 300);
    assert.equal(Object.keys(ping.probes).length, 3);
    for (const id of Object.keys(ping.probes)) {
      const points = ping.ping.filter(({ task_id }) => String(task_id) === id);
      assert.equal(points.length, 12);
      assert.ok(points.every((point, i) => Number.isFinite(point.latency) && (!i || point.ts - points[i - 1].ts === 300)));
    }

    const pushes = await frames(base, { query: '?gzip', gzip: true, count: 5, intervalMs: 1000 });
    const changedIds = new Set();
    for (const [i, push] of pushes.entries()) {
      assert.deepEqual(push.nodes.map(({ id }) => id), nodes.map(({ id }) => id));
      if (!i) continue;
      const prev = pushes[i - 1].nodes;
      const changed = push.nodes.filter((node, j) => JSON.stringify(node) !== JSON.stringify(prev[j]));
      assert.equal(changed.length, 150);
      assert.equal(push.nodes.filter(({ metrics }, j) => metrics.cpu !== prev[j].metrics.cpu).length, 150);
      changed.forEach(({ id }) => changedIds.add(id));
    }
    assert.equal(changedIds.size, 500);
    return '500 nodes / 20 countries / 6 groups; gzip pushes ≈1s apart with 150/500 nodes changing each frame; 3 probes × 12 buckets';
  });
  await scenario('nogroups', (base) => {
    assert.ok(get(base, '/api/nodes').nodes.every(({ group }) => group === ''));
    return 'all groups empty';
  });
  await scenario('allgrouped', (base) => {
    assert.ok(get(base, '/api/nodes').nodes.every(({ group }) => group));
    return 'all nodes grouped';
  });
  await scenario('admin', async (base) => {
    assert.equal(get(base, '/api/me').authed, true);
    const { admin, nodes } = get(base, '/api/nodes');
    assert.equal(admin, true);
    assert.equal(nodes.length, 16);
    const tokyo = nodes.find(({ id }) => id === 1);
    assert.equal(tokyo.hostname, 'tokyo.example.invalid');
    assert.equal(tokyo.ip, '192.0.2.1');
    assert.equal(tokyo.ipv4, '192.0.2.1');
    assert.equal(tokyo.ipv6, '2001:db8::1');
    assert.equal(tokyo.remark, '仅管理员可见的东京备注');
    assert.ok(nodes.every((node) => node.ip && node.ipv4 && node.hostname && node.remark && !('token' in node)));
    assert.equal(nodes.find(({ id }) => id === 12).public, false);
    assert.ok(get(base, '/api/nodes/12/metrics').metrics.length);
    const [push] = await frames(base, { query: '?gzip' });
    assert.equal(push.admin, true);
    assert.equal(push.nodes[0].remark, tokyo.remark);
    return 'authed, admin fields + private node/history, text frame even with ?gzip';
  });
  await scenario('anonymous', (base) => {
    const { admin, nodes } = get(base, '/api/nodes');
    assert.equal(admin, false);
    assert.equal(get(base, '/api/me').authed, false);
    assert.equal(nodes.length, 15);
    assert.ok(nodes.every((node) => node.public && ['hostname', 'ip', 'ipv4', 'ipv6', 'remark', 'token'].every((key) => !(key in node))));
    assert.equal(curl(base, '/api/nodes/12/metrics').status, 404);
    return '15 public nodes, no admin fields, private history 404';
  });
  await scenario('legacy-1.2', async (base) => {
    assert.ok(!('history_days' in get(base, '/api/me')));
    const node = get(base, '/api/nodes').nodes[0];
    for (const key of ['group', 'expires_in', 'last_seen_ago', 'public_remark']) assert.ok(!(key in node));
    const hist = get(base, '/api/nodes/1/metrics?hours=999&points=60');
    assert.ok(!('step' in hist));
    for (const key of ['cpu_max', 'net_rx_max', 'net_tx_max', 'minutes', 'swap_used', 'tcp', 'udp', 'procs']) assert.ok(!(key in hist.metrics[0]));
    assert.equal(curl(base, '/api/themes/dys/config').status, 404);
    await frames(base, { query: '?gzip' });
    return 'old fields absent, config 404, text frame even with ?gzip';
  });
  await scenario('corrupt', (base) => {
    const [a, b] = get(base, '/api/nodes').nodes;
    assert.equal(typeof a.metrics.cpu, 'string');
    assert.equal(b.metrics.load.length, 2);
    return 'invalid CPU type and load tuple';
  });
  await scenario('waiting', (base) => {
    const [node] = get(base, '/api/nodes').nodes;
    assert.equal(node.online, true);
    assert.equal(node.metrics, null);
    return 'online with metrics: null';
  });
  await scenario('private', (base) => {
    for (const path of reads) {
      const result = curl(base, path, path === '/api/ws' ? upgrade : []);
      assert.deepEqual(result, { status: 401, type: 'text/plain; charset=utf-8', body: '需要登录后查看' });
    }
    assert.equal(curl(base, '/').status, 200);
    return 'all five reads return 401 text/plain; static shell remains readable';
  });
  await scenario('ws503', (base) => {
    const result = curl(base, '/api/ws?gzip', upgrade);
    assert.equal(result.status, 503);
    assert.match(result.type, /^text\/plain/);
    assert.equal(get(base, '/api/nodes').nodes.length, 16);
    return 'upgrade 503, polling 200';
  });
  await scenario('proxy502', (base) => {
    for (const path of reads) {
      const result = curl(base, path, path === '/api/ws' ? upgrade : []);
      assert.equal(result.status, 502);
      assert.match(result.type, /^text\/html/);
      assert.match(result.body, /502 Bad Gateway/);
    }
    return 'all five reads return 502 text/html';
  });
  await scenario('fewpoints', (base) => {
    for (const points of [60, 1440]) {
      const data = get(base, `/api/nodes/1/metrics?hours=720&points=${points}`);
      assert.equal(data.step, 3600);
      const times = data.metrics.map(({ ts }) => ts);
      assert.equal(times.length, 4);
      assert.equal(times.at(-1) - times[0], 3 * 3600);
      assert.equal(data.metrics.at(-1).minutes, 1);
      for (const id of [9, 2]) {
        assert.deepEqual(data.ping.filter(({ task_id }) => task_id === id).map(({ ts }) => ts), times);
      }
    }
    const short = get(base, '/api/nodes/1/metrics?hours=1&points=60&series=metrics');
    assert.ok(short.metrics.length <= 60);
    assert.ok(short.metrics.at(-1).ts - short.metrics[0].ts < 3600);
    return '30-day history has 4 hourly buckets over 3 hours; partial last bucket and aligned probes';
  });
  await scenario('noping', (base) => {
    const ping = get(base, '/api/nodes/1/metrics?series=ping&hours=1&points=12');
    assert.deepEqual(ping, { step: 60, metrics: [], ping: [], probes: {} });
    const all = get(base, '/api/nodes/1/metrics');
    assert.ok(all.metrics.length > 0);
    assert.deepEqual(all.ping, []);
    assert.deepEqual(all.probes, {});
    return 'homepage ping returns empty ping/probes; resource history remains available';
  });
  await scenario('lossy', (base) => {
    const data = get(base, '/api/nodes/1/metrics?hours=6&series=ping');
    assert.ok(data.ping.some(({ loss }) => loss === 25));
    assert.ok(data.ping.some(({ loss, latency }) => loss === 100 && latency === null));
    assert.ok(Object.values(data.loss).some((loss) => loss > 0));
    return 'positive loss, timed-out buckets and per-probe loss totals';
  });
  for (const [name, slowPath, fastPath, expectedMs, overrides] of [
    ['slowconfig', '/api/themes/dys/config', '/api/nodes', 600, []],
    ['slownodes', '/api/nodes', '/api/themes/dys/config', 1000, []],
    ['normal', '/api/themes/dys/config', '/api/nodes', 150, ['--delay-config', '150', '--delay-nodes', '0']],
  ]) {
    await scenario(name, async (base) => {
      const start = performance.now();
      const order = [];
      const request = async (path) => {
        const response = await fetch(base + path, { signal: AbortSignal.timeout(5000) });
        assert.equal(response.status, 200);
        await response.json();
        order.push(path);
        return performance.now() - start;
      };
      const [slow] = await Promise.all([request(slowPath), request(fastPath)]);
      assert.deepEqual(order, [fastPath, slowPath]);
      assert.ok(slow >= expectedMs - 5, `${slowPath}: expected ${expectedMs} ms, received ${slow} ms`);
      return `${slowPath} delayed ${Math.round(slow)} ms; ${fastPath} answered first${overrides.length ? ' (CLI flags)' : ''}`;
    }, overrides);
  }
  await scenario('config', (base) => {
    const config = get(base, '/api/themes/dys/config');
    assert.equal(config.layout, 'table');
    assert.equal(config.show_summary, false);
    assert.equal(config.visitor_info_enabled, false);
    assert.equal(config.show_ping, false);
    assert.equal(config.expiry_warning_days, 3);
    assert.equal(config.accent, 'notacolor');
    assert.equal(config.poll_interval, 999);
    assert.match(config.announcement, /\n.*<img src=x onerror=alert\(1\)>/);
    return 'valid and invalid saved values returned unchanged';
  });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
