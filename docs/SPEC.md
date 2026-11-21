# Monitor-DYS 主题规格（唯一依据）

依据：https://monitor-document.pages.dev/dev/theme 与 /dev/architecture（2026-10-24 版）。
参考实现（MIT，可移植逻辑，需保留版权说明）：`/Volumes/SSD/项目/monitor-theme-reference`（monitor-theme-default 1.4.3，React）。
**凡与本文冲突以官方文档为准；有疑问在报告里提出，不要自行发明。**

## 1. 技术栈（已定）
- Svelte 5（runes）+ Vite + TypeScript（strict，`moduleResolution: "bundler"`）
- Tailwind CSS v4（`@tailwindcss/vite`）
- 图表：uPlot
- 路由：自写极简 History 路由（`/` 和 `/node/:id`），无第三方路由库
- 测试：Vitest（单元）+ Playwright（E2E，连 Mock Hub）
- Node 24，npm；包体目标 gzip 后 < 120KB（不含国旗等资源）

## 2. 目录
```
theme.json            # 元数据，Vite 直接 import（唯一版本来源）
preview.png           # 面板缩略图，16:10，约 1280×800
index.html            # <link rel="icon" href="/favicon.svg">、<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
public/favicon.svg
public/apple-touch-icon.png   # 180×180，不透明背景
src/main.ts  src/App.svelte  src/app.css
src/lib/api.ts        # 类型、api()、ApiError、safeNodes、groupsOf
src/lib/nodes.svelte.ts  # useNodes：WS + 轮询降级 + visibilitychange
src/lib/format.ts     # 字节/速率/百分比/货币/计费周期/时长/到期
src/lib/config.ts     # 读取并校验站点设置
src/lib/ranges.ts     # 由 history_days 生成时间范围按钮
src/lib/router.svelte.ts
src/lib/prefs.ts      # 访客偏好（localStorage，try/catch）
src/components/*.svelte  src/pages/Home.svelte  src/pages/NodeDetail.svelte
tests/unit/*.test.ts  tests/e2e/*.spec.ts  tests/mock-hub/  tests/fixtures/
scripts/pack.sh
.github/workflows/ci.yml  .github/workflows/release.yml
```

## 3. 发布 / 安装（必须）
- `tar czf theme.tar.gz dist theme.json preview.png`（归档根目录即主题目录，与参考实现一致），随后 `gzip -t theme.tar.gz` 必须通过。
- 只能有普通文件和目录；总包 ≤32MiB，解压 ≤64MiB，单文件 ≤8MiB，条目 ≤2000。
- `package.json` 与 `package-lock.json` 的 version 必须等于 `theme.json.version`；release 工作流校验 tag `v<version>`，不一致就失败。
- Release 是正式版（非 pre-release/draft），附件名必须是 `theme.tar.gz`（另附 `.sha256`）。
- 安装方式：面板「主题 → 从 GitHub 安装」，填 `https://github.com/dingding229/Monitor-DYS`。

## 4. 接口
| 接口 | 用途 |
|---|---|
| `GET /api/me` | `site_name`、`authed`、公开开关、`history_days`（1–365，缺失时按 7） |
| `GET /api/nodes` | 节点快照数组 |
| `GET /api/nodes/{id}/metrics?hours=&points=&series=` | 历史，`step`、`metrics[]`、`ping[]`、`probes[]` |
| `GET /api/ws`（支持 `DecompressionStream` 时用 `?gzip`） | 每 2s 推送一次节点快照 |
| `GET /api/themes/dys/config` | 只返回改过的键；`{}` 表示从未保存；404（旧 Hub）或任何失败都静默使用默认值 |

错误：`text/plain` 的正文是 Hub 给出的一行中文，可以直接显示；其他响应（代理/CDN）不显示正文，按状态码提示；网络错误、200 但不是 JSON 也按同样方式处理。401 表示公开页已关闭 → 显示「需要登录后查看」，并提供 `/admin` 链接。
请求加超时，超时后重试（参考 api.ts：20s 超时，重试 6 次，只用于 GET）。

