# DYS v2.0（设计 v3 / A5 定稿）实现规格

定稿设计：`docs/design/v3/a5/`（`prototype.html` + 截图）。本文件优先于 SPEC-v2.0 的视觉部分；性能目标、分工和 testid 规则沿用 SPEC-v2.0。

## 1. 已确定的设计决定
- **只有浅色**。删除深色模式（`color_scheme` 配置、`data-scheme`、`dys:scheme`、深色 CSS）。
- **6 套主题色预设**，只能在后台设置：theme.json 新键 `theme`（`emerald` 默认 / `ocean` / `indigo` / `amber` / `rose` / `slate`），替代旧的 `accent` 自由填色（旧键忽略）。色值见 `docs/design/v3/a3/README.md`。状态色固定：在线 `#16a34a`（点/条 `#22c55e`）、警告 `#d97706`（条 `#f59e0b`）、危险 `#dc2626`（条 `#ef4444`）、离线 `#64748b`。
- 卡片统一外观，无左侧色条，无按状态变色的边框/底色；离线卡片降低不透明度；同行卡片等高。
- 标签全部中文；数字用等宽字体。

## 2. 前后端接口约定（两边按这个名字并行开发）
后端（`src/lib/**`）提供，Antigravity（`.svelte`）使用：

### 2.1 主题
- `config.theme: ThemeKey`（`resolveTheme(v: unknown): ThemeKey`，非法回退 `emerald`）。
- `app-state` 把它写到 `document.documentElement.dataset.theme`，并缓存到 `localStorage['dys:theme']`。`index.html` 的首帧内联脚本读取它并设置 `data-theme`（脚本由 Antigravity 写）。
- 每套主题的 CSS 变量（`--accent`、`--accent-strong`、`--accent-soft`、`--accent-text`）由 Antigravity 在 `app.css` 中按 `html[data-theme="…"]` 定义。uPlot 颜色从 CSS 变量读取。

### 2.2 趋势历史（新文件 `src/lib/history.svelte.ts`）
- `createHistory(readNodes: () => readonly Node[])`：每收到一帧节点数据（WS 或轮询）采样一次。
  - `fleet`：`$state.raw` 对象 `{ tx: number[]; rx: number[]; cpu: number[] }`，各最多 60 个点（总上行速率、总下行速率、在线节点平均 CPU%）。每帧替换为新对象。
  - `load(id: number): readonly number[]`：该节点最近 ≤30 个 `load1` 值。内部用定长环形缓冲（`Float32Array`），节点消失时清理。为了让卡片响应式更新，暴露 `version`（每帧 +1 的 `$state`），卡片在模板里读 `history.version` 后调用 `load(id)`。
- 通过 `app.history` 暴露。首页打开前没有历史，数组可能为空：组件要处理 0–1 个点的情况（显示平线或「—」）。

### 2.3 首页汇总扩展（`home-view.svelte.ts` 的 `summary`）
在现有字段基础上增加：
- `warn`：在线且满足任一条件的节点数：CPU、内存或硬盘 ≥ 90%，或 ping 平均丢包 ≥ 5%，或平均延迟 ≥ 200ms（ping 数据来自 ping store，没有数据不算）。
- `expired`：`expires_in <= 0` 的节点数；`expiring`：`0 < expires_in <= expiry_warning_days` 的节点数。
- `cores`：在线节点 CPU 核数之和（没有字段时为 null）。
- `peakCpu`：`{ id, name, value } | null`（在线节点中 CPU 最高者）。
- `uptimeRatio`：在线数 / 总数（0–1）。
- `statusStrip`：每个节点一个状态 `'online' | 'warn' | 'offline'`，按当前排序顺序，用于「服务器状态」色块条（超过 40 个节点时组件自行按比例合并显示）。

### 2.4 地区聚合扩展（`createCountryView` 的 `aggregate`）
- 每个国家：`{ code, online, total, tx, rx, latency: number | null, warn: boolean }`（`latency` 为该国在线节点 ping 平均延迟；`warn` 为存在告警或离线节点）。
- 汇总 `totals`：`{ regions, onlineRate, avgLatency: number | null }`。
- 节流规则不变（3 秒，悬停时暂停）。

## 3. 性能与体积（不变，必须达标）
入口 ≤ 42KB、首屏 ≤ 60KB、详情 ≤ 30KB（gzip），CSS 不超过 v1.6 基线 6,952 字节 +10%（≤ 7,650），500 节点 60 秒后堆 ≤ 9.25MiB，单卡后代元素 ≤ 90，首卡 ≤ 126ms，无 ≥50ms 长任务。地图 SVG 路径只渲染一份；脉冲动画只用 transform/opacity。

## 4. testid
保留 SPEC-v2.0 附录中的全部 testid（`world-map`、`country-list`、`country-row`、`map-country` 等）。新增：`status-strip`（服务器状态色块条）、`load-spark`（卡片负载小折线）、`fleet-spark`（总览趋势线）、`region-summary`（地区汇总条）。

## 5. v2.0.1 变更：自定义主题色（替代 §2.1 的 6 套预设）
用户反馈：预设颜色偏深，且刷新时会先显示默认色。改为：
- theme.json：`theme`（select）替换为 `accent_color`（string，默认 `#10b981`）。旧键 `theme`、`accent`、`color_scheme` 全部忽略。
- **`src/lib/theme.ts`（后端）**：
  - `resolveAccent(v: unknown): string`：接受 `#rgb` / `#rrggbb`（可带空白，大小写不限），归一为小写 `#rrggbb`；其他值回退 `#10b981`。
  - `accentPalette(hex: string): AccentPalette`，`AccentPalette = { accent, strong, soft, border, text }`，全部为 `#rrggbb`：
    - `accent` = 输入色（指标条、折线、地图着色）；
    - `strong` = 输入色逐步加深，直到与白色对比度 ≥ 4.5（按钮底色、选中态，白字在上）；输入色本身已满足就用输入色；
    - `text` = 与 `soft` 对比度 ≥ 4.5 的深色版本（可与 `strong` 相同）；
    - `soft` = 输入色 8% 混白；`border` = 输入色 35% 混白。
  - `applyAccent(p: AccentPalette)`：在 `document.documentElement.style` 上设置 `--accent`、`--accent-strong`、`--accent-soft`、`--accent-border`、`--accent-text`，并把 `JSON.stringify(p)` 缓存到 `localStorage['dys:accent']`。
- `config.accent_color: string`（已归一）。`app-state` 在配置加载后调用 `applyAccent(accentPalette(config.accent_color))`。删除 `ThemeKey`、`resolveTheme`、`data-theme`、`dys:theme`。
- **首帧不闪色**：`index.html` 内联脚本读取 `dys:accent`，五个值都匹配 `^#[0-9a-f]{6}$` 时写入 html 的 style；`main.ts` 在**没有有效缓存**时等配置返回后再 `mount`（最多等 1500ms，超时用默认色挂载），有缓存时立即挂载。
- `app.css`：`:root` 的默认变量等于 `accentPalette("#10b981")` 的结果；删除 6 个 `html[data-theme]` 块。uPlot 和其他读 CSS 变量的组件改为监听 html 的 `style` 属性变化。
