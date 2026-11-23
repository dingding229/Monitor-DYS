# DYS v2.0 设计系统与组件规格（Design Tokens & Component Specs）

> 适用范围：Monitor 状态页主题 DYS v2.0（Svelte 5 + Tailwind v4 + uPlot）。
> 核心原则：**扁平（Flat）· 紧凑（Compact）· 现代（Modern）· 轻量（Minimal DOM）**。
> 禁止阴影（`box-shadow`）、装饰性渐变（`linear-gradient`）、毛玻璃（`backdrop-filter`）与悬停位移（`translateY`）。所有层级仅通过 1px 边框与背景阶梯区分，悬停只改变边框或背景颜色。

---

## 1. 颜色 Token（浅色 + 深色）

所有颜色均通过 CSS 自定义属性定义于 `:root` 与 `[data-theme="dark"]`（实现时同步配合 `@media (prefers-color-scheme: dark)` 与 `index.html` 内联关键 CSS，防止首屏闪烁）。
所有正文与辅助文本对比度均满足 **WCAG 2.1 AA（≥ 4.5:1）**。

### 1.1 基础表面、边框与文字（3 级）

| Token | 用途 | Light（浅色） | Dark（深色） | 对比度说明 |
|---|---|---|---|---|
| `--bg` | 页面画布底色 | `#f4f6f8` | `#0b0f14` | 与 `--surface` 形成清晰扁平层级 |
| `--surface` | 卡片 / 面板 / 顶栏底色 | `#ffffff` | `#11161d` | 主内容承载面 |
| `--surface-subtle` | 表头 / 规格底块 / 次级徽章 | `#f8fafc` | `#161d26` | 内部次级区块 |
| `--surface-hover` | 行悬停 / 按钮悬停底色 | `#f1f5f9` | `#1b2430` | 扁平交互反馈 |
| `--border` | 主边框（面板、控件、顶栏底边） | `#e2e8f0` | `#222c38` | 1px solid |
| `--border-strong` | 悬停边框 / 强调分隔 | `#cbd5e1` | `#334155` | 卡片/控件 hover |
| `--border-subtle` | 卡片内部分隔线 / 表格行线 | `#eef2f6` | `#1b232e` | 弱化内部结构线 |
| `--fg` | 一级文字（节点名、主数值、标题） | `#0f172a` | `#f1f5f9` | Light 17.8:1 / Dark 16.5:1 |
| `--fg-muted` | 二级文字（标签、次要数值、正文） | `#475569` | `#94a3b8` | Light 7.6:1 / Dark 7.1:1 |
| `--fg-subtle` | 三级文字（单位、辅助说明、脚注） | `#64748b` | `#7b8ba1` | Light 4.76:1 / Dark 5.2:1（均 ≥ AA） |

### 1.2 主题色 Accent（仅用于交互与图表主线）

默认 `--accent: #10b981`（由 `theme.json` 配置覆盖，派生色使用 `color-mix` 自动适配任意自定义 accent）：

| Token | 用途 | Light（浅色） | Dark（深色） |
|---|---|---|---|
| `--accent` | 进度条正常态、图表主线、勾选状态 | `#10b981` | `#10b981` |
| `--accent-solid` | 实心主按钮 / 选中标签底色 | `color-mix(in srgb, var(--accent) 68%, #042f23)`（默认 `#0b7e5c`） | `color-mix(in srgb, var(--accent) 72%, #042f23)`（默认 `#0b8560`） |
| `--accent-solid-fg` | 实心主按钮 / 选中标签文字 | `#ffffff`（对比度 ≥ 5.0:1） | `#ffffff`（对比度 ≥ 4.7:1） |
| `--accent-soft` | 选中态浅底（探针胶囊、公告左条辅助） | `color-mix(in srgb, var(--accent) 10%, var(--surface))` | `color-mix(in srgb, var(--accent) 14%, var(--surface))` |
| `--accent-border` | 选中态边框 | `color-mix(in srgb, var(--accent) 40%, var(--border))` | `color-mix(in srgb, var(--accent) 45%, var(--border))` |
| `--accent-text` | 文本链接 / 强调标签文字 | `color-mix(in srgb, var(--accent) 70%, #052e16)`（默认 `#047857`） | `color-mix(in srgb, var(--accent) 82%, #ffffff)`（默认 `#34d399`） |

