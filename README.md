# Monitor-DYS

紧凑信息型 [Monitor](https://github.com/monitor-probe/monitor) 状态主题，基于 **Svelte 5 (runes) + Vite + Tailwind CSS v4 + uPlot** 构建。

部分数据格式化与实时流逻辑参考并移植自官方默认主题 `monitor-theme-default`（MIT License, Copyright (c) 2026 stqfdyr）。

## 特性

- **紧凑高信息密度浅色风格**：浅灰底色（`#f6f8f7`）搭配顶部柔和主题色微光、`1px` 细边框、`10px` 圆角、表格数字等宽（`tabular-nums`），支持紧凑（宽屏每行 4–5 张）与标准（每行 3–4 张）两种卡片尺寸。
- **单主题色（Accent）**：默认 `#10b981`，支持后台配置任意合法 CSS 颜色（通过 `CSS.supports("color", v)` 校验），用于选中状态、进度条与图表主线；资源进度条 ≥80% 自动切换琥珀色提醒，≥90% 切换红色告警。
- **每日汇率自动折算与明细浮层**：
  - 支持将多币种节点（`CNY` / `USD` / `EUR` / `HKD` / `JPY` / `GBP` / `CAD` / `SGD`）的剩余价值按每日汇率统一折算至目标币种，悬停或点击「剩余价值」卡片可查看各币种原值小计与折算明细。
  - 汇率结果在 `localStorage` 中缓存 12 小时；单个节点卡片与详情页仍保持原币种显示。
- **真实轮廓点阵世界地图 + 国家列表筛选**：
  - 基于 Natural Earth 110m 边界在构建期生成 1.5° 等距圆柱投影点阵（`scripts/gen-map.mjs` → `src/lib/map-data.ts`），有节点的国家自动以主题色高亮（透明度随节点数加深）。
  - 国家中心点显示圆形数量徽章与国旗（重叠区域自动带引线避让），悬停展示国家名、在线/总数、合计上下行速率与节点列表；右侧/下方附带按节点数降序排列的紧凑国家列表，点击地图国家或列表行即可按国家筛选节点。
- **发行版与浏览器品牌图标**：按需 tree-shaking 引入 `simple-icons`（CC0），自动识别 Debian、Ubuntu、Rocky、AlmaLinux、CentOS、Fedora、Alpine、Arch、openSUSE、OpenWrt（含 iStoreOS / ImmortalWrt）、FreeBSD、macOS、Linux 以及 Chrome、Firefox、Safari、Opera、微信、QQ 浏览器等品牌图标。
- **增强详情页**：顶部前后节点切换器与下拉选择、4 张核心指标卡片、系统运行信息条、4 列并排 uPlot 资源趋势图（CPU、含总容量参考虚线的内存与磁盘、网络速率，标题右侧紧凑图例 + 跟随光标纯文本浮层，支持「显示峰值」切换）与 Ping 延迟/丢包图，以及底部「硬件与系统」「流量与费用」双栏详单。
- **底部访客气泡**：显示访客出口地区中文名与浏览器品牌图标，点击展开设备/系统、浏览器版本、出口 IP、城市、运营商（ISP/ASN）与访问时间。
- **未登录零后台入口**：仅在 `/api/me` 返回 `authed === true` 时显示右上角齿轮后台链接（`/admin`），匿名访客界面不展示任何登录或后台按钮。

## 隐私与外部请求说明

主题默认完全围绕同源 Hub 接口（`/api/*`）运行，仅在以下两项功能开启且站点配置（`/api/themes/dys/config`）加载完成后，才由访客浏览器发起只读公共 API 请求：

1. **汇率换算（`exchange_rate_enabled`，默认 `true`）**：
   - 开启且 `show_billing=true` 时，浏览器优先读取 `localStorage` 中的 `dys:rates:<BASE>` 缓存（有效期 12 小时）。
   - 缓存未命中或过期时，向 `https://open.er-api.com/v6/latest/<BASE>` 请求当日汇率（5 秒超时）；若失败则回退请求 `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/<base>.json`。
   - 将 `exchange_rate_enabled` 设为 `false` 后，**不会发出任何汇率请求**，总览仅累计与目标币种一致的节点。
2. **底部访客气泡（`visitor_info_enabled`，默认 `true`）**：
   - 开启时，浏览器向 `https://api.ip.sb/geoip` 请求出口 IP 与地理定位（5 秒超时）；若失败则回退请求 `https://ipwho.is/`，结果缓存至当前会话 `sessionStorage`。
   - 将 `visitor_info_enabled` 设为 `false` 后，**不会渲染气泡，也不会向 `api.ip.sb` 或 `ipwho.is` 发出任何请求**。
3. **点阵世界地图**：地图数据在构建期由 `npm run gen:map` 预生成并打包在 `src/lib/map-data.ts` 中，**运行时无任何外部地图或瓦片请求**。

## 安装方式

在 Monitor 管理面板中进入 **「主题 → 从 GitHub 安装」**，填入仓库地址：

```text
https://github.com/dingding229/Monitor-DYS
```

或者下载 Release 中的 `theme.tar.gz`，解压到 Hub 的 `--themes` 目录下 `dys/` 子目录。

## 更新

在管理面板 **「主题」** 页面中，找到已安装的 **DYS** 主题，点击 **「从 GitHub 更新」**（或重新填入 `https://github.com/dingding229/Monitor-DYS` 安装最新 Release），无需重启 Hub 即可生效。已保存的主题设置会保留。

## 主题设置（`theme.json`）

站长可在后台「主题 → 设置」中调整以下参数（未保存或旧版 Hub 不支持时自动使用默认值）：

| 键名 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `layout` | `select` | `"grid"` | 默认布局：`"grid"`（卡片）或 `"table"`（列表）；访客可在页面切换并保存在浏览器 `localStorage` |
| `card_size` | `select` | `"compact"` | 卡片尺寸：`"compact"`（紧凑）或 `"standard"`（标准） |
| `accent` | `string` | `"#10b981"` | 主题色（任意合法 CSS 颜色，无效值回退 `#10b981`） |
| `show_summary` | `boolean` | `true` | 显示首页六格总览卡片 |
| `show_map` | `boolean` | `true` | 显示首页点阵世界地图与国家列表 |
| `show_search` | `boolean` | `true` | 显示搜索框 |
| `show_sort` | `boolean` | `true` | 显示排序下拉选择 |
| `announcement` | `text` | `""` | 顶部公告（纯文本渲染，保留换行） |
| `show_billing` | `boolean` | `true` | 显示价格、到期与剩余价值 |
| `finance_currency` | `select` | `"CNY"` | 剩余价值汇总币种（`CNY` / `USD` / `EUR` / `HKD` / `JPY` / `GBP` / `CAD` / `SGD`） |
| `exchange_rate_enabled` | `boolean` | `true` | 启用每日汇率自动换算（关闭后只累计同币种节点，不发请求） |
| `expiry_warning_days` | `number` | `7` | 到期提醒天数（`1–365`） |
| `visitor_info_enabled` | `boolean` | `true` | 显示底部访客气泡（关闭后不向 `api.ip.sb` 或 `ipwho.is` 发任何请求） |
| `footer` | `string` | `""` | 页脚文字 / 备案号 |
| `footer_url` | `string` | `""` | 页脚链接（仅接受 `http/https` 地址，无效时仅显示文字） |
| `poll_interval` | `number` | `5` | WebSocket 不可用时降级轮询 `/api/nodes` 的间隔（`2–60` 秒） |

## 路由与反代 / WAF 白名单

本主题使用 HTML5 History 路由：

- `/`：节点总览首页
- `/node/{id}`：节点历史详情页（支持直接刷新与分享链接）

Hub 会将未知路径回退到主题的 `dist/index.html`（不会占用 `/admin`、`/api`、`/install.sh`、`/agent/*`）。
**注意**：如果 Hub 前方部署了按路径做正向白名单的反向代理、CDN 或 WAF，请务必放行以下路径，否则从首页点进详情页正常（`pushState`），直接刷新 `/node/{id}` 或加载图标时会被拦截：

- `/node/*`
- `/favicon.svg`
- `/apple-touch-icon.png`

## 本地开发

```bash
npm ci

# 连接任意开启公开状态页的真实 Hub 或本地 Mock Hub（默认 http://127.0.0.1:9911）
MONITOR_HUB=http://127.0.0.1:9911 npm run dev
```

### 常用命令

- `npm run dev`：启动 Vite 开发服务器（自动代理 `/api` 与 `/api/ws`）
- `npm run gen:map`：从 `world-atlas` (Natural Earth 110m) 重新生成 `src/lib/map-data.ts`
- `npm run check`：运行 `svelte-check` 与 TypeScript 类型检查
- `npm run build`：构建生产包至 `dist/`
- `npm test`：运行 Vitest 单元测试
- `npm run test:e2e`：运行 Playwright 端到端测试

## 发版

1. 确保 `theme.json`、`package.json`、`package-lock.json` 三者的 `version` 完全一致（例如 `1.2.0`）。
2. 本地执行完整检查、测试与打包验证：
   ```bash
   npm run check && npm test && npm run build && npm run test:e2e
   bash scripts/pack.sh && node scripts/verify-package.mjs
   ```
3. 推送与版本号一致的 Git 标签 `v<version>`（例如 `v1.2.0`）触发 `.github/workflows/release.yml`，自动构建、校验并发布包含 `theme.tar.gz` 与 `theme.tar.gz.sha256` 的正式版 GitHub Release。

## 许可

MIT
