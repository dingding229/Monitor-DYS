# T14（Antigravity）：X 轴边界情况

工作目录 /Volumes/SSD/项目/monitor-theme，不要执行 git 命令。T13 已审核提交。Codex 发现一个边界问题，而它正好是用户真实站点的情况（站点刚接入，历史只有几个小时）：

- 选择 30 天（或任何 >24h）范围，但所有数据点都落在同一自然日内时，X 轴**一个标签都没有**（`UPlotChart.svelte:106` 只在长范围内生成午夜刻度）。

修改：
1. 刻度规则要根据**实际数据跨度**（第一个点到最后一个点的时间差），而不是所选范围：
   - 跨度 ≤ 24 小时：用 HH:mm 刻度；如果跨了午夜，0 点刻度显示 MM-DD。
   - 跨度 > 24 小时：沿用 T13 的按天刻度。
   - 任何情况下至少要有 2 个刻度标签。只有 1 个点时显示该点的 `MM-DD HH:mm`。
2. 在 uPlot 画布的外层元素上暴露 `data-ticks`，内容是当前 X 轴标签的 JSON 数组，每次重绘时更新，方便测试读取。
3. 只改 `src/components/UPlotChart.svelte`（如有必要也可以改 `src/lib/format.ts`）。

完成后运行 `npm run check && npm test && npm run build && npm run test:e2e`，四项必须全部通过。然后用 Mock Hub 的 fewpoints 场景（`node tests/mock-hub/server.mjs --scenario fewpoints --dist dist`）选 30 天，截图保存为 `docs/design/v1.2/detail-fewpoints-30d.png`。最后单独一行回复 `T14-DONE`。