### 1.3 状态色与网络方向色（状态色仅用于状态）

| Token | 用途 | Light（浅色） | Dark（深色） |
|---|---|---|---|
| `--online` | 在线状态点 / 正常 ping 小条 | `#10b981` | `#34d399` |
| `--online-fg` | 在线胶囊文字 | `#047857` | `#34d399` |
| `--online-soft` | 在线胶囊底色 / 0 丢包胶囊底色 | `#ecfdf5` | `#0d2922` |
| `--offline` | 离线状态点 / 无数据占位条 | `#94a3b8` | `#475569` |
| `--warn` | 警告进度条（80–89%）/ 中等延迟 | `#d97706` | `#f59e0b` |
| `--warn-fg` | 即将到期 / 警告文字 | `#b45309` | `#fbbf24` |
| `--warn-soft` | 警告提示底色 | `#fffbeb` | `#2a1f0b` |
| `--danger` | 危险进度条（≥90%）/ 高延迟 / 丢包 | `#dc2626` | `#ef4444` |
| `--danger-fg` | 已到期 / 错误文字 | `#b91c1c` | `#f87171` |
| `--danger-soft` | 错误提示底色 | `#fef2f2` | `#2c1215` |
| `--tx` | 实时上行速率（↑） | `#047857` | `#34d399` |
| `--rx` | 实时下行速率（↓） | `#0369a1` | `#38bdf8` |
| `--bar-track` | 进度条与 ping 柱空轨道底色 | `#e2e8f0` | `#1e293b` |
| `--skeleton` | 骨架屏静态占位块 | `#e2e8f0` | `#1e293b` |

### 1.4 图表 6 色（Chart Palette）

用于 uPlot 多探针延迟、丢包率、网络上下行与 TCP/UDP/进程曲线：

| Token | 角色 | Light（浅色） | Dark（深色） |
|---|---|---|---|
| `--chart-1` | 主系列（默认 accent） | `var(--accent)`（`#10b981`） | `var(--accent)`（`#10b981`） |
| `--chart-2` | 系列 2（蓝，下行/探针2） | `#2563eb` | `#60a5fa` |
| `--chart-3` | 系列 3（琥珀，磁盘/探针3） | `#d97706` | `#fbbf24` |
| `--chart-4` | 系列 4（紫，探针4） | `#7c3aed` | `#a78bfa` |
| `--chart-5` | 系列 5（品红，探针5） | `#db2777` | `#f472b6` |
| `--chart-6` | 系列 6（青，探针6） | `#0891b2` | `#22d3ee` |
| `--chart-grid` | 图表网格线（1px） | `#eef2f6` | `#1e293b` |
| `--chart-axis` | 坐标轴刻度文字 | `#64748b` | `#7b8ba1` |

---

## 2. 字体、字号阶梯、间距、圆角与焦点环

