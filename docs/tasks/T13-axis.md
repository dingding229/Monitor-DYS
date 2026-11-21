# T13（Antigravity）：X 轴日期刻度去重

工作目录 /Volumes/SSD/项目/monitor-theme，不要执行 git 命令。T11 已审核通过，谢谢。

宽图表（TCP/UDP/进程数）在 7 天范围下，每 12 小时有一个刻度，但标签只显示 MM-DD，所以出现「11-15 11-15 11-16 11-16」这样的重复。修改 `UPlotChart.svelte` 的 X 轴刻度规则：
- 范围大于 24 小时：刻度间隔至少 1 天，并对齐到本地 0 点；标签显示 `MM-DD`。如果为了避免标签太稀而需要更密的刻度，则非 0 点的刻度显示 `HH:mm`，0 点的刻度显示 `MM-DD`。
- 同一张图上不能出现两个相同的标签。

**只改 `src/components/UPlotChart.svelte`**（如有必要也可以改 `src/lib/format.ts` 中的时间格式化函数）。Codex 正在同时改 tests/，不要碰。
完成后 `npm run check && npm test && npm run build` 全部零错误，然后重新截图 `docs/design/v1.2/detail-1280-7d.png`。最后单独一行回复 `T13-DONE`。
