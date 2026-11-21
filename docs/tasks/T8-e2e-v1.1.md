# T8（Codex）：启用 v1.1 E2E 并做完整 CI 演练

工作目录 /Volumes/SSD/项目/monitor-theme，不要执行 git 命令。UI 改版（T5 + T7 返工）已完成并审核，你在 T6 报告的两个问题都已修复：访客气泡改为等配置加载完成后才挂载；颜色校验已恢复。现在 `npm test` 156/156 通过。

1. 把 `tests/e2e/v1.1.spec.ts` 等文件中所有 `test.fixme` 改为正式的 `test`，按实际 UI 调整选择器（testid 见 docs/SPEC-v1.1.md §H）。注意 T7 的改动：
   - 详情页时间范围只保留了按钮组（`range-btn`），下拉框已删除
   - uPlot 自带的 legend 已隐藏，图例改在卡片标题旁边，勾选「显示峰值」后标题旁会出现「峰值」
   - 地图上相近的标记会合并为带数量的圆点，因此 map-marker 的数量可能小于国家数。断言改为：所有 marker 覆盖的国家数之和等于国家数（检查 marker 的 data 属性或 title；如果 UI 没有暴露这些信息，在报告里提出，不要修改组件）
2. 新增一个回归用例：config 场景下 `visitor_info_enabled=false` 时，**整个页面生命周期内**（加载后再等 3 秒）对 api.ip.sb 和 ipwho.is 的请求次数都为 0。
3. 完整演练：`npm ci && node scripts/check-version.mjs && npm run check && npm test && npm run build && npm run test:e2e && scripts/pack.sh && node scripts/verify-package.mjs`，每一步贴出结果，结束后删除 theme.tar.gz*。
4. 只能改 tests/**、playwright.config.ts、scripts/**。发现 UI bug 时只写进报告，不要修改 src。

报告：E2E 通过数量、改动清单、发现的 UI 问题。