### 2.1 字体栈（不加载任何网络字体）
- `--font-sans`: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif`
- `--font-num`: 数值统一应用 `font-variant-numeric: tabular-nums;`（`.tnum`）以防实时刷新跳动。

### 2.2 字号阶梯
| Token | 字号 | 行高 | 字重 | 用途 |
|---|---|---|---|---|
| `--text-2xs` | `11px` | `1.35` | `400 / 500` | 指标脚注（负载/已用总量）、单位后缀、总览格备注、徽章数字 |
| `--text-xs` | `12px` | `1.4` | `400 / 500` | 辅助标签、工具栏控件、表格单元格、公告、页脚、ping 数值 |
| `--text-sm` | `13px` | `1.45` | `400 / 600 / 700` | 全局正文、节点卡片名称（700）、卡片主百分比与速率（600） |
| `--text-md` | `15px` | `1.35` | `700` | 顶栏站点名、详情页区块标题 |
| `--text-lg` | `18px` | `1.3` | `700` | 详情页节点主标题 |
| `--text-xl` | `24px` | `1.15` | `700` | 总览格主数值、详情页 KPI 主数值（`letter-spacing: -0.03em`） |

### 2.3 间距（4px 网格）
- `--sp-1`: `4px`（紧邻元素、进度条上下距）
- `--sp-2`: `8px`（紧凑区块内元素间距、按钮组间距）
- `--sp-3`: `12px`（**默认卡片内边距**、栅格间距 `gap: 12px`、主区块垂直间距）
- `--sp-4`: `16px`（页面左右边距 `px-4`、页脚上下留白）
- `--sp-6`: `24px`（空状态 / 登录卡片内边距）

### 2.4 圆角（严格 3 档）
- `--radius-panel`: `8px`（顶栏内容器除外、总览格、地图卡、节点卡片、图表卡、表格容器、详情面板）
- `--radius-control`: `6px`（按钮、标签、下拉框、搜索框、详情页规格底块）
- `--radius-pill`: `999px`（状态点、连接状态胶囊、数量徽章、探针胶囊、进度条、访客气泡）

### 2.5 焦点环与动效
- `--focus-ring`: `var(--accent-solid)`（浅色） / `var(--accent)`（深色）
- 规则：`:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }`
- 过渡：仅允许 `border-color`、`background-color`、`color` 的 `120ms ease`；`@media (prefers-reduced-motion: reduce)` 下全局置为 `0.01ms`。
- 图标规范：全部内联 SVG，`viewBox="0 0 16 16"`，`stroke="currentColor"`，`stroke-width="1.5"`，`stroke-linecap="round"`，`stroke-linejoin="round"`，`fill="none"`。

---

## 3. 组件规格

### 3.1 顶栏（Header）
- `position: sticky; top: 0; z-index: 20`，高度 `48px`，底色 `--surface`，底部 `1px solid var(--border)`。
- 内容容器 `max-width: 1440px; padding: 0 16px`，左右两端对齐。
- 左侧：站点图标（`20×20px`）+ 站点名称（`15px` bold，`--fg`），点击返回首页。
- 右侧：连接状态胶囊（`data-testid="conn-status"`，`height: 28px`，`border-radius: 999px`，`1px solid var(--border)`，`8px` 状态点 + `12px` 文本）+ 后台入口（`data-testid="admin-link"`，仅登录可见，`height: 28px`，`border-radius: 6px`，16px 齿轮图标 + 移动端隐藏的「后台」文字）。

### 3.2 公告（Announcement）
- `data-testid="announcement"`，面板样式（`--surface` + `1px solid var(--border)` + `radius 8px`），左侧 `3px solid var(--accent)` 扁平强调线，内边距 `10px 12px`，`12px` `--fg-muted`。

### 3.3 总览格（Summary 6 格）
- `data-testid="summary"`；桌面（≥900px）与地图 50/50 并排（`grid-template-columns: 1fr 1fr; gap: 12px`）；单开总览时全宽。
- 内部 3×2 网格（`grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px`；移动端 `<640px` `gap: 8px`）。
- 单格（`data-testid="summary-tile"`）：`padding: 12px`，`radius 8px`，`1px solid var(--border)`，`--surface`。
  - 顶行：标签（`12px` `--fg-muted` font-weight 500）+ 右侧 16px 线性图标（`--fg-subtle`，移动端隐藏）。
  - 中行：主数值（`24px` bold `.tnum` `--fg`，移动端 `18px`）+ 单位（`12px` `--fg-subtle`）。
  - 底行：单行备注（`11px` `.tnum` `--fg-subtle`，`overflow: hidden; text-overflow: ellipsis; white-space: nowrap`）。

### 3.4 地图卡（WorldMap）
- 面板容器（`data-testid="world-map"`），`padding: 12px`，`radius 8px`，`1px solid var(--border)`，`--surface`。
- 顶栏：左侧在线计数胶囊（`● 25 在线`，`--online-soft` 底色 + `--online-fg` 文字），右侧地区数标签（`8 个国家和地区`，`--surface-subtle` + `--fg-muted`）。
- 内容区：左侧世界地图（SVG，节点标记使用 `--accent` / `--fg` 扁平圆点）+ 右侧国家列表（`data-testid="country-list"`，每行 `data-testid="country-row"`：国旗 + 地区名 + 在线/总数 + ↑/↓ 速率，点击筛选地区，悬停 `--surface-hover`）。

### 3.5 工具栏（Toolbar）、分组标签（Group Tabs）与搜索框（Search）
- Flex 布局，`justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap`。
- **分组标签**（`role="tablist"`，每项 `data-testid="group-tab"`）：
  - `height: 30px`，`padding: 0 10px`，`radius 6px`，`12px` medium，水平可滚动不折行。
  - 默认态：`--surface` + `1px solid var(--border)` + `--fg-muted`；数量徽章：`--surface-subtle` + `--fg-subtle` + `radius 999px` + `11px .tnum`。
  - 选中态（`aria-selected="true"`）：`--accent-solid` 底色 + `transparent` 边框 + `--accent-solid-fg` 文字；数量徽章：`rgba(255,255,255,0.2)` 底色 + `#ffffff` 文字。
