# T45 · v3 数据层：主题预设、趋势历史、汇总扩展（后端会话）

用户已确认新的 UI 设计（`docs/design/v3/a5/`）。先读 `docs/SPEC-v3.md`，**第 2 节是你和 Antigravity 之间的接口约定，名字和形状必须完全一致**——Antigravity 正在同时按这个约定写页面。

## 要做的
1. **主题**（SPEC-v3 §2.1）：`config.ts` 增加 `theme`（`resolveTheme`），删除 `color_scheme` / `resolveColorScheme` 及其在 `app-state` 中的深色逻辑（`data-scheme`、`dys:scheme`、`matchMedia` 监听），删除旧 `accent` 的校验和应用（`--accent` 现在由 CSS 按主题定义）。`app-state` 设置 `html[data-theme]` 并缓存到 `localStorage['dys:theme']`。theme.json 已由 Claude 修改（`theme` 替代了 `accent` 和 `color_scheme`），可以读但不要改。
2. **趋势历史**（§2.2）：新建 `src/lib/history.svelte.ts`，接入 `app-state`（`app.history`）。环形缓冲，节点消失时清理；注意内存（500 节点 × 30 点用 `Float32Array`）。
3. **汇总扩展**（§2.3）和**地区聚合扩展**（§2.4）：在 `home-view.svelte.ts` 中实现，告警判断需要 ping 数据：从 ping store 读取各节点最近的延迟/丢包汇总（不要发新的请求）。
4. 文件头注释写清楚新的接口。
5. 只改 `src/lib/**`、`src/main.ts`、`vite.config.ts`、`scripts/**`。**不要改任何 `.svelte`、`app.css`、`index.html`、`tests/**`、`theme.json`**。现有 `.svelte` 可能会因为你删除了 `color_scheme` 等接口暂时编译失败——这是预期的，Antigravity 正在整体重写它们；在报告里列出受影响的地方即可。

## 完成信号
完成后，除了在回复最后一行写 `T45-DONE`，**还要创建空文件 `docs/tasks/T45.done`**（Antigravity 会等这个文件出现后再接入数据）。

## 验收
- `npx tsc --noEmit -p tsconfig.app.json` 中 `src/lib/**` 没有错误（`.svelte` 的错误可以忽略）。
- 为新纯函数写的验证代码可以放在报告里，单元测试由测试会话补。
- 报告：新接口签名、内存估算、受影响的旧接口。不要执行 git。
