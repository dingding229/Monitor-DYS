# T25 · v1.5 最终优化（UI 会话）

完整阅读 `docs/SPEC-v1.5.md`，实现第 1–6 节。延迟丢包的参考图是 `docs/design/feedback-v1.5/ping-ref.png`。

## 文件归属
- 你负责：`src/**`、`index.html`、`vite.config.ts`、`README.md`。
- 不要改：`tests/**`、`playwright.config.ts`、`.github/**`、`theme.json`。测试会话正在并行添加 `many` 场景（500 个节点）和新用例。
- 不要执行 git。

## 顺序建议
1. 先做代码结构调整（第 6 节）：删除死代码，拆分 NodeDetail，合并小模块。每一步之后都运行 `npm run check`。
2. 再做第 1、2、3 节（背景、平整样式、ping 区块）。
3. 最后做第 4、5 节（大量节点下的性能，以及 URL 状态和快捷键）。

## 契约（测试会话会依赖）
- `summarizePing(resp)` 返回 `{ latency, loss, probes: {name, latency, loss}[], buckets: {latency, loss}[] }`。`buckets` 按时间升序排列，最多 12 个。
- `lib/nodes.svelte.ts` 导出纯函数 `mergeNodes(prev: Node[] | null, next: Node[]): Node[]`：没有变化的节点保持原引用。
- testid 新增 `ping-bars`；其余 testid 保持不变。
- URL query 的键为 `g`、`c`、`q`、`sort`。

## 验收（贴出结果）
- `npm run check` 0 错误；`npm run build`；`node scripts/check-size.mjs` 通过，入口 ≤52KB、详情 ≤33KB（gzip）。
- `find src -name '*.ts' -o -name '*.svelte' -o -name '*.css' | grep -v map-data | xargs wc -l | tail -1` 小于 4200。
- `NodeDetail.svelte` 不超过 350 行。
- 真实 Hub（`MONITOR_HUB=https://monitor.dingg.de npm run dev -- --host 127.0.0.1`）下截图首页 1440、390 和详情页 1440，放到 `docs/design/v1.5/`。
- 在 DevTools 的 Performance 面板中，用节流的 4x CPU 刷新页面，截图确认首帧为灰底而不是白底或黑底（也可以用 Playwright 抓取 `page.on('framenavigated')` 之后的第一张截图）。
- 测试会话交付 `many` 场景后（检查 `tests/fixtures/scenarios/many.json` 或 mock 中是否已有该场景），运行 `npx playwright test` 并贴出结果，失败的用例写明原因。你可以运行测试，但不要修改测试。
- 最后一行写 `T25-DONE`，列出删除的文件、行数变化和未完成项。