## 5. 数据规则（逐条实现，Codex 逐条测试）
1. 任何键都可能缺失（匿名响应不包含仅管理员可见的键）。字段缺失或类型不对时，该节点的 `metrics` 视为 null，并显示「不可用」，不能让整页崩溃（参考 `safeNodes`）。
2. 三种状态：离线（`online:false`）、在线但尚未上报（`online:true, metrics:null` → 显示「等待数据」）、数据损坏（→「不可用」）。
3. 离线时长用 `last_seen_ago`（秒），**只在离线时显示**；值为 null → 「从未上报」；该键缺失（旧 Hub）→ 用 `last_seen` 和浏览器时钟计算，`last_seen` 为 0 或 null 表示从未上报。
4. 到期用 `expires_in`：0 =「今天到期」，负数 =「已过期 N 天」，null = 不显示；**键缺失**时才用 `expires_at` 在浏览器里计算。
5. 计费周期：monthly 1 / quarterly 3 / semiannual 6 / yearly 12 / biennial 24 / triennial 36 / once 0（一次性），`<n>m`（1–1200），无法识别 → NaN，且不显示折算月价。
6. 货币：`Intl.NumberFormat("zh-CN",{style:"currency",currency,maximumFractionDigits:2})`，抛异常时回退为 `"<code> <amount.toFixed(2)>"`。
7. 分组：顺序取每个分组首次出现的位置，不按名称排序；没有任何节点有分组时不显示分组标签；只有部分节点有分组时显示「未分组」标签；用 Symbol 或对象表示「全部」和「未分组」，不能用字符串，避免和真实分组名冲突；分组标签可横向滚动；汇总数字跟随当前选中的分组。
8. 时间范围：预设 `[1,6,24,168,720,2160]` 小时，去掉超过 `history_days*24` 的；离上限不足 25% 的预设也去掉；最后追加上限本身。
9. 历史：`points` 取图表宽度并限制在 60–1440；分别用 `series=metrics` 和 `series=ping` 请求；`minutes < step/60` 表示该时间段内节点部分离线（图上留空或变淡）；累计流量取 `/api/nodes`，不对历史求和。
10. Ping：按 `task_id` 首次出现的顺序建立序列，名称取自 `probes`。
11. 实时连接：只在成功解码一帧后才重置“连接陈旧”计时器；帧按顺序解码（异步解压时用 Promise 链保证顺序）；遇到 503 或断线时改为每 `poll_interval` 秒轮询 `/api/nodes`，并以退避方式重连 WS；页面隐藏时关闭 WS、停止轮询、丢弃进行中的请求结果；页面重新可见时先请求一次 `/api/nodes`，再重连 WS。
12. 安全：所有文本只用 Svelte 的 `{value}`。**禁止 `{@html}`、innerHTML。** 公告按纯文本渲染，保留换行用 `white-space: pre-line`。
13. 设置合并优先级：theme.json 默认值 < Hub 设置（逐项校验类型、范围、选项，不合法就用默认值）< 访客 localStorage（仅 layout、配色、排序）。站点级设置不能存 localStorage。
14. `accent` 用 `CSS.supports("color", v)` 校验，不合法就用默认值。
15. 旧 Hub 兼容：按文档兼容表处理（缺少 group / public_remark → `""`；缺少 history_days → 7；缺少 cpu_max / net_*_max → 只显示平均值；swap / tcp / udp / procs 缺失时隐藏对应项）。

## 6. 路由
- `/` 首页，`/node/:id` 节点详情。刷新后要能直接打开（Hub 会把未知路径回退到 index.html）。不能占用 `/admin`、`/api`、`/install.sh`、`/agent/*`。
- 页面标题为 `节点名 · site_name`（无则 "Monitor"）。

## 7. 视觉：极简卡片
- 以浅色为主，大量留白，1px 细边框（中性 200 / 深色下中性 800），圆角 12px，不用阴影或只用很弱的阴影，没有渐变。
- 字体：系统无衬线字体栈，数字使用 `font-variant-numeric: tabular-nums`。
- 只用一个主题色（来自 `accent` 设置），用于选中状态、进度条和图表主线；状态色：在线为绿色小圆点，离线为灰色，到期 ≤7 天显示琥珀色。
- 首页：顶部站点名 + 布局/配色切换按钮；公告条；汇总（在线 x/y、本月总流量、实时上下行速率，以及 2 分钟速率迷你折线）；分组标签；卡片网格（每张卡片：国旗或国家代码、名称、系统/虚拟化、CPU / 内存 / 硬盘细进度条、上下行速率、累计流量、在线时长、到期/价格、public_remark）或紧凑表格。
- 详情页：返回按钮、节点信息、时间范围按钮、uPlot 图表（CPU、内存、网络速率、TCP/UDP/进程数、Ping 延迟和丢包）。
- 响应式：360px 宽时单列，宽屏时自适应列数。深色模式通过 `html.dark` 切换。
- 支持 `prefers-reduced-motion`。