- **地区筛选胶囊**（`data-testid="country-filter-chip"`）：选中地区时紧跟分组标签后，显示 `地区：香港 ×`，`--accent-soft` 底色 + `--accent-border` 边框 + `--accent-text` 文字，`radius 999px`。
- **右侧控件组**（`gap: 8px`）：
  - 视图切换（卡片/列表）：Segmented 容器（`height: 30px`，`padding: 2px`，`radius 6px`，`1px solid var(--border)`，`--surface`），选中项底色 `--surface-hover`，文字 `--fg` font-weight 600。
  - 排序下拉（`data-testid="sort-select"`）：`height: 30px`，`padding: 0 8px`，`radius 6px`，`1px solid var(--border)`，`--surface`，`12px` `--fg`。
  - 搜索框（`data-testid="search-input"`）：`height: 30px`，宽度 `180px`（`sm: 208px`，移动端 `flex: 1`），左侧 14px 搜索图标，`padding: 0 10px 0 28px`，`radius 6px`，`1px solid var(--border)`，`--surface`，`placeholder` 用 `--fg-subtle`。

### 3.6 节点卡片（NodeCard）与 DOM 骨架（≤ 70 元素）

- 网格：`grid-template-columns: repeat(auto-fill, minmax(min(100%, 236px), 1fr)); gap: 12px; align-items: start;`（1440px 容器宽 1408px 时精确排布 **5 列 × 272px**）。
- 卡片样式：`padding: 12px`，`radius 8px`，`1px solid var(--border)`，`--surface`，`white-space: nowrap`，悬停仅变 `border-color: var(--border-strong)`。
- **所有文本单行不折行**（`overflow: hidden; text-overflow: ellipsis; white-space: nowrap`）。
- 状态点使用 `.nc-name::before` 伪元素实现，进度条使用单元素 `<i class="nc-bar" style="--v:42%"></i>` + `::before` 伪元素实现，大幅削减 DOM 数量。
- 阈值色：`<80%` 用 `--accent`，`80%–89.9%` 用 `--warn`，`≥90%` 用 `--danger`；离线节点指标区 `opacity: 0.55`。

#### 节点卡片 DOM 骨架与元素计数

