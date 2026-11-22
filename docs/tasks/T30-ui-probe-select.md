# T30 · 详情页 Ping 支持选择探测节点（UI 会话）

用户需求：详情页的「Ping 延迟」（以及联动的「Ping 丢包率」）可以选择要查看哪些探测节点（例如浙江电信、浙江联通、浙江移动、Cloudflare）。

## 交互
- 在「Ping 延迟」卡片的标题下方（或替换现在右侧的静态图例）放一排可点击的探测节点胶囊：色点 + 名称 + 窗口内平均延迟（例如「浙江电信 32ms」）。胶囊为 `<button aria-pressed>`，选中时为实心浅底和彩色边框，未选中时为灰色。
- 点击切换该探测节点的显示或隐藏，至少保留 1 个：最后一个选中的胶囊不能取消。
- 胶囊行末尾有「全部」按钮（全部选中时禁用），以及「仅看」功能：按住 Alt/⌥ 点击或双击某个胶囊时只显示它。手机上双击同样有效。
- 延迟图和丢包图同步：两张图都只显示选中的探测节点。Y 轴范围按可见序列重新计算（用 uPlot 的 `setSeries(i, {show})`，再 `setScale` 或依靠 auto，不重建图表实例）。
- 「无丢包」判断按选中的探测节点计算。
- 选择保存在 `localStorage['dys:probes']`，按探测节点名称保存（读写都要包 try/catch）。切换节点或时间范围后保留选择；如果保存的名称在新数据中都不存在，就回到全部选中。
- 只有 1 个探测节点时不显示胶囊行，保留原来的图例。

## 实现约束
- 选择状态和过滤逻辑放在 `lib/detail-series.ts`（纯函数 `visibleProbes(all, saved)` 等），ChartCard 只负责通过 prop 接收每个序列的 `show`。
- 不使用 `{@html}`；不增加依赖；详情 chunk gzip 后不超过 33KB。
- testid：`probe-chip`（带 `data-probe` 名称和 `aria-pressed`）、`probe-all`。
- 文件归属：`src/**`、`README.md`（在功能列表中补一句）。不要改 tests 或 theme.json，不要执行 git。

## 验收
- `npm run check`、`npm run build`、`node scripts/check-size.mjs`、`npx playwright test` 全部通过。
- 用真实 Hub 截图详情页 Ping 区域：一张全部选中，一张只选 1 个，保存为 `docs/design/v1.6/probes-all.png` 和 `probes-one.png`。
- 最后一行写 `T30-DONE`。
