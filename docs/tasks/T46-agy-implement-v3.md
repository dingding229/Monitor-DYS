# T46 · 按 A5 定稿重写全部页面（Antigravity）

用户已确认 `docs/design/v3/a5/` 的设计，开始实现。先读：
- `docs/SPEC-v3.md`（**第 2 节是你和后端会话之间的接口约定**，后端正在同时实现 `src/lib` 这一侧）
- `docs/design/v3/a5/prototype.html` 和截图，主题色值见 `docs/design/v3/a3/README.md`
- `docs/SPEC-v2.0.md` 附录（必须保留的 testid）

## 实现
- 重写 `src/App.svelte`、`src/pages/**`、`src/components/**`、`src/app.css`、`index.html`，可以新增、合并、删除组件文件。
- **只有浅色**：删除深色 CSS 和相关逻辑。6 套主题按 `html[data-theme="…"]` 定义 CSS 变量；`index.html` 首帧内联脚本读 `localStorage['dys:theme']` 设置 `data-theme`（try/catch，没有值时用 `emerald`），内联关键 CSS 的背景色与 `app.css` 一致，刷新不能闪色。
- **地图**：基于现有 `WorldMap.svelte` 和 `src/lib/map-data.ts` 实现 A5 的样式（国家按节点数用主题色深浅着色、脉冲标记、数量徽章、悬停浮层贴近目标并在边缘翻转、图例、经纬网格）。地区区域与左侧总览等高，下方不留空白。手机端隐藏地图图形，只显示地区列表（最多 5 行，可展开）。
- 卡片：按 A5（无左侧色条、统一外观、同行等高、第一行状态点+名称+国旗、第二行系统 logo+系统名+在线时长、2×2 指标条、负载小折线、速率/流量/到期三列、延迟丢包 12 段条）。保留屏幕外冻结、分批渲染、`content-visibility`。单卡后代元素 ≤ 90。
- 详情页按 A5 布局；Ping 探针选择、时间范围、键盘 ←/→、URL 状态、hover 预取等原有交互全部保留。
- 页脚、访客气泡、公告、登录提示、空状态、骨架屏都要按新风格实现。
- 新 testid 见 SPEC-v3 §4；原有 testid 全部保留。

## 和后端的配合
- 先做不依赖新数据的部分（`app.css` 主题与样式、`index.html`、布局和组件结构）。
- **等文件 `docs/tasks/T45.done` 出现后**，再接入 `app.history`、扩展后的 `summary` 和地区 `aggregate`（每隔几分钟检查一次）。接口名以 SPEC-v3 §2 为准；如果实际实现和约定不一致，以 `src/lib` 里的代码为准，并在报告中写明。
- 不要改 `src/lib/**`、`tests/**`、`theme.json`，不要执行 git。

## 验收（全部自己跑通）
- `npm run check`、`npm run build`、`node scripts/check-size.mjs`（v2 预算全部 OK）。
- `npm test`：如果失败只是测试仍引用已删除的接口（深色模式、accent），列出来，由测试会话修改。
- `npx playwright test`：同上，只因旧 DOM 或旧配置导致的失败列出来即可。
- 截图保存到 `docs/design/v3/impl/`：`home-1440.png`、`home-390.png`、`detail-1440.png`、`detail-390.png`、`list-1440.png`、`map-hover.png`、`theme-ocean.png`（把 mock hub 配置设为 `theme: "ocean"` 或在控制台改 `data-theme` 截图）。用 mock hub（`tests/mock-hub/server.mjs`）或 `npm run dev`。
- 报告：改动文件列表、各 chunk 体积、单卡元素数、与接口约定不一致之处。
- 回复最后一行写 `T46-DONE`。
