# T15（Codex）：按新的刻度规则更新 X 轴测试

工作目录 /Volumes/SSD/项目/monitor-theme，不要执行 git 命令。T12 已审核提交，谢谢你发现了 30 天范围内无标签的问题，它已在 T14 修复。

T14 改变了刻度规则（规划者的决定，以此为准）：
- 刻度按**实际数据跨度**决定，不再按所选范围：跨度 ≤24 小时时用 `HH:mm`，跨午夜的刻度显示 `MM-DD`；跨度 >24 小时时按天显示 `MM-DD`；任何情况下至少 2 个标签；只有 1 个点时显示 `MM-DD HH:mm`。
- uPlot 画布的外层元素新增了 `data-ticks`，内容是当前 X 轴标签的 JSON 数组。

因此 `tests/e2e/v1.2.spec.ts:230`「four points in a 30-day range draw unique MM-DD ticks…」现在失败（预期失败，界面行为是对的）。请：
1. 把这个用例改为按新规则断言：fewpoints 场景、30 天范围下，标签数 ≥2，不重复，跨午夜的刻度是 MM-DD、其余是 HH:mm，最后一个标签没有被截断。
2. 新增一个用例：跨度 >24 小时（normal 场景的 7 天）时，所有标签都是 MM-DD，且不重复。
3. X 轴标签改为优先读取 `data-ticks`；Canvas 绘制记录只用于检查截断。
4. 跑完整 CI 演练：`npm ci && node scripts/check-version.mjs && npm run check && npm test && npm run build && npm run test:e2e && scripts/pack.sh && node scripts/verify-package.mjs`，结束后删除 theme.tar.gz*。

只能改 tests/**。报告 E2E 通过数量和每一步的结果。
