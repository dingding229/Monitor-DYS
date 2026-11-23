# T56 · 地区列表展开不拉长页面（Antigravity）

用户反馈：点击地图右侧「另外 N 个地区」后，列表变长并出现滚动条，把整个上半部分（总览 4 格 + 地图卡片）拉长了。要求展开后**不改变任何区域的高度**。

## 改法（`WorldMap.svelte` 及相关 CSS）
- 桌面端：地区卡片高度始终等于左侧总览 4 格的高度（展开前后一致）。地区列表占据剩余高度，展开后在列表内部滚动（`overflow-y: auto`，`overscroll-behavior: contain`），滚动条做细（4px、圆角、浅灰，悬停时稍深；Firefox 用 `scrollbar-width: thin`）。地图图形高度不变。
- 「另外 N 个地区」按钮在列表滚动区域外，位置固定；展开后文字改为「收起」。
- 手机端（<640px）：地图隐藏，地区列表最多 5 行，展开时同样在固定高度内滚动（高度 = 5 行），不推动下方内容。
- 不要用 JS 测量高度（避免布局抖动），用 grid/flex + `min-height: 0` 实现。
- 体积不增加；`check-size` 无 WARN。

## 验收
截图 `docs/design/v3/impl/region-expanded-1440.png`（展开后）和 `region-expanded-390.png`；确认展开前后 `[data-testid="world-map"]` 所在卡片的高度相同（在报告里写出两次测得的像素值）。`npm run check`、`npm run build`、`node scripts/check-size.mjs` 通过。不要改 `src/lib/**`、`tests/**`、`theme.json`，不要执行 git。回复最后一行写 `T56-DONE`。
