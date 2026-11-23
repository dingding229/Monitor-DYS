#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, basename } from 'node:path';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';
import { setTimeout as sleep } from 'node:timers/promises';

const { values } = parseArgs({ options: { dist: { type: 'string', default: 'dist' }, out: { type: 'string' } } });
const dist = resolve(values.dist);
const html = await readFile(resolve(dist, 'index.html'), 'utf8');
const tags = [...html.matchAll(/<(script|link)\b[^>]*>/gi)].map(m => m[0]);
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'))?.[1];
const entry = tags.find(t => /^<script/i.test(t) && attr(t, 'type') === 'module' && attr(t, 'src'));
if (!entry) throw Error('Cannot find module entry in dist/index.html');
const entryPath = attr(entry, 'src');
const preloads = tags.filter(t => /\brel=["']modulepreload["']/i.test(t)).map(t => attr(t, 'href')).filter(Boolean);
const styles = tags.filter(t => /\brel=["']stylesheet["']/i.test(t)).map(t => attr(t, 'href')).filter(Boolean);
async function gzip(path) { return gzipSync(await readFile(resolve(dist, path.replace(/^\//, '')))).length; }
const entryText = await readFile(resolve(dist, entryPath.replace(/^\//, '')), 'utf8');
// Vite emits dynamic imports in its preload dependency list; NodeDetail is intentionally lazy.
const detail = [...entryText.matchAll(/["']([^"']*NodeDetail-[^"']+\.js)["']/g)].map(m => m[1])[0];
if (!detail) throw Error('Cannot locate NodeDetail chunk in entry; update the bundle discovery for this build');
const detailPath = detail.startsWith('/') ? detail : `/assets/${basename(detail)}`;
const mapPath = preloads.find(p => /WorldMap-[^/]+\.js$/i.test(p)) ?? (() => {
  const name = [...entryText.matchAll(/["']([^"']*WorldMap-[^"']+\.js)["']/g)][0]?.[1];
  if (!name) throw Error('Cannot locate WorldMap chunk; update the bundle discovery for this build');
  return name.startsWith('/') ? name : `/assets/${basename(name)}`;
})();
const jsEntryGzip = await gzip(entryPath);
const sizes = { cssGzip: (await Promise.all(styles.map(gzip))).reduce((a,b) => a+b, 0), jsEntryGzip,
  firstScreenJsGzip: (await Promise.all([...new Set([entryPath, ...preloads, mapPath])].map(gzip))).reduce((a,b) => a+b, 0),
  detailChunkGzip: await gzip(detailPath), files: { entry: entryPath, preloads, styles, detail: detailPath } };
const browser = await chromium.launch({ headless: true });
const median = a => [...a].sort((x,y) => x-y)[Math.floor(a.length/2)];
const metrics = ['firstCardMs','maxLongTaskMs','longTaskCount','heapMB','domNodes','domPerCard','detailChartMs','heapAfterDetailMB'];
async function server(scenario) {
  const child = spawn(process.execPath, ['tests/mock-hub/server.mjs', '--port', '0', '--scenario', scenario, '--dist', dist], { stdio: ['ignore','pipe','pipe'] });
  let output = '';
  const url = await new Promise((res, rej) => {
    const timer = setTimeout(() => rej(Error(`mock hub startup timeout: ${output}`)), 10000);
    child.stdout.on('data', chunk => { output += chunk; const match = output.match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timer); res(match[0]); } });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('exit', code => { clearTimeout(timer); rej(Error(`mock hub exited ${code}: ${output}`)); });
  }).catch(e => { child.kill(); throw e; });
  return { child, url };
}
async function sample(url) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('HeapProfiler.enable');
    await page.addInitScript(() => {
      window.__perf = { firstCard: null, tasks: [] };
      new PerformanceObserver(list => { for (const e of list.getEntries()) window.__perf.tasks.push({ start: e.startTime, duration: e.duration }); }).observe({ type: 'longtask', buffered: true });
      function find() { const e = document.querySelector('[data-testid="node-card"]'); if (e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden') window.__perf.firstCard = performance.now(); else requestAnimationFrame(find); }
      requestAnimationFrame(find);
    });
    await page.goto(url, { waitUntil: 'commit' });
    await page.waitForFunction(() => window.__perf?.firstCard != null, null, { timeout: 30000 });
    const firstCardMs = await page.evaluate(() => window.__perf.firstCard);
    // The 60-second interval is measured from first visible card, not navigation completion.
    await page.waitForFunction(() => performance.now() >= window.__perf.firstCard + 60000, null, { timeout: 75000 });
    const observation = await page.evaluate(() => { const p = window.__perf; const tasks = p.tasks.filter(t => t.start >= p.firstCard && t.start < p.firstCard + 10000); return { maxLongTaskMs: Math.max(0, ...tasks.map(t => t.duration)), longTaskCount: tasks.length, domNodes: (() => { const walker = document.createTreeWalker(document, NodeFilter.SHOW_ALL); let count = 1; while (walker.nextNode()) count++; return count; })(), domPerCard: document.querySelector('[data-testid="node-card"]').querySelectorAll('*').length }; });
    async function heap() { await cdp.send('HeapProfiler.collectGarbage'); return (await cdp.send('Runtime.getHeapUsage')).usedSize / 1024 / 1024; }
    const heapMB = await heap();
    await page.evaluate(() => { window.__detailStart = performance.now(); });
    await page.locator('[data-testid="node-card"]').first().click();
    await page.waitForURL('**/node/*');
    await page.locator('[data-testid="chart"]').first().waitFor({ state: 'visible', timeout: 30000 });
    const detailChartMs = await page.evaluate(() => performance.now() - window.__detailStart);
    await page.goBack({ waitUntil: 'commit' });
    await page.locator('[data-testid="node-card"]').first().waitFor({ state: 'visible' });
    await sleep(30000);
    const heapAfterDetailMB = await heap();
    return { firstCardMs, ...observation, heapMB, detailChartMs, heapAfterDetailMB };
  } finally { await context.close(); }
}
const result = { schemaVersion: 1, measuredAt: new Date().toISOString(), dist, environment: { browser: browser.version(), viewport: '1440x900', runs: 3, heapUnit: 'MiB', gzipUnit: 'bytes', timing: 'ms', longTaskWindow: '10 seconds after first visible card', heapTiming: '60 seconds after first visible card; after detail: 30 seconds after returning home' }, sizes, scenarios: {} };
try {
  for (const scenario of ['normal', 'many']) {
    const { child, url } = await server(scenario);
    try {
      const runs = [];
      for (let i = 0; i < 3; i++) { console.error(`${scenario}: run ${i+1}/3`); runs.push(await sample(url)); console.error(JSON.stringify(runs.at(-1))); }
      result.scenarios[scenario] = { runs, median: Object.fromEntries(metrics.map(k => [k, median(runs.map(r => r[k]))])) };
    } finally { child.kill(); }
  }
} finally { await browser.close(); }
const json = JSON.stringify(result, null, 2) + '\n';
if (values.out) { await mkdir(dirname(resolve(values.out)), { recursive: true }); await writeFile(resolve(values.out), json); }
process.stdout.write(json);
