# T1（Antigravity）：UI 设计 + 前端实现

工作目录：`/Volumes/SSD/项目/monitor-theme`（git 仓库，**不要执行任何 git 命令**，提交由规划者 Claude 负责）。
先完整阅读 `docs/SPEC.md`，它是唯一依据。逻辑可参考 `/Volumes/SSD/项目/monitor-theme-reference/src`（React 版官方默认主题，MIT），移植到 Svelte 5 时在文件头注明来源。

## 你负责的文件（只改这些）
`package.json` `package-lock.json` `index.html` `vite.config.ts` `svelte.config.js` `tsconfig*.json` `public/**` `src/**` `preview.png` `README.md`
**不要改** `theme.json`（需要改就在报告里提）、`docs/**`、`tests/**`、`scripts/**`、`.github/**`（这些归 Codex）。

## 要做的
1. 先做 UI 设计：在 `docs/design/` 下放一张首页（卡片模式）和一张详情页的设计图（PNG，Antigravity 生成或截图均可），风格严格按 SPEC §7「极简卡片」。这是唯一允许你写入 docs/ 的位置。
2. 搭工程：Svelte 5 + Vite + TS + Tailwind v4 + uPlot。`package.json` 的 version 必须是 `1.0.0`（与 theme.json 一致），并包含这些 scripts：
   `dev`、`build`（输出 `dist/`）、`check`（svelte-check）、`test`（`vitest run`）、`test:e2e`（`playwright test`）。devDependencies 里加 `vitest`、`@playwright/test`、`jsdom`（Codex 后续要用）。
   `vite.config.ts`：开发时把 `/api` 代理到 `process.env.MONITOR_HUB || "http://127.0.0.1:9911"`（`ws: true, changeOrigin: true`）；路径别名用 `import.meta.dirname`（项目路径含中文）；Vitest 配置 `include: ["tests/unit/**/*.test.ts"]`、`environment: "jsdom"`。
3. 按 SPEC §2 的文件拆分实现 §4–§7 全部内容。`src/lib/*.ts` 必须是纯函数或可单独测试的模块，并导出这些（Codex 会直接测）：
   - `api.ts`: `api<T>(path)`、`ApiError{status,message}`、`safeNodes(nodes)`、`groupsOf(nodes)`、类型 `Node` `Metrics` `Me`
   - `format.ts`: `bytes(n)`、`speed(bps)`、`percent(x)`、`money(amount, currency)`、`cycleMonths(cycle)`、`expiry(node)`（返回 `{days:number|null, text:string, level:"ok"|"soon"|"expired"|"none"}`）、`offlineFor(node, nowMs)`（返回 string|null）
   - `config.ts`: `resolveConfig(declared, saved)`、`loadConfig()`
   - `ranges.ts`: `rangesFor(historyDays)`，返回小时数数组
   - `nodes.svelte.ts`: `createNodeStore(opts)`（可注入 WebSocket/fetch/document 以便测试）
4. 在 `index.html` 和各组件里给关键元素加 `data-testid`：`node-card`、`node-row`、`group-tab`、`summary`、`announcement`、`range-btn`、`chart`、`status-unavailable`、`status-waiting`、`login-required`。
5. 用真实 Hub 自测：`MONITOR_HUB=<任意公开 Hub> npm run dev`，或者等 Codex 的 Mock Hub（`node tests/mock-hub/server.mjs`，端口 9911）。在 Antigravity 内置浏览器里检查 360px / 1280px、浅色/深色，截图放到 `docs/design/`。
6. 生成 `preview.png`（1280×800 的首页截图）、`public/favicon.svg`、`public/apple-touch-icon.png`（180×180，不透明背景）。
7. `npm run build && npm run check` 必须零报错。

## 完成后的报告
列出：做了什么、文件清单、`npm run build` 的产物体积（gzip）、与 SPEC 有出入或不确定的地方。完成后在本会话里回复 `T1-DONE`。
