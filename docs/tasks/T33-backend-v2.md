# T33 · v2.0 状态层抽取 + 深色模式配置 + 体积预算（后端会话）

先读 `docs/SPEC-v2.0.md`（总规格）和 `docs/SPEC.md`（数据规则）。项目路径 `/Volumes/SSD/项目/monitor-theme`。

## 背景
v2.0 由 Antigravity 重写全部 `.svelte` 页面。为了让页面只负责展示，你负责把编排和派生逻辑从组件里抽到 `src/lib`，并保证 v1.6 的行为完全不变。

## 任务
1. **`src/lib/app-state.svelte.ts`**：从 `src/App.svelte`（390 行）中抽出所有会话编排：初始 Promise（me/nodes/config）的消费、节点 store、快照保存、ping store、站点配置、访客偏好、URL 视图状态（含 120ms 搜索防抖）、路由、前后节点切换顺序、accent 应用、错误/401 状态、连接状态。导出 `createApp({ initialMe, initialNodes, initialConfig })`，返回一个对象：只读响应式字段（getter）+ 动作函数（`selectNode`、`setLayout`、`setSort`、`setGroup`、`setCountry`、`setQuery`、`back` 等，名称自定但要在文件头写清楚接口说明）。
2. **`src/lib/home-view.svelte.ts`**：首页筛选、排序、分组计数、国家聚合（3 秒节流、hover 暂停）、总览汇总（一次遍历）放在这里，供首页和地图使用。如果 `view-state.ts` 里已有 `directory()`，复用它，不要写两份。
3. **改造现有 `App.svelte` 和 `Home.svelte` 去调用新模块**——这是唯一允许你碰的 `.svelte` 文件，只做最小接线改动（删除被搬走的逻辑、改为调用 `createApp`），不改任何样式和标记结构，保证 v1.6 外观和行为不变、E2E 全部通过。Antigravity 之后会整体重写这些文件，所以接口要好用、注释清楚。
4. **深色模式配置**：`src/lib/config.ts` 支持新键 `color_scheme`（`auto` | `light` | `dark`，默认 `auto`，非法值回退 `auto`）。在 `app-state` 中把结果写到 `document.documentElement.dataset.scheme`（`light`/`dark`，auto 时按 `matchMedia('(prefers-color-scheme: dark)')` 并监听变化）。另外把配置的方案写入 `localStorage['dys:scheme']`（try/catch），供 `index.html` 内联脚本在首帧前读取（内联脚本本身由 Antigravity 写，你在报告里给出建议的 5 行以内代码）。theme.json 由 Claude 添加该配置项，你不要改。
5. **体积预算**：`scripts/check-size.mjs` 改为新预算：入口 ≤42KB、首屏 ≤60KB、详情 ≤30KB（gzip），并新增 CSS gzip 一行（预算先设为当前值 +5%，打印实际值）。现在的构建会超出新预算——这是预期的，加一个环境变量 `SIZE_BUDGET=v1` 时使用旧预算（60/85/40），CI 暂时用旧预算，等 UI 重写完成后由 Claude 切换。
6. **体积优化（不动 svelte 也能做的部分）**：检查 `vite.config.ts` 的 chunk 划分、`src/lib/icons.ts` 与 `os-icons` 是否有可删数据、`color.ts` 是否还能更小、`format.ts`/`api.ts` 的重复代码；删除未使用导出（先 grep，只在测试中用到的列给测试会话处理）。

## 约束
- 文件归属：`src/lib/**`、`src/main.ts`、`vite.config.ts`、`scripts/**`、`README.md`，以及第 3 条的最小接线。不要改 `tests/**`、`theme.json`、`app.css`、`components/**`。
- 不使用 `{@html}`，不增加依赖，不执行 git。
- 新增的纯函数要能被单元测试：在报告里列出新模块导出的签名，测试会话会补单测。

## 验收
- `npm run check`、`npm test`、`npm run build`、`SIZE_BUDGET=v1 node scripts/check-size.mjs`、`npx playwright test` 全部通过。
- 报告：新接口签名、`App.svelte` 前后行数、`src` 总行数、各 chunk gzip 体积、深色内联脚本建议。
- 最后一行写 `T33-DONE`。
