# T17（Codex · 测试）：v1.3 测试准备（与 UI 线程并行）

工作目录 /Volumes/SSD/项目/monitor-theme，不要执行 git 命令。v1.2 已发布并上线，T15 已审核提交。
阅读 `docs/SPEC-v1.3.md`。`theme.json` 已改为 1.3.0，删除了 `finance_currency` 和 `exchange_rate_enabled`。
**注意：UI 现在由另一个 Codex 线程负责（不再是 Antigravity），它正在同时修改 `src/**`。** 你只能改 `tests/**`、`playwright.config.ts`、`scripts/`（gen-map.mjs 除外）、`.github/workflows/**`。

1. **删除过时的测试**：汇率（rates.test.ts、汇率相关 E2E、mockRates）、剩余价值（summarizeValue/remainingValue 的断言、value-breakdown、rate-date、remaining-value）。保留 monthlyCost 的测试。
2. **新增性能预算脚本** `scripts/check-size.mjs`：读取 `dist/` 下的 chunk（以 dist/index.html 引用的入口作为入口 chunk；地图 chunk 和详情 chunk 根据 Vite manifest 或文件名中的 `map`/`NodeDetail` 来识别——如果识别不出来，就在报告里说明需要 UI 侧在 vite.config.ts 中开启 `build.manifest`，不要自己改 vite.config），按 gzip 体积检查预算：入口 ≤60KB，首屏合计 ≤85KB，详情 ≤40KB；超出时退出码为 1 并打印表格。加入 ci.yml 和 release.yml，放在 build 之后。
3. **E2E 起草**（先标 `test.fixme`，等 UI 完成后再启用）：
   - 总览六格：summary-servers 显示「在线/总数」；summary-total-up 和 summary-total-down 等于 mock 中 total_tx、total_rx 之和（格式化后比较）；切换分组后数字随之变化
   - 页面上不出现「剩余价值」三个字；对 open.er-api.com 和 cdn.jsdelivr.net 的请求次数为 0
   - 请求并行：记录 `/api/me`、`/api/nodes`、`/api/themes/dys/config` 的发起时间，三者之差小于 50ms（让 mock 把 config 延迟 600ms，断言 nodes 不等 config）；开页 3 秒内 `/api/nodes` 的 HTTP 请求只有 1 次
   - 首页不加载详情 chunk（网络记录中没有 NodeDetail 或 uPlot 的 chunk）；进入详情页后才加载
   - 骨架屏：mock 延迟 nodes 1 秒，期间 skeleton 可见，数据到达后消失，并且卡片区域的 CLS 很小（用 PerformanceObserver 的 layout-shift，合计小于 0.05）
   - 底部留白：滚动到底部后，页脚下边缘到文档底部的距离不超过 24px；访客气泡此时在页脚内部（DOM 上是 footer 的子元素，或者位置落在 footer 的矩形内）
   - 毛玻璃：顶栏和 summary-tile 的 computed `backdrop-filter` 包含 blur；`prefers-reduced-transparency` 模拟下为 none（如果 Playwright 无法模拟，就跳过这一项并在报告里说明）
   - 圆角：节点卡片的 computed border-radius 为 8px
   - 手机 390：详情页 4 个统计格为 2 列（检查前两个格子的 top 相同）；总览为 3 列
   - 空状态：搜索一个不存在的名字后出现 empty-state，点击「清除筛选」后恢复
   - 丢包率：mock 场景里所有丢包为 0 时不显示丢包率图，并显示 no-loss；另造一个有丢包的情况（可以新增 `lossy` 场景）时显示丢包率图
   - 连接状态：首个 HTTP 数据到达后不再显示「连接中」
4. Mock Hub：支持 `--delay-config <ms>` 和 `--delay-nodes <ms>` 参数（或在场景 JSON 中配置），新增 `lossy` 场景。冒烟测试同步更新。
5. 已有的 v1.0–v1.2 用例按 v1.3 调整：删除依赖剩余价值的断言；其余保留。

报告：文件清单、删除的测试清单、新用例清单（哪些标了 fixme）、check-size 的说明、冒烟测试输出。
