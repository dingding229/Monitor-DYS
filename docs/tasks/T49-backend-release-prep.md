# T49 · v2.0.0 发布准备（后端会话）

A5 界面、测试和性能对比都已通过（`npm run perf:compare` 全部 PASS）。

## 要做的
1. `scripts/check-size.mjs`：GitHub Actions 下未设置 `SIZE_BUDGET` 时也默认使用 v2 预算（删除按 `GITHUB_ACTIONS` 选 v1 的分支，`SIZE_BUDGET=v1` 仍可手动指定）。
2. `preview.png`：用 mock hub（`tests/mock-hub/server.mjs`）+ 构建产物，在 1440 宽度截首页首屏（总览 + 地图 + 第一行卡片），替换仓库根目录的 `preview.png`；控制文件体积（建议 ≤ 400KB，可用 pngquant 或降为 1x）。
3. `README`：更新为 v2.0：新界面说明（总览、地图与地区统计、卡片的负载趋势和探针延迟、详情页）、只保留浅色、后台「主题色」6 套预设（翡翠青/海洋蓝/靛蓝紫/琥珀金/玫红/石墨灰）、删除的配置项（`accent`、`color_scheme`）、体积与性能数据（入口 41.7KB、首屏 59.8KB、详情 30.0KB gzip，首卡 73ms，500 节点 60 秒堆 8.2MiB，单卡 79 个元素）。
4. 不要改版本号（由规划者改），不要改 `.svelte`、`tests/**`、`theme.json`，不要执行 git。

## 验收
`node scripts/check-size.mjs` 与 `GITHUB_ACTIONS=true node scripts/check-size.mjs` 都使用 v2 且 OK。报告改动。回复最后一行写 `T49-DONE`。
