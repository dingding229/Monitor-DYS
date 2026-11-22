# T31 · 探测节点选择的测试（测试会话）

UI 会话正在实现 T30（见 `docs/tasks/T30-ui-probe-select.md`）：详情页 Ping 延迟卡片上新增可切换的探测节点胶囊（testid 为 `probe-chip`，带 `data-probe` 和 `aria-pressed`），以及「全部」按钮（testid 为 `probe-all`），选择保存在 `localStorage['dys:probes']`。

在 `tests/e2e/smoke.spec.ts` 中新增 1 个用例（总数不超过 13 个），使用 normal 场景（有多个探测节点）：
1. 打开详情页，所有 `probe-chip` 的 aria-pressed 都为 true。
2. 点击第一个胶囊，它变为 false，`probe-all` 变为可用。
3. 依次点击，直到只剩 1 个选中的胶囊；再点击它，它仍然为 true（至少保留 1 个）。
4. 刷新页面后选择保持不变；点击 `probe-all` 后全部恢复为 true。

如果 UI 导出了纯函数 `visibleProbes`，在 `tests/unit/` 中补充 2–3 个单元测试：保存的名称不存在时回到全部、部分匹配、空列表。

不要改 src，不要执行 git。UI 交付前用例允许失败，在报告中注明。验收：`npx vitest run`、`npx playwright test`。最后一行写 `T31-DONE`。
