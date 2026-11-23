# DYS v2.0 规格：UI 重写（以本文件为准，未提到的行为沿用 SPEC.md 与 v1.1–v1.6）

用户要求：在现有「简约、紧凑」风格的基础上重写 UI 页面。
1. 美观、现代化，扁平化设计。
2. 前端架构性能高、占用资源少。

## 0. 分工与文件归属（互不交叉）
| 角色 | 会话 | 拥有的文件 |
|---|---|---|
| UI 设计与实现 | Antigravity `0d086aad…`（由 Claude 用 computer use 驱动） | `src/App.svelte`、`src/pages/**`、`src/components/**`、`src/app.css`、`index.html`、`public/**`、`docs/design/v2/**` |
| 后端/杂项 | Codex `01a20875-63e0…` | `src/lib/**`、`src/main.ts`、`vite.config.ts`、`scripts/**`、`README.md`、`preview.png` |
| 测试 | Codex `01a20875-8b17…` | `tests/**`、`playwright.config.ts`、`vitest.config.ts`、`.github/workflows/**` |
| 规划/审核/发布 | Claude | `theme.json`、`package*.json` 版本、`docs/SPEC*`、`docs/tasks/**`、git |

任何会话都不执行 git。需要改别人的文件时，在报告里提出，由 Claude 转达。

## 1. 保留不变
- 所有功能：总览、地图、分组/地区/搜索/排序、卡片/列表两种视图、首页 ping 区块、详情页（图表、时间范围、Ping 探针选择、节点切换）、访客气泡、公告、页脚、登录提示、连接状态、快照启动、URL 视图状态、键盘快捷键。
- 所有配置项（theme.json），所有现有 `data-testid`（见附录），所有数据规则。
- 不使用 `{@html}`；不增加运行时依赖（可以删除）；兼容旧 Hub。

## 2. 视觉方向（Antigravity 先出原型，Claude 审核后才实现）
- **扁平**：不使用阴影、渐变、毛玻璃和位移动画；用 1px 边框和背景层级区分区块。
- **紧凑**：4px 网格；正文 13px，辅助 12px，数值用等宽数字（`tabular-nums`）；卡片内边距 12px。标准宽度下，桌面 1440 一行至少 5 张卡片。
- **现代**：统一的设计 token（颜色、圆角 8/6/999、间距、字号），系统字体栈（不加载网络字体），清晰的信息层级（名称 > 关键数值 > 辅助信息），状态色只用于状态（在线/警告/危险），主题色 `accent` 只用于交互（选中、焦点、链接、图表主线）。
- **深色模式**：新增，跟随系统（`prefers-color-scheme`），theme.json 新增 `color_scheme`（auto/light/dark，默认 auto）。`index.html` 的内联关键 CSS 必须同时覆盖浅色和深色，刷新时不能闪白或闪黑。
- 图标统一线性 1.5px，16px 视口，内联 SVG 组件，不用图标字体。
- 可访问性：对比度 AA，可见的焦点环，所有按钮有可读名称，`prefers-reduced-motion` 时关闭过渡。
- 响应式：390 / 768 / 1280 / 1440 / 1920 都要美观，任何卡片文字不折行（沿用 v1.4 规则）。

## 3. 架构与性能（必须达标）
目标（mock `many` 500 节点，WS 每秒 1 帧，本地构建）：
| 指标 | v1.6 基线 | v2.0 目标 |
|---|---|---|
| 入口 JS gzip | 49.7KB | ≤ 42KB |
| 首屏 JS gzip（入口+地图） | 68.6KB | ≤ 60KB |
| 详情 chunk gzip | 32.4KB | ≤ 30KB |
| CSS gzip | 测试会话量出基线 | 不超过基线 |
| 首批卡片出现 | 94ms 级 | ≤ 基线 × 1.1 |
| WS 帧长任务 | < 50ms | < 50ms |
| 60 秒后 JS 堆 | 基线 | ≤ 基线 × 0.85 |
| 单张卡片 DOM 节点数 | 基线 | ≤ 基线 × 0.8 |

做法：
- **页面变薄**：`App.svelte` 现在 390 行，大部分是会话编排（me/config/nodes/快照/视图状态/路由）。由后端会话抽到 `src/lib/app-state.svelte.ts`（单一 `createApp()`，暴露只读的响应式状态和动作）；首页的筛选/排序/汇总/分组/国家聚合抽到 `src/lib/home-view.svelte.ts`。之后 `.svelte` 文件只负责展示。
- **卡片**：单张卡片尽量扁平的 DOM，指标条用 CSS 变量宽度（`--v`）而不是多层元素；屏幕外冻结、分批渲染、content-visibility 保留。
- **内存**：WS 帧合并复用对象（已有）；ping 历史只保留卡片需要的 12 个桶；图表在离开详情页时销毁；事件监听和 observer 全部可清理。
- CSS：Tailwind 继续用，但重复的长 class 串收敛到少量语义类（`@layer components`），删除死 CSS。

## 4. 交付顺序
1. **并行**：T32 Antigravity 出设计原型（不改 src）；T33 后端抽状态层 + 深色模式配置 + 体积预算收紧；T34 测试会话量基线。
2. Claude 审核原型（必要时返工）。
3. T35 Antigravity 按原型和新的状态层实现全部页面。
4. T36 测试会话更新 E2E 并对比性能；T37 后端生成 preview.png、更新 README。
5. Claude 审核、验收、发布 v2.0.0。

## 附录：必须保留的 testid
admin-link announcement brand-icon chart conn-status country-filter-chip country-list country-row detail-stats empty-state group-tab login-required map-country no-loss node-card node-ping node-row node-switcher ping-bars probe-all probe-chip range-btn search-input skeleton sort-select summary summary-tile visitor-bubble visitor-panel world-map
