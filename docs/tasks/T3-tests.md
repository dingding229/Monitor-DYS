# T3（Codex）：单元测试 + E2E + 完整 CI 演练

工作目录：`/Volumes/SSD/项目/monitor-theme`。**不要执行 git 命令。** 前端（T1）已完成并审核，`src/` 现在没有其他人在改。

## 你负责的文件
`tests/**`、`playwright.config.ts`、`scripts/**`；`package.json` 只允许改 scripts 和 devDependencies。
`src/lib/**` 只允许修复测试发现的**明确 bug**：改动要最小，并且每一处都要在报告里列出（文件、行、原因）。不要改 `src/components`、`src/pages`，也不要改视觉；这些地方发现问题只写进报告。

## 已知问题（必须处理）
1. `src/lib/format.ts` 的 `percent(x)` 在 `0<x<1` 时把 x 当作比例 ×100，导致 `percent(0.5)` 显示成 "50%"。Hub 的 cpu 等字段本来就是 0–100。请修复：单参数时 x 一律按百分数处理；`percent(used,total)` 的用法不变。
2. Mock Hub 里历史 `mem_used` 与实时快照不一致（历史约 130MB，实时 1.8GB）。让历史曲线在实时值附近波动（disk、swap 也同样处理），并重新跑 `tests/mock-hub/smoke.mjs`。

## 单元测试（Vitest，`tests/unit/*.test.ts`）——逐条覆盖 SPEC §5
- format：bytes / speed / percent / money（含非法币种的回退、US$ / HK$ / JP¥）/ cycleMonths（7 个命名值、`60m`、`0m`、`1201m`、`12m`、乱写的值 → NaN）/ expiry（-3 / 0 / 5 / 60 / null / 键缺失时用 expires_at）/ offlineFor（在线时返回 null；last_seen_ago 为 null、数字、键缺失时用 last_seen；last_seen 为 0）
- api：`api()` 处理 text/plain 错误、HTML 502、200 但不是 JSON、网络错误、超时重试；safeNodes（字段类型错误、load 长度不对）；groupsOf 的顺序为首次出现顺序
- config：resolveConfig 处理每种 type 的合法值和非法值，number 超出范围、select 不在 options 里、accent 不是合法颜色、未声明的键会被忽略、title 项被跳过；loadConfig 在 404 / 401 / 网络错误时回退默认值
- ranges：history_days = 1 / 7 / 30 / 90 / 365、缺失、0、非法值，并断言具体数组
- nodes store：注入假的 WebSocket / fetch / document 测试——帧按顺序解码（让 gzip 帧慢于后面的帧，断言最终结果顺序正确）；只有成功解码后才重置 watchdog；onclose 后开始轮询并退避重连；hidden 时关闭 WS、停止轮询、丢弃进行中请求的结果；visible 时先请求一次 nodes 再重连；setPollInterval 生效
- 代码中不能出现 `{@html}` 或 innerHTML：写一个测试扫描 `src/**`

## E2E（Playwright，`tests/e2e/*.spec.ts`，chromium）
`playwright.config.ts` 用 `webServer` 启动多个 Mock Hub 实例（每个场景一个端口，`--dist dist`），测试前需要先 `npm run build`。覆盖：
- normal：卡片数量为 12；分组标签顺序；点「未分组」后汇总数字随之变化；切换为列表模式后刷新页面仍保持（localStorage）；进入 `/node/1` 后图表出现；直接打开 `/node/1` 能正常加载；时间范围按钮与 history_days 一致
- 360px 视口下没有横向滚动；深色模式切换后 `html.dark` 存在
- corrupt →「不可用」，并且其他节点正常显示；waiting →「等待数据」；private → `login-required`；proxy502 → 显示状态码提示，且不显示 HTML 正文；ws503 → 10 秒内能观察到多次 /api/nodes 轮询，并且数据有更新；legacy-1.2 → 页面正常，时间范围为 1h / 6h / 24h / 7d，没有报错；nogroups → 没有 group-tab；config 场景 → 非法的 accent 回退为默认色、poll_interval 回退为 5，并检查公告以纯文本显示（在场景里放一段 `<img src=x onerror=alert(1)>`，断言它作为文本出现，并且页面上没有 img 元素）
- 页面隐藏和重新可见：用 `page.evaluate` 模拟 visibilitychange，断言隐藏时 WS 关闭，可见时重新连接

## 完整演练
依次运行：`npm ci && node scripts/check-version.mjs && npm run check && npm test && npm run build && npm run test:e2e && scripts/pack.sh && node scripts/verify-package.mjs`，并在报告中贴出每一步的结果摘要。全部通过后删除 theme.tar.gz*。

## 报告
列出：测试数量和通过情况、对 src/lib 的改动清单、发现但没有修的问题（组件或页面层面）。
