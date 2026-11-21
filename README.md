# Monitor-DYS

紧凑信息型 [Monitor](https://github.com/monitor-probe/monitor) 状态主题，基于 **Svelte 5 (runes) + Vite + Tailwind CSS v4 + uPlot** 构建。

部分数据格式化与实时流逻辑参考并移植自官方默认主题 `monitor-theme-default`（MIT License, Copyright (c) 2026 stqfdyr）。

## 特性

- **紧凑高信息密度浅色风格**：浅灰底色（`#f6f8f7`）搭配顶部柔和主题色微光、`1px` 细边框、`10px` 圆角、表格数字等宽（`tabular-nums`），支持紧凑（宽屏每行 4–5 张）与标准（每行 3–4 张）两种卡片尺寸。
- **单主题色（Accent）**：默认 `#10b981`，支持后台配置任意合法 CSS 颜色（通过 `CSS.supports("color", v)` 校验），用于选中状态、进度条与图表主线；资源进度条 ≥80% 自动切换琥珀色提醒，≥90% 切换红色告警。
- **六格总览卡片 + 本地 SVG 点阵世界地图**：
  - 左侧 3×2 统计卡片：内存用量、剩余价值（按目标币种汇总并统计未计入节点数）、实时上行、硬盘用量、累计流量（当期上下行合计，悬停查看历史总计）、实时下行。
  - 右侧纯本地点阵世界地图：按国家中心点放置国旗与状态标记，悬停显示「国家 · 在线 x/y」，无 WebGL、无外部请求。
- **工具条与双视图**：分组标签（带数量徽章）、卡片/列表视图切换、多维排序（默认顺序 / 名称 / CPU / 内存 / 硬盘 / 上行 / 下行 / 到期，保存在 `localStorage`）、即时搜索框（匹配名称、地区、系统、公开备注）。
- **增强详情页**：顶部前后节点切换器与下拉选择、4 张核心指标卡片、系统运行信息条、4 列并排 uPlot 资源趋势图（CPU、含总容量参考虚线的内存与磁盘、网络速率，支持「显示峰值」切换）与 Ping 延迟/丢包图，以及底部「硬件与系统」「流量与费用」双栏详单。
- **底部访客气泡**：显示访客出口国家/城市与浏览器信息，点击展开设备/系统、浏览器版本、出口 IP、运营商（ISP/ASN）与访问时间；仅向 `api.ip.sb`（失败回退 `ipwho.is`）请求一次并缓存至 `sessionStorage`，后台关闭时不发任何外部请求。
- **未登录零后台入口**：仅在 `/api/me` 返回 `authed === true` 时显示右上角齿轮后台链接（`/admin`），匿名访客界面不展示任何登录或后台按钮。

## 主题设置（`theme.json`）

| 键名 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `layout` | `select` | `"grid"` | 默认布局：`"grid"`（卡片）或 `"table"`（列表） |
| `card_size` | `select` | `"compact"` | 卡片尺寸：`"compact"`（紧凑）或 `"standard"`（标准） |
| `accent` | `string` | `"#10b981"` | 主题色（任意合法 CSS 颜色） |
| `show_summary` | `boolean` | `true` | 显示首页六格总览卡片 |
| `show_map` | `boolean` | `true` | 显示首页点阵世界地图 |
| `show_search` | `boolean` | `true` | 显示搜索框 |
| `show_sort` | `boolean` | `true` | 显示排序下拉选择 |
| `announcement` | `text` | `""` | 顶部公告（纯文本渲染，保留换行） |
| `show_billing` | `boolean` | `true` | 显示价格、到期与剩余价值 |
| `finance_currency` | `select` | `"CNY"` | 剩余价值汇总币种（`CNY` / `USD` / `EUR` / `HKD` / `JPY`） |
| `expiry_warning_days` | `number` | `7` | 到期提醒天数（`1–365`） |
| `visitor_info_enabled` | `boolean` | `true` | 显示底部访客气泡（关闭后不发任何定位请求） |
| `footer` | `string` | `""` | 页脚文字 / 备案号 |
| `footer_url` | `string` | `""` | 页脚链接（仅接受 `http/https` 地址） |
| `poll_interval` | `number` | `5` | WebSocket 不可用时降级轮询 `/api/nodes` 的间隔（`2–60` 秒） |

## 安装方式

在 Monitor 管理面板中进入 **「主题 → 从 GitHub 安装」**，填入仓库地址：

```text
https://github.com/dingding229/Monitor-DYS
```

或者下载 Release 中的 `theme.tar.gz`，解压到 Hub 的 `--themes` 目录下 `dys/` 子目录。

## 本地开发

```bash
npm ci

# 连接任意开启公开状态页的真实 Hub 或本地 Mock Hub（默认 http://127.0.0.1:9911）
MONITOR_HUB=http://127.0.0.1:9911 npm run dev
```

### 常用命令

- `npm run dev`：启动 Vite 开发服务器（自动代理 `/api` 与 `/api/ws`）
- `npm run check`：运行 `svelte-check` 与 TypeScript 类型检查
- `npm run build`：构建生产包至 `dist/`
- `npm test`：运行 Vitest 单元测试
- `npm run test:e2e`：运行 Playwright 端到端测试

## 许可

MIT
