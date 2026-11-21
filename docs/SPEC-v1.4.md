# DYS v1.4 规格（在 SPEC.md 和 v1.1–v1.3 基础上增补；冲突时以本文件为准）

来源：用户对线上 v1.3 的反馈（共 11 条），截图在 `docs/design/feedback-v1.4/`。

## 1. 后台按钮图标
右上角后台按钮现在的图标像太阳，认不出是后台。改为标准齿轮图标（有齿的 cog，线宽 1.5，16px 视口）。宽度 ≥640px 时图标右侧加文字「后台」，按钮高度与连接状态胶囊一致（28px），手机端只显示图标。仍然只在 `me.authed === true` 时显示。

## 2. 左上角 logo 改为圆形
`/favicon.svg` 显示为 22×22 的圆形：`rounded-full object-cover`，加 1px 浅色描边（`ring-1 ring-black/5`）。加载失败时（onerror）隐藏图片，不显示破图标。

## 3. 列表模式的列顺序
- 名称放在第一列，单独一行显示名称（不再在名称后面跟系统文字或 logo）。
- 系统 logo 和国旗移到「地区」列：国旗 + 中文地区名 + 系统 logo（14px，`title` 为完整的 os 字符串）。
- 状态列放到最后一列，内容为圆点 + 「在线」或「离线 N 分钟」。
- 新的列顺序：名称 | 地区 | CPU | 内存 | 硬盘 | ↑ | ↓ | 延迟 | 丢包 | 本期流量 | 到期 | 状态。

## 4. 首页显示延迟和丢包
`/api/nodes` 和 WS 都不带 ping 数据，只能通过 `/api/nodes/{id}/metrics?hours=1&points=12&series=ping` 按节点获取。实现新的 `src/lib/ping.svelte.ts`：
- 只请求进入视口的卡片或列表行（IntersectionObserver，rootMargin 200px），并发数最多 3。
- 首屏渲染完成后在 `requestIdleCallback` 中开始（没有该 API 时用 setTimeout 1500ms），不能和首屏请求抢带宽。
- 每个节点 60 秒刷新一次；页面隐藏时（visibilitychange）暂停；离线节点不请求。
- 汇总规则：
  - 延迟：每个探针取窗口内最后一个非 null 的 latency，再对所有探针取平均，四舍五入为整数 ms。
  - 丢包：响应中 `loss` 对象各值的平均（百分比，保留 1 位小数，0 时显示「0%」）；没有 `loss` 字段时，对 ping 点的 loss 求平均。
  - 没有任何探针时显示「—」。
- 请求失败（4xx/5xx/超时 8 秒）时显示「—」，下一轮再试；收到 404 或 `ping` 为空数组的节点 10 分钟内不再请求。
- 颜色：延迟 <100ms 绿色，100–200ms 琥珀色，>200ms 红色；丢包 0 为灰色，≤5% 琥珀色，>5% 红色。
- 悬停 `title` 列出各探针名称、延迟和丢包（纯文本）。
- 新增配置 `show_ping`（boolean，默认 true，theme.json 由规划者添加）；为 false 时不发任何 ping 请求，也不显示相关内容。
- 显示位置：卡片第二行（见第 5 节）；列表视图的「延迟」和「丢包」两列。
- testid：`node-ping`（带 `data-latency` 和 `data-loss`，无数据时为空字符串）。

## 5. 卡片布局：任何文字都不能折行
线上 v1.3 的卡片中，「在线 98 天 4 小时」单独占一行，底部数值有时折成两行。新布局如下，每一行都是单行：
1. **标题行**：状态圆点、名称（溢出时省略号）、右侧系统 logo（14px）和国旗（14px 高）。
2. **信息行**（12px，灰色）：`在线 98 天 4 时 · 延迟 32 ms · 丢包 0%`。离线节点显示 `离线 3 小时`，不显示延迟和丢包。宽度不够时省略号截断，完整内容放在 `title` 里。
3. **2×2 指标**：保持不变，但标签与百分比所在行、副文字行都要 `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`。
4. **底部三列**（实时速率 / 当期流量 / 到期）：每个数值单行、省略号截断，带完整的 `title`。列宽用 `grid-template-columns: 1fr 1fr minmax(0, 1.15fr)`。
- 卡片网格用 `repeat(auto-fill, minmax(236px, 1fr))`（标准尺寸为 280px）。在 1280、1440、1920 和 390 宽度下逐个检查，任何文字都不能折行。
- 价格格式：所有周期都用斜杠，例如 `¥629/一次性`、`US$86.40/年`（修改 `priceShort`，原来的 `¥629 一次性` 改为 `¥629/一次性`，单元测试同步修改）。

