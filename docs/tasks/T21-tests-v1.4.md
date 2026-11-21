# T21 · 测试精简 v1.4（测试会话）

完整阅读 `docs/SPEC-v1.4.md`，负责第 8 节。UI 会话正在并行实现其余各节（包括新文件 `src/lib/ping.svelte.ts`，它会导出 `summarizePing(resp)`，返回 `{ latency, loss, probes }`）。

## 文件归属
- 你负责：`tests/**`、`playwright.config.ts`、`.github/workflows/ci.yml`、`package.json` 中的 scripts 部分。
- 不要改：`src/**`、`theme.json`、`index.html`、`vite.config.ts`。不要执行 git 命令。

## 任务
1. E2E 合并为 `tests/e2e/smoke.spec.ts`，不超过 10 个用例，内容见规格第 8 节。删除其余 spec（`helpers.ts` 按需保留）。只保留 chromium 一个 project，retries 设为 0，workers 默认。
2. 单元测试只保留：`format`、`config`、`api`、`nodes`、`icons`、`source-safety`，新增 `ping.test.ts`（测试 `summarizePing`：多个探针取平均、使用 loss 对象、没有 loss 时由 ping 点计算、空数组返回 null、latency 全为 null）。删除 `finance`、`ranges`、`check-size`、`color`、`prefs`、`visitor` 的测试。`format` 测试中的价格断言改为 `¥629/一次性` 格式。
3. mock hub：确认 `series=ping&hours=1&points=12` 返回正确；新增 `noping` 场景（`ping: []`、`probes: {}`）。
4. CI：`npm ci` → vitest → build → size gate → playwright（只装 chromium）。
5. 如果 UI 会话还没交付，UI 相关的 E2E 用例（列表列顺序、`node-ping`、`detail-stats`、卡片不折行）先按规格写好；在 UI 未完成时可以失败，在报告中说明哪些用例在等 UI。

## 验收
- `npx vitest run` 通过（ping 测试可以在 UI 交付前暂时失败，需注明）；`npx playwright test` 可运行，整套测试在 60 秒内完成。
- 最后一行写 `T21-DONE`，列出删除和新增的文件、用例数，以及等待 UI 的用例。