```html
<!-- 根容器: 1 -->
<a class="nc" data-testid="node-card" data-status="online" href="/node/1">
  <!-- 1. 标题行 (5): div + h3(::before 状态点) + svg + path + span.nc-flag -->
  <div class="nc-head">
    <h3 class="nc-name" title="PortChannel Zero 上海">PortChannel Zero 上海</h3>
    <svg class="nc-os" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="..." /></svg>
    <span class="nc-flag" aria-label="中国">🇨🇳</span>
  </div>

  <!-- 2. 在线/离线时长 (1) -->
  <div class="nc-sub tnum">在线 98 天</div>

  <!-- 3. 2×2 指标区 (1 + 4×5 = 21): 每项仅 5 个元素，进度条为单元素 + --v 变量 -->
  <div class="nc-metrics">
    <div class="nc-m">
      <span class="nc-ml">CPU</span>
      <b class="nc-mv tnum">12.4%</b>
      <i class="nc-bar" style="--v:12.4%"></i>
      <small class="nc-ms tnum">0.12, 0.08, 0.05</small>
    </div>
    <!-- 内存 / 硬盘 / 本期流量（或 Swap）同构，共 4 项 -->
  </div>

  <!-- 4. 底部三列信息 (1 + 9 = 10): 3 列 CSS Grid，省去 3 个列包裹 div -->
  <div class="nc-foot">
    <span class="nc-fl">实时速率</span><span class="nc-fl">当期流量</span><span class="nc-fl">到期</span>
    <b class="nc-fv tnum tx">↑ 180KB/s</b><b class="nc-fv tnum">↑ 11.4 GB</b><b class="nc-fv tnum">剩余 80 天</b>
    <b class="nc-fv tnum rx">↓ 180KB/s</b><b class="nc-fv tnum">↓ 11.4 GB</b><b class="nc-fv tnum muted">¥1,188/年</b>
  </div>

  <!-- 5. Ping 区块 (1 + 6 + 24 = 31): 仅在线且开启 ping 时渲染 -->
  <div class="nc-ping" data-testid="node-ping">
    <span class="nc-pl">延迟 ms</span><b class="nc-pv tnum">23·25·29</b>
    <span class="nc-pl nc-pr">丢包 %</span><b class="nc-pv tnum">0·0·0</b>
    <div class="nc-pbars" data-testid="ping-bars" aria-hidden="true"><i></i><!-- ×12 --></div>
    <div class="nc-pbars nc-pr" data-testid="ping-bars" aria-hidden="true"><i></i><!-- ×12 --></div>
  </div>
</a>
```

**单卡元素统计**：
- 含 Ping 区块的完整在线卡：`1 + 5 + 1 + 21 + 10 + 31 = 69` 个元素（**≤ 70 目标达标**）。
- 离线 / 不显示 Ping 的卡片：`1 + 5 + 1 + 21 + 10 = 38` 个元素。

### 3.7 列表行（NodeTable / NodeRow）
- 外层面板容器 `overflow-x: auto`，表格 `12px`，表头底色 `--surface-subtle`，文字 `--fg-muted` font-weight 500，底部 `1px solid var(--border)`。
- 数据行（`data-testid="node-row"`）：高度 `44px`，行间 `1px solid var(--border-subtle)`，悬停底色 `--surface-hover`，全部 `white-space: nowrap`。
- CPU / 内存 / 硬盘列内嵌 `56px × 4px` 单元素进度条（`.nc-bar`）。延迟/丢包按阈值着色（正常 `--fg`、警告 `--warn-fg`、危险 `--danger-fg`）。

### 3.8 详情页名称卡片（NodeDetail Identity Card）
- 顶行导航：左侧 `← 返回列表` 按钮（`height: 30px`，`radius 6px`），右侧 `data-testid="node-switcher"`（`全部节点 · 8 台` + `‹` + 节点下拉选择 + `›`）。
- 名称卡片：面板容器 `padding: 14px 16px`，桌面（≥900px）左右两栏（`1fr auto`）。
  - 左侧：国旗 + 节点名（`18px` bold `--fg`）+ 状态胶囊（`● 在线` 或 `● 离线 · 3 小时`），下行副文本（`地区 · 分组 · 最近上报 N 秒前`，`12px` `--fg-subtle`）。
  - 右侧（`data-testid="detail-stats"`）：水平紧凑键值组（负载 1/5/15m、Swap、进程、TCP / UDP、系统运行），标签 `--fg-subtle`，数值 `--fg` font-weight 600 `.tnum`。
