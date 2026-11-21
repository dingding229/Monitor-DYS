# T20 · UI v1.4（UI 会话）

完整阅读 `docs/SPEC-v1.4.md`，实现第 1–7、9、10 节，以及第 4 节的 `src/lib/ping.svelte.ts`。用户截图在 `docs/design/feedback-v1.4/`。

## 文件归属
- 你负责：`src/**`、`index.html`、`vite.config.ts`、`scripts/check-size.mjs`（只在预算检查需要时改）、`README.md`（同步设置表：新增 show_ping，说明去掉毛玻璃）。
- 不要改：`tests/**`、`playwright.config.ts`、`.github/**`、`theme.json`（`show_ping` 已由规划者加好）。测试会话正在并行精简测试。
- 不要执行任何 git 命令。

## 要点
1. 齿轮图标 + 「后台」文字（≥640px）。
2. 圆形 logo，加载失败时隐藏。
3. 列表列顺序：名称 | 地区（国旗 + 中文名 + 系统 logo）| CPU | 内存 | 硬盘 | ↑ | ↓ | 延迟 | 丢包 | 本期流量 | 到期 | 状态。
4. `ping.svelte.ts`：视口内、空闲时、并发 3、60 秒刷新、页面隐藏时暂停、离线节点跳过；汇总规则见规格。导出纯函数 `summarizePing(resp)`，返回 `{ latency: number|null, loss: number|null, probes: {name, latency, loss}[] }`，供测试会话写单元测试。testid 为 `node-ping`。
5. 卡片四行全部单行，不能折行；价格统一用 `/`，例如 `¥629/一次性`（同步修改 `priceShort`）。
6. 删除毛玻璃、光斑和半透明背景，恢复不透明白色；保留圆角、阴影和悬停效果；不留死代码。
7. 详情页信息条并入名称卡片，testid 为 `detail-stats`。
9. 性能：节点快照缓存 `dys:snap:v1`、WorldMap modulepreload、`/api/nodes` preload（不能重复请求）、系统图标内联不再请求 svg 文件、首屏国旗不加 lazy。
10. 删除顶栏的「N 在线」胶囊及其骨架。

## 验收（交付前自己运行并贴出结果）
- `npm run check`（svelte-check）0 错误；`npm run build`；`node scripts/check-size.mjs` 通过。
- 用 `MONITOR_HUB=https://monitor.dingg.de npm run dev -- --host 127.0.0.1` 打开，在 1440 和 390 宽度下截图首页卡片、列表和详情页，放到 `docs/design/v1.4/`。确认卡片内没有折行，首页有延迟和丢包显示。
- 在 DevTools 网络面板确认：开页时 `/api/nodes` 只请求 1 次；第二次打开时首帧就是快照内容；`show_ping=false` 时没有 `series=ping` 请求。
- 最后一行写 `T20-DONE`，并列出改动的文件和未完成项。
