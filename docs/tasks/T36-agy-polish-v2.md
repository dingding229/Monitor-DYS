# T36 · v2.0 返工：体积、内存、列表行（Antigravity）

T35 已审核：视觉与原型一致，功能完整，check/单测通过。性能对比（`npm run perf` + `npm run perf:compare`，结果在 `docs/perf/current.json`）显示以下几项未达标，本轮修正。文件归属不变（`.svelte`、`app.css`、`index.html`），后端会话同时在优化 `src/lib/**`，测试会话在改 `tests/**`，请不要碰那些文件。

## 未达标项（目标见 SPEC-v2.0 §3）
| 指标 | 现在 | 目标 |
|---|---:|---:|
| 入口 JS gzip | 44,923 | ≤ 42,000 |
| 首屏 JS gzip | 62,268 | ≤ 60,000 |
| 详情 chunk gzip | 32,614（比 v1.6 还大） | ≤ 30,000 |
| 首页 CSS gzip | 7,178 | ≤ 6,952 |
| 500 节点 60 秒后 JS 堆 | 10.16 MiB | ≤ 9.25 MiB |

## 要做的
1. **详情 chunk**（uPlot 本身约 20KB，其余是 `NodeDetail.svelte`、`DetailHistory.svelte`、`ChartCard.svelte`）：合并重复的图表卡片标记和图例代码、去掉重复的格式化/轴配置（同一套 axis/series 工厂复用）、删除不再使用的分支。不要改 `lib/detail-series.ts`（后端会话在改；需要改的地方写进报告）。
2. **入口 JS**：检查 `App.svelte`、`Home.svelte`、`NodeCard.svelte`、`Summary.svelte` 中只在少数情况下用到的块（登录提示、错误页、空状态、骨架屏、公告等），能拆成动态 import 的拆出去，或者精简标记；内联 SVG 图标集中到一个组件并去重。
3. **CSS**：删除死规则、合并重复声明；`@layer components` 里的语义类不要再和 Tailwind 工具类重复定义同样的样式。
4. **内存**（500 节点）：首页卡片的每个实例尽量少持有闭包和 `$derived`；不要为每张卡片创建独立的 observer 或定时器（共享全局的）；能用纯函数在模板里直接算的，就不要建 `$derived`。
5. **列表行高度**：tokens.md 规定行高 44px，现在因为「到期」列有两行（日期 + 价格），行高约 72px。改为单行：到期列只显示「N 天后到期」，价格放进 `title`；如果单行放不下，就把价格放到同一行，用 `·` 分隔并省略号截断。
6. 在 390px 宽度下真实滚动首页（不是整页截图）检查卡片，内容出现不能有明显延迟；整页截图里 `content-visibility` 导致的空白卡片是正常的，不需要处理。

## 验收
- `npm run check`、`npm test`、`npm run build`、`node scripts/check-size.mjs`（全部 OK）。
- `npm run perf` 然后 `npm run perf:compare`：除「60 秒后 JS 堆」外全部 PASS；堆的数值写进报告（它也取决于后端会话的改动）。
- `npx playwright test`：允许失败的只有「inline background in built <head>」这一条（测试会话在改）。
- 截图更新 `docs/design/v2/impl/list-1440.png`。
- 回复最后一行写 `T36-DONE`。不要执行 git。
