# T47 · 测试更新到 v3（测试会话）

数据层（T45）和页面（T46）已按 `docs/SPEC-v3.md` 完成。先读 SPEC-v3。Antigravity 正在做小修正（T48），不会删除 testid。

## 要做的
1. **单元测试**：
   - `tests/unit/config.test.ts`：删除 `accent`、`color_scheme`、`resolveColorScheme` 的断言；新增 `resolveTheme`（6 个合法值、非法值、非字符串回退 `emerald`）。
   - `tests/unit/home-view.test.ts`：按新的 `summarizeNodes(nodes, readPing?, expiryWarningDays?)` 和 `aggregateCountries(nodes, readPing?)` 返回结构更新；新增 `warn`（CPU/内存/硬盘 ≥90%、丢包 ≥5%、延迟 ≥200ms、无 ping 数据不算）、`expired`/`expiring`、`cores`、`peakCpu`、`uptimeRatio`、`statusStrip` 顺序、国家 `latency`/`warn`、`totals` 的测试。
   - 新增 `tests/unit/history.test.ts`：`fleet` 每条 ≤60 点、`load(id)` ≤30 点且环形回绕顺序正确、节点消失后清理、`version` 每帧递增。
2. **E2E**：
   - 删除深色模式测试；新增：`html[data-theme]` 按配置 `theme` 设置、`localStorage['dys:theme']` 缓存、刷新后首帧（脚本执行前）就有正确的 `data-theme`、非法值回退 `emerald`。
   - `summary-tile` 数量改为 4；列表表头改为中文 `上行`/`下行`；`detail-stats` 不再要求包含「运行」；单卡后代元素上限改为 90。
   - 新增 testid 存在性检查：`status-strip`、`load-spark`、`fleet-spark`、`region-summary`；地图悬停浮层不超出 `world-map` 边界；390px 下地图图形隐藏、地区列表显示。
3. **CI**：`.github/workflows` 中的体积检查改用 v2 预算（`SIZE_BUDGET=v2`），并确认 `scripts/check-size.mjs` 在 GitHub Actions 下也走 v2（如需改脚本，在报告中说明改法，由规划者转给后端）。
4. 只改 `tests/**`、playwright/vitest 配置、`.github/workflows/**`。不要改 `src/**`，不要执行 git。

## 验收
`npm test`、`npx playwright test` 全部通过（如有失败是页面缺陷，列出来，不要为了通过而放宽断言）。回复最后一行写 `T47-DONE`。
