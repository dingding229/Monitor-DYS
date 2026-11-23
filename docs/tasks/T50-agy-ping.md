# T50 · 卡片延迟改回按探针显示（Antigravity）

T48 第 4 项是规划者的判断错误：原来的 `21·63` 其实是两个探针各自的延迟，这是 v1.5 起就有的功能（卡片直接显示最多 3 个探针的值），E2E `card Ping displays three per-probe values and twelve segments` 因此失败。

## 改法（`NodeCard.svelte`，列表视图如有同样字段也一致）
- 「延迟 ms」右侧恢复显示每个探针的平均延迟，最多 3 个，用 ` · ` 分隔（例如 `18 · 60 · 102`），只有 1 个探针时显示单值；`title` 写明每个探针名称和数值。
- 「丢包 %」右侧显示各探针中最大的丢包率，一位小数（如 `0.0`）。
- 无数据仍显示 `—`。其他不变，体积不要增加。

## 验收
`npm run check`、`npm run build`、`node scripts/check-size.mjs` 全部 OK，`npx playwright test` 17/17 通过，重新截 `home-1440.png`。不要执行 git，不要改 `src/lib`、`tests`。回复最后一行写 `T50-DONE`。