- 下接 4 列实时 KPI 卡片（CPU / 内存 / 硬盘 / 网络速率），单元素进度条。

### 3.9 时间范围按钮与图表卡片（ChartCard）
- 趋势工具栏：左侧标题（`14px` bold）+ 副标题（`历史平均值 · 更新于 HH:MM:SS`，`11px` `--fg-subtle`）；右侧时间范围按钮组（`data-testid="range-btn"`，`height: 28px`，`radius 6px`，选中态 `--accent-solid` + 白字，移动端高度 `36px`）+ `显示峰值` 复选框 + `刷新` 按钮。
- 图表卡片（`data-testid="chart"`）：面板容器 `padding: 12px`，顶行左标题（`13px` bold `--fg`）+ 当前值副标题（`12px .tnum --fg-muted`），右图例项（8px 圆点 + 标签）；主体为图表画布（网格线 `--chart-grid`，刻度 `--chart-axis`，折线 `1.5px` 实线，无阴影无渐变填充）。

### 3.10 探针胶囊（Probe Chips）
- 位于 Ping 延迟卡片标题与画布之间，`display: flex; flex-wrap: wrap; gap: 6px; align-items: center`。
- 单个胶囊（`data-testid="probe-chip"`）：`height: 26px`，`padding: 0 10px`，`radius 999px`，`12px`，内置 `7px` 探针色点 + 探针名 + `.tnum` 均延迟（如 `69ms`）。
  - 未选中态：`--surface-subtle` 底色 + `1px solid var(--border)` + `--fg-subtle` 文字，圆点 `--offline`。
  - 选中态（`aria-pressed="true"`）：`color-mix(in srgb, var(--probe) 10%, var(--surface))` 底色 + `color-mix(in srgb, var(--probe) 45%, var(--border))` 边框 + `--fg` 文字，圆点 `var(--probe)`。
- 「全部」重置按钮（`data-testid="probe-all"`）：`12px` `--fg-muted` 下划线，全选时 `disabled`（`--fg-subtle` 无下划线）。
- 零丢包徽章（`data-testid="no-loss"`）：`--online-soft` 底色 + `--online-fg` 文字，`radius 999px`，`11px` medium。

### 3.11 访客气泡（VisitorBubble & VisitorPanel）
- 气泡（`data-testid="visitor-bubble"`）：底部居中悬浮（接近页脚时停靠页脚中栏），`height: 30px`，`padding: 0 12px`，`radius 999px`，`--surface` + `1px solid var(--border)`，`12px` `--fg-muted`，显示 `国旗 地区 | 浏览器图标 浏览器 ×`。
- 展开面板（`data-testid="visitor-panel"`）：宽 `280px`，位于气泡上方 `6px`，`radius 8px`，`--surface` + `1px solid var(--border)`，`padding: 12px`，键值列表展示设备/系统、浏览器版本、出口 IP、地区/城市、运营商、访问时间。

### 3.12 空状态（Empty State）与骨架屏（Skeleton）
- **空状态**（`data-testid="empty-state"`）：面板容器，`padding: 40px 16px`，居中排布：28px 线性搜索图标（`--fg-subtle`）+ 标题「没有匹配的节点」（`14px` bold `--fg`）+ 简短提示（`12px` `--fg-subtle`）+ 主按钮「清除筛选」（`--accent-solid` + 白字，`radius 6px`，`height: 32px`）。
- **骨架屏**（`data-testid="skeleton"`）：纯扁平静态色块（`--skeleton`，`radius 4px`，无闪烁渐变动画以节省 CPU），模拟总览格数值条与节点卡片的标题行 + 2×2 指标条 + 底部三列，保持与真实卡片一致的占位高度（`min-height: 236px`）防止布局偏移（CLS = 0）。
