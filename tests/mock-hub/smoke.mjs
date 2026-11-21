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

async function scenario(name, test) {
  const child = spawn(process.execPath, [join(root, 'server.mjs'), '--port', '0', '--scenario', name, '--dist', tmp], {
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

async function frames(base, { query = '', gzip = false, count = 1 } = {}) {
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
          const { nodes } = JSON.parse(text);
          assert.ok(nodes.length > 0);
          received.push({ at: performance.now(), speed: nodes[0].metrics.net_rx });
          if (received.length === count) done();
        } catch (err) { done(err); }
      });
    });
    if (count > 1) {
      const interval = received[1].at - received[0].at;
      assert.ok(interval >= 1500 && interval <= 5000, `Push interval ${interval}ms`);
      assert.notEqual(received[0].speed, received[1].speed);
    }
  } finally { ws.close(); }
}

try {
  mkdirSync(join(tmp, 'assets'));
  writeFileSync(join(tmp, 'index.html'), staticIndex);
  writeFileSync(join(tmp, 'assets', 'site.css'), 'body { color: black; }');
  await scenario('normal', async (base) => {
    const me = get(base, '/api/me');
    assert.equal(me.public_page, true);
    assert.equal(me.history_days, 90);
    const { nodes } = get(base, '/api/nodes');
    assert.equal(nodes.length, 12);
    assert.deepEqual([...new Set(nodes.map(({ group }) => group))], ['亚太', '欧洲', '美洲', '']);
    assert.deepEqual([...new Set(nodes.map(({ expires_in }) => expires_in))].sort((a, b) => (a ?? 100) - (b ?? 100)), [-3, 0, 5, 60, null]);
    const offlineAges = nodes.filter(({ online }) => !online).map(({ last_seen_ago }) => last_seen_ago);
    assert.equal(offlineAges.length, 2);
    assert.ok(offlineAges[0] >= 4500);
    assert.equal(offlineAges[1], null);
    assert.ok(nodes.some(({ billing_cycle }) => /^\d+m$/.test(billing_cycle)));
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
    const long = get(base, '/api/nodes/1/metrics?hours=9999&points=30&series=ping');
    assert.equal(long.step, 129600);
    assert.deepEqual(long.metrics, []);
    assert.deepEqual([...new Set(long.ping.map(({ task_id }) => task_id))], [9, 2]);
    assert.equal(long.probes['9'], '东京探测');
    assert.ok(long.ping.some(({ latency }) => latency === null));
    const full = get(base, '/api/nodes/1/metrics');
    assert.equal(full.step, 60);
    assert.ok(full.metrics.length && full.ping.length);
    await Promise.all([frames(base, { count: 2 }), frames(base, { query: '?gzip=0', gzip: true, count: 2 })]);
    return '12 nodes, static/SPA and API OK; history step 360s/129600s; text + gzip pushes ≈2s apart';
  });
  await scenario('nogroups', (base) => {
    assert.ok(get(base, '/api/nodes').nodes.every(({ group }) => group === ''));
    return 'all groups empty';
  });
  await scenario('allgrouped', (base) => {
    assert.ok(get(base, '/api/nodes').nodes.every(({ group }) => group));
    return 'all nodes grouped';
  });
  await scenario('anonymous', (base) => {
    const { admin, nodes } = get(base, '/api/nodes');
    assert.equal(admin, false);
    assert.equal(nodes.length, 11);
    assert.ok(nodes.every((node) => node.public && ['hostname', 'ip', 'remark', 'token'].every((key) => !(key in node))));
    assert.equal(curl(base, '/api/nodes/12/metrics').status, 404);
    return '11 public nodes, no admin fields, private history 404';
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
    assert.equal(get(base, '/api/nodes').nodes.length, 12);
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
  await scenario('config', (base) => {
    const config = get(base, '/api/themes/dys/config');
    assert.equal(config.layout, 'table');
    assert.equal(config.show_summary, false);
    assert.equal(config.accent, 'notacolor');
    assert.equal(config.poll_interval, 999);
    assert.match(config.announcement, /\n.*<b>/);
    return 'valid and invalid saved values returned unchanged';
  });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
