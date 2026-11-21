# Monitor-DYS

极简卡片风格的 [Monitor](https://github.com/monitor-probe/monitor) 状态主题，基于 **Svelte 5 (runes) + Vite + Tailwind CSS v4 + uPlot** 构建。

部分数据格式化与实时流逻辑参考并移植自官方默认主题 `monitor-theme-default`（MIT License, Copyright (c) 2026 stqfdyr）。

## 特性

- **极简卡片视觉**：浅色为主、大量留白、`1px` 细边框、`12px` 圆角、无渐变、表格数字等宽（`tabular-nums`）。
- **单主题色（Accent）**：支持后台配置任意合法 CSS 颜色（通过 `CSS.supports("color", v)` 校验），用于选中状态、进度条与图表主线。
- **双视图与深色模式**：支持卡片网格（Grid）与紧凑列表（Table）切换；支持跟随系统 / 浅色 / 深色模式切换（通过 `html.dark` 切换），访客偏好保存在 `localStorage`。
- **轻量高性能图表**：使用 `uPlot` 渲染节点详情历史图表（CPU、内存/Swap、网络上下行速率、TCP/UDP/进程数、多探测点 Ping 延迟与丢包），包体 gzip 后远小于 120KB。
- **实时与降级容错**：WebSocket（支持 `?gzip` `DecompressionStream` 流式解压、顺序帧解码链、连接陈旧检测）+ 断线退避重连 + HTTP 轮询降级 + 页面可见性（`visibilitychange`）生命周期管理。
- **旧版 Hub 兼容**：自动兼容缺失 `group`、`public_remark`、`history_days`、`expires_in`、`last_seen_ago`、`cpu_max`、`net_*_max`、`swap`、`tcp/udp/procs` 等字段的旧版 Hub。

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