## 6. 取消毛玻璃
- 删除背景光斑、所有 `backdrop-filter` 和半透明背景。页面背景恢复 v1.2 的浅灰 `#f5f6f7`，卡片、面板和顶栏为不透明白色。
- 保留 v1.3 的 8px/6px 圆角和 `--shadow-1`/`--shadow-2` 阴影、悬停上移、进度条凹槽（这些是用户在 v1.3 要求的立体感）。
- 删除 `.glass-*` 类名和 `prefers-reduced-transparency` 等相关回退代码，不留死代码。

## 7. 详情页：信息条并入名称卡片
截图中红框部分（负载 1/5/15m、进程、TCP/UDP、系统运行）不再单独占一张卡片，并入顶部名称卡片：
- 宽度 ≥900px：放在名称卡片右侧，右对齐，单行。
- 宽度 <900px：放在「中国 · 最近上报 1 秒前」下面一行，可以换行，但每一项（标签 + 数值）内部不能断开。
- 有 Swap 时同样显示。删除原来的独立信息条，后面的内容相应上移。

## 8. 测试精简（测试会话负责）
- E2E 合并为 1 个文件 `tests/e2e/smoke.spec.ts`，不超过 10 个用例，覆盖：
  1. 首页渲染（总览、卡片、地图）。
  2. 切换到列表视图后的列顺序。
  3. 进入详情页并显示图表。
  4. WS 返回 503 时降级为轮询。
  5. 未登录时隐藏后台按钮，登录后显示。
  6. 配置生效（例如 `show_ping=false` 时没有 ping 请求）。
  7. 卡片不折行：在 1280 和 390 宽度下检查卡片内所有文字元素的高度都是单行。
  8. 首页 ping 显示。
- 删除 `home`、`live`、`scenarios` 和 `v1.1`、`v1.2`、`v1.3` 这些 spec。只保留 chromium 一个 project。
- 单元测试只保留纯函数：`format`、`config`、`api`、`nodes`、`ping`（新增）、`icons`、`source-safety`。删除空文件 `finance`、`ranges`，以及 `check-size`、`color`、`prefs`、`visitor` 的测试。
- CI 依次运行 `npm test`（vitest）、build、size gate 和 `npm run e2e`。整套测试在本地 60 秒内跑完。
- mock hub 的 ping 接口已经存在，需要确认 `hours=1&points=12` 能返回正确的数据。新增场景 `noping`：ping 为空数组，用于验证显示「—」。

## 9. 性能再优化
线上实测（缓存命中）：TTFB 735ms；API 在 937ms 发出，nodes 472ms、me 647ms、config 652ms；FCP 1024ms；WorldMap chunk 要等入口执行完才开始请求；国旗和系统图标在 1456ms 才开始加载。
- **节点快照缓存**：`/api/nodes` 成功后把节点数组存入 `localStorage['dys:snap:v1']`（只存 id、name、os、country、group、price、currency、billing_cycle、expires_in、traffic_* 和 metrics 的最新一帧；超过 200KB 时不存；读写都要包 try/catch）。下次打开时用快照立即渲染真实布局（连接状态显示「连接中」），拿到新数据后无缝替换。快照超过 24 小时作废。`me` 不缓存（后台按钮以实时结果为准）。
- **预加载**：在 `index.html` 里对 WorldMap chunk 加 `<link rel="modulepreload">`（用 Vite 插件或 `build.modulePreload` 实现，构建后要能看到）。对 `/api/nodes` 加 `<link rel="preload" as="fetch" crossorigin>`，并确认 main.ts 里的 fetch 复用了这个预加载（credentials 模式一致），不能请求两次。
- **图标内联**：系统 logo（simple-icons 的 path）已经是 JS，不要再生成单独的 svg 文件请求；国旗保持独立文件，但对首屏可见卡片用到的国旗不加 lazy。
- **ping 请求**完全在空闲时进行，见第 4 节。
- 预算不变（入口 ≤60KB gz，首屏 ≤85KB，详情 ≤40KB），并补充一条：首页开页期间 `/api/nodes` 只请求 1 次。

## 10. 删除顶栏的「N 在线」胶囊
它与总览的「服务器」格重复，删除站点名旁的在线胶囊（v1.3 第 7g 条作废），同时删除对应的骨架。

## 11. testid 变动
- 新增：`node-ping`、`admin-link`（保留）、`detail-stats`（详情页名称卡片内的信息组）
- 删除：`online-pill`（如果有）、原来独立的详情信息条
