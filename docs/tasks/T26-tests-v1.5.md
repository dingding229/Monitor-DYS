# T26 · v1.5 测试（测试会话）

完整阅读 `docs/SPEC-v1.5.md`，负责第 7 节。UI 会话正在并行做第 1–6 节的重构。

## 文件归属
- 你负责：`tests/**`、`playwright.config.ts`、`.github/workflows/*`、`package.json` 中的 scripts。
- 不要改 `src/**`、`index.html`、`theme.json`。不要执行 git。

## UI 会话将提供的契约
- `summarizePing(resp)` 返回值中新增 `buckets: {latency, loss}[]`（按时间升序，最多 12 个）。
- `lib/nodes.svelte.ts` 导出 `mergeNodes(prev, next)`：没有变化的节点保持原引用。
- 新增 testid `ping-bars`（12 个子元素）。
- URL query 的键为 `g`、`c`、`q`、`sort`。
- 将要删除的导出：`cycleLabel`、`money`、`monthlyCost`、`osName`、`percent`、`rate`、`countryName`、`useNodes`，以及 `lib/finance.ts`、`lib/ranges.ts`（并入 `lib/detail-series.ts`）、`lib/prefs.ts`（并入 `lib/view-state.ts`）。测试里引用这些的断言请删除或改为引用新位置。

## 任务
1. mock hub 新增 `many` 场景：500 个节点，分布在 20 个国家、6 个分组，有价格和到期；WS 每秒推送 1 帧，每帧约 30% 的节点数值变化；ping 接口正常返回 3 个探针。数据用生成器生成，不要提交 500 条的 JSON。
2. `smoke.spec.ts` 新增用例（总数不超过 12 个）：
   - `many`：从 goto 到出现第一张 `node-card` 的时间不超过 1200ms（本地构建的 preview，无限速）；用 PerformanceObserver 收集 10 秒内的 longtask，最大值不超过 50ms。CI 上的阈值放宽为 ×2（读取 `process.env.CI`）。
   - URL 状态：选择分组、输入搜索后刷新页面，筛选仍然保留，并且 URL 中包含 `g=`、`q=`。
   - ping 区块：`ping-bars` 有 12 段，数值中有 3 个由「·」连接的值。
   - 背景：在构建产物 `dist/index.html` 中能找到内联的 `background:#f5f6f7`（作为单元测试，或在 E2E 中读取文件）。
3. 单元测试：`summarizePing` 的 buckets（排序、截取为 12 个、空数据）；`mergeNodes` 的引用保持（未变化的节点 `toBe` 原对象，变化的节点为新对象，新增和删除节点正确）。
4. 在 UI 交付之前，依赖新契约的用例允许失败，在报告中列出。

验收：`npx vitest run`、`npx playwright test`，整体在 90 秒内完成。最后一行写 `T26-DONE`。
