# DYS v1.5 规格：最终优化（在 SPEC.md 和 v1.1–v1.4 基础上增补；冲突时以本文件为准）

用户要求：优化加载逻辑、交互逻辑和代码逻辑，减少代码量，优化代码结构；服务器很多时也要快速、流畅地加载；修复刷新时出现的默认背景色；取消立体感，恢复平整的样式；延迟和丢包的显示参考 `docs/design/feedback-v1.5/ping-ref.png`。

## 1. 刷新时出现的默认背景色
原因：`index.html` 没有内联背景，外部 CSS 加载完成前，页面使用浏览器默认背景（深色模式下是黑色，其他情况下是白色）。
- 在 `index.html` 的 `<head>` 中内联一段关键 CSS（放在所有 link 之前），内容包括：`<meta name="color-scheme" content="light">` 和 `<style>html,body{background:#f5f6f7;color:#171717;margin:0}</style>`。
- 在 `#app` 内放一个纯 HTML 的静态骨架（顶栏高度 + 灰底），Svelte mount 时替换它，这样刷新的第一帧就是正确的底色和布局，不会出现闪白或闪黑。
- `app.css` 中的 `--bg` 与内联值保持一致，只在一处定义（内联 CSS 用同一个色值，并加注释说明需要同步）。

## 2. 取消立体感，恢复平整样式
- 删除 `--shadow-1`、`--shadow-2`，以及卡片悬停时的上移、阴影切换、进度条的内阴影和选中态的渐变高光。
- 卡片、面板和顶栏使用 1px `--border` 边框，不加阴影。卡片悬停时只把边框颜色加深（`#d4d4d4`），120ms 过渡。
- 圆角保留 8px/6px。删除所有相关的死 CSS。

## 3. 延迟和丢包（参考图）
卡片中删除信息行里的「延迟 · 丢包」，改为在卡片底部新增一个区块，位于「实时速率 / 当期流量 / 到期」下方，用 1px 细线分隔，左右两栏，中间用 1px 竖线隔开：
```
延迟 ms      136·142·132  │ 丢包 %       0.0·0.0·0.0
▬▬▬▬▬▬▬▬▬▬▬▬               │ ▬▬▬▬▬▬▬▬▬▬▬▬
```
- 第一行：灰色小标签「延迟」，后面跟更浅、更小的单位「ms」；右对齐显示各探针最近一次的延迟，用「·」连接，按探针首次出现的顺序排列，最多 3 个（超过的不显示，完整内容放在 `title` 里）。丢包同理，单位为 `%`，保留 1 位小数。
- 第二行：12 段横向小条（与 `points=12` 的 12 个时间段对应），每段宽度均分，高 3px，间隔 2px，圆角 1px。每段颜色按该时间段所有探针的平均值着色：
  - 延迟：<100ms 绿色 `#86d5a8`，100–200ms 琥珀色，>200ms 红色；没有数据时为浅灰。
  - 丢包：0 为绿色，≤5% 为琥珀色，>5% 为红色；没有数据时为浅灰。
- 加载中：数值显示灰色「…」，小条全部为浅灰。没有数据时显示「—」。
- 离线节点或 `show_ping=false` 时不显示这个区块，卡片高度随之变化（同一行卡片保持顶部对齐即可）。
- `summarizePing` 增加 `buckets: { latency: number|null, loss: number|null }[]`（按时间排序，最多 12 个），以及每个探针的 `latency` 和 `loss`。
- 卡片信息行恢复为「在线 98 天」，后面可以跟价格（例如「在线 25 天 · US$45.68/年」），整行仍然单行显示，溢出时用省略号。
- 列表视图的「延迟」和「丢包」列显示平均值（与 v1.4 相同）。
- testid：`node-ping`（保留，放在区块根元素上，带 `data-latency` 和 `data-loss`），新增 `ping-bars`。

## 4. 服务器很多时的加载和流畅度（必须达标）
目标：在 mock 场景 `many`（500 个节点，WS 每秒推送 1 帧）下：
- 首页从 HTML 到出现第一批卡片不超过 1.2 秒（本地构建，无网络限速）。
- 稳定运行时，每帧 WS 更新的主线程长任务不超过 50ms。
- 滚动不卡顿。

