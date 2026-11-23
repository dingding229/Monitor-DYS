# T35 · v2.0 UI 实现（Antigravity）

T32 的原型 `docs/design/v2/prototype.html` 和 `tokens.md` **已通过审核**。现在按原型重写全部页面。
先读：`docs/SPEC-v2.0.md`、`docs/design/v2/tokens.md`，以及后端会话刚完成的状态层 `src/lib/app-state.svelte.ts`、`src/lib/home-view.svelte.ts`（读文件头的接口说明）。

## 审核意见（实现时一并修正）
1. **后台按钮图标**：原型里的图标像太阳（用户在 v1.4 专门投诉过）。必须是带齿的齿轮（cog），线宽 1.5，16px 视口；≥640px 时显示「后台」文字。
2. **左上角 logo**：保留现在的 `/favicon.svg` 圆形 logo（22×22，`rounded-full`，1px 浅描边，加载失败时隐藏），不要用柱状图图标。
3. **地区筛选胶囊**：只有选中了国家时才显示「地区：香港 ×」，没选时不显示（原型里显示了「地区：全部 ×」）。
4. **方向顺序统一 ↑ 在前 ↓ 在后**：详情页「网络速率」卡里是 ↓ 在前，改成与卡片一致。
5. **图表坐标轴字号统一**：Ping 延迟图的刻度字号明显比其他图表大，所有 uPlot 图表刻度统一为 11px、`--chart-axis` 颜色。
6. 原型顶栏的「首页/详情页」「深色/浅色」切换按钮只是原型用的，不要实现。配色由配置 `color_scheme` 决定。
7. 国旗继续用现有的 `CountryFlag` 组件（SVG 文件），不要用 emoji。地图继续用现有的 `WorldMap`（只换样式 token）。

## 实现要求
- 重写：`src/App.svelte`、`src/pages/Home.svelte`、`src/pages/NodeDetail.svelte`、`src/components/*.svelte`、`src/app.css`、`index.html`。可以新增、合并或删除组件文件。
- **页面只负责展示**：会话编排和派生数据全部通过 `createApp()` 和 `home-view` 获取，不要在组件里重新实现筛选、排序、汇总、快照、URL 状态等逻辑。如果接口缺了什么，在报告里写明，不要自己改 `src/lib/**`（那是后端会话的文件）；确实缺少时，可以在组件里临时做最小实现并标注 `// TODO(T33)`。
- 卡片 DOM 按 tokens.md 3.6 的骨架实现：单卡 ≤ 70 个元素，进度条为单元素 + `--v`。保留屏幕外冻结、分批渲染、`content-visibility`。
- **深色模式**：颜色全部走 CSS 变量，`:root[data-scheme="dark"]` 下切换深色（后端会话的 `app-state` 会设置 `document.documentElement.dataset.scheme`）。`index.html` 的内联关键 CSS 和一段 ≤5 行的内联脚本：在首帧前读取 `localStorage['dys:scheme']`（`light`/`dark`/`auto`，try/catch），auto 或没有值时按 `prefers-color-scheme` 设置 `data-scheme`，使刷新时背景直接是正确的颜色。uPlot 的颜色从 CSS 变量读取，切换方案时图表颜色随之更新。
- 保留所有 `data-testid`（见 SPEC-v2.0 附录），以及 v1.4–v1.6 的全部交互：键盘 `/`、`Esc`、`←`/`→`；URL 状态；探针选择；hover 预取详情 chunk。
- 文字不折行：在 390 / 1280 / 1440 / 1920 下检查。
- CSS：重复的长 class 串收敛成语义类（`@layer components`），不留死 CSS。
- 不使用 `{@html}`，不加依赖，不执行 git，不要改 `src/lib/**`、`tests/**`、`theme.json`。

## 验收（全部自己跑通）
- `npm run check`、`npm test`、`npm run build`、`node scripts/check-size.mjs`（**新预算**：入口 ≤42KB、首屏 ≤60KB、详情 ≤30KB；达不到时报告差多少以及原因）。
- `npx playwright test` 全部通过。如果是因为测试写死了旧的 DOM 结构（而不是 testid）而失败，在报告里列出来，由测试会话修改；不要改测试。
- 用 mock hub 或 `npm run dev` 截图，保存到 `docs/design/v2/impl/`：`home-1440.png`、`home-dark-1440.png`、`home-390.png`、`list-1440.png`、`detail-1440.png`、`detail-dark-1440.png`、`detail-390.png`。
- 报告：改动的文件列表、`src` 总行数、各 chunk 体积、单卡元素数，以及缺少的接口。
- 回复的最后一行写 `T35-DONE`。

## 补充：T33 交付的接口（已审核）
- `createApp(startup)`：只读 getter（路由、节点、配置、连接、错误、401、快照、ping、视图状态、`home.directory`、`home.summary`、`orderedNodes`、`activeNode`、`snapshotOnly`）+ 动作 `selectNode/back/retry/setLayout/setSort/setGroup/setCountry/setQuery`。不要解构 getter，在模板或 `$derived` 里读。
- 地图：`createCountryView(() => app.home.directory.grouped, isHovered)` 返回 `aggregate`（3 秒节流，悬停暂停）。
- 连接状态颜色已经用 `var(--online)`、`var(--warn)`、`var(--offline)`，请在 token 中定义它们。
- 首帧脚本建议（放在关键样式之前）：
```html
<script>{let s;try{s=localStorage.getItem('dys:scheme')}catch{}document.documentElement.dataset.scheme=s==='light'||s==='dark'?s:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}</script>
```
- 当前已知：`tests/unit/config.test.ts` 有 2 条因新增 `color_scheme` 而失败，由测试会话修，你不用管。
