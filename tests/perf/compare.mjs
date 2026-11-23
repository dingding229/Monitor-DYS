#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
const [basePath, candidatePath, ...extra] = process.argv.slice(2);
if (!basePath || !candidatePath || extra.length) { console.error('Usage: node tests/perf/compare.mjs <baseline.json> <candidate.json>'); process.exit(2); }
try {
  const [base, current] = await Promise.all([basePath, candidatePath].map(async p => JSON.parse(await readFile(p, 'utf8'))));
  const b = base.scenarios.many.median, c = current.scenarios.many.median;
  const checks = [
    ['入口 JS gzip', current.sizes.jsEntryGzip, 42000, '≤', 'bytes'],
    ['首屏 JS gzip（入口 + preload + 地图）', current.sizes.firstScreenJsGzip, 60000, '≤', 'bytes'],
    ['详情 chunk gzip', current.sizes.detailChunkGzip, 30000, '≤', 'bytes'],
    ['CSS gzip', current.sizes.cssGzip, base.sizes.cssGzip, '≤', 'bytes'],
    ['首批卡片出现', c.firstCardMs, b.firstCardMs * 1.1, '≤', 'ms'],
    ['WS 帧长任务（首屏后 10 秒全部长任务）', c.maxLongTaskMs, 50, '<', 'ms'],
    ['60 秒后 JS 堆', c.heapMB, b.heapMB * 0.85, '≤', 'MiB'],
    ['单张卡片 DOM 后代节点', c.domPerCard, b.domPerCard * 0.8, '≤', 'nodes'],
  ];
  let failed = false;
  for (const [name, value, limit, op, unit] of checks) {
    if (!Number.isFinite(value) || !Number.isFinite(limit)) throw Error(`Missing or invalid metric: ${name}`);
    const pass = op === '<' ? value < limit : value <= limit;
    if (!pass) failed = true;
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}: ${value.toFixed(2)} ${unit} ${op} ${limit.toFixed(2)} ${unit}`);
  }
  console.log(`INFO 详情图表 ${c.detailChartMs.toFixed(2)} ms；离开详情后堆 ${c.heapAfterDetailMB.toFixed(2)} MiB（SPEC 未指定阈值）`);
  if (failed) process.exitCode = 1;
} catch (error) { console.error(error.message); process.exitCode = 2; }