具体做法：
1. **store 用 `$state.raw`**：节点数组不再使用深度代理。每帧收到数据后按 id 合并：字段没有变化的节点复用原对象（引用不变），只为有变化的节点创建新对象。这样 keyed each 里没有变化的卡片不会重新渲染。
2. **屏幕外冻结**：用一个全局共享的 IntersectionObserver（rootMargin 300px）。卡片或列表行不在视口内时，冻结显示的数据（保留最后一次渲染的值，不更新 DOM），回到视口时立即用最新数据更新一次。
3. **分批首渲染**：节点超过 60 个时，先渲染前 40 个，其余在 `requestIdleCallback` 中每批 60 个追加（不支持时用 `setTimeout 16`）。追加前用 `content-visibility:auto` 加 `contain-intrinsic-size` 占位，避免滚动条跳动。
4. **content-visibility**：卡片和列表行都加 `content-visibility:auto; contain-intrinsic-size:auto 260px`（列表行为 44px）。
5. **派生计算节流**：总览数字每帧计算一次（O(n)，一次遍历算完所有字段）。地图的国家聚合最多每 3 秒更新一次，地图 hover 时暂停更新。
6. **搜索防抖**：输入后 120ms 再筛选。筛选、排序结果用一个 `$derived` 计算，不要多层嵌套 derived 链，每次都完整重算一遍。
7. **快照**（v1.4）保留，超过 500 个节点时只存前 120 个，用于首屏。
8. **Ping 调度**（v1.4）保留：只请求视口内的节点，并发 3，滚动停止 300ms 后才把新进入视口的节点加入队列。

## 5. 交互逻辑
- 分组标签、地区筛选、搜索和排序的状态同步到 URL query（`?g=亚太&c=HK&q=tokyo&sort=cpu`），用 `history.replaceState` 写入。刷新或分享链接时可以恢复；从详情页返回时恢复原来的筛选和滚动位置。
- 详情页的上一个/下一个节点按首页当前的筛选和排序结果切换。
- 键盘：在首页按 `/` 聚焦搜索框（输入框内不触发），按 `Esc` 清空搜索。详情页按 `←` / `→` 切换节点。
- 卡片的 hover 预取详情 chunk：同一会话只预取一次。
- 连接状态的胶囊上 `title` 显示最后更新时间（已有的保留）。

## 6. 代码逻辑与结构（减少代码量）
目标：`src/` 总行数（不含生成的 `map-data.ts`）从约 5,520 行减少到 4,200 行以下，入口 JS gzip 后不大于 v1.4（52KB），详情 chunk 不大于 33KB。
- **删除死代码**：`lib/finance.ts`（已无引用）；未使用的导出 `cycleLabel`、`money`、`monthlyCost`、`osName`、`percent`、`rate`、`countryName`、`useNodes`（先 grep 确认，只在测试中使用的也要删，由测试会话同步删除对应断言）。
- **拆分 NodeDetail.svelte（1,110 行）**：
  - 纯数据处理（metrics 和 ping 序列的构建、时间范围、轴刻度）移到 `lib/detail-series.ts`，并把 `ranges.ts` 合并进来。
  - 页面只保留布局：`pages/NodeDetail.svelte` 不超过 350 行，图表卡片组件为 `components/ChartCard.svelte`。
- **合并小模块**：`prefs.ts` 和 URL 状态合并为 `lib/view-state.ts`；`fadeOverflow.ts` 改为 CSS（`mask-image` + scroll-timeline 或 IntersectionObserver 哨兵），如果 CSS 能完全替代就删除这个文件。
- `color.ts`（101 行）：主题色校验用 `CSS.supports('color', v)`，alpha 用 `color-mix(in srgb, X N%, transparent)`，只保留 uPlot 真正需要的部分。
- `format.ts`、`api.ts`、`config.ts`：去掉重复的类型守卫，统一使用 `api.ts` 中的 `isObj`、`num` 等工具函数。
- 不能使用 `{@html}`；仍然兼容旧版 hub；所有 testid 保持不变（新增的除外）。

## 7. 测试（测试会话，继续保持简易）
- mock hub 新增 `many` 场景：500 个节点，分布在 20 个国家，WS 每秒推送 1 帧，每帧只有约 30% 的节点数值变化。
- `smoke.spec.ts` 新增 3 个用例（总数不超过 12 个）：
  1. `many` 场景的首屏耗时，以及 10 秒内长任务的最大时长（通过 PerformanceObserver longtask 统计）。
  2. URL 筛选状态在刷新后保留。
  3. 卡片 ping 区块显示 3 个探针的数值和 12 段小条。
- 在 `index.html` 构建产物中检查内联了背景色（单元测试或 E2E 均可）。
- 单元测试：`summarizePing` 的 buckets；store 的按 id 合并时，没有变化的节点保持引用不变。
- 删除或修改依赖已删除导出的测试。
