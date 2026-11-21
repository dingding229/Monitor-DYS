# T16（Codex · UI）：v1.3 UI 改版

你是本项目新的 UI/前端工程师（之前由 Antigravity 负责）。规划和审核由 Claude 负责。
工作目录：`/Volumes/SSD/项目/monitor-theme`（Monitor 探针的 DYS 主题，Svelte 5 runes + Vite + TypeScript + Tailwind v4 + uPlot）。**不要执行任何 git 命令**，提交由 Claude 完成。

## 先读
1. `docs/SPEC.md`（官方文档要求的数据规则和安全规则，至今仍然有效）
2. `docs/SPEC-v1.1.md`、`docs/SPEC-v1.2.md`（之前两次改版的规格）
3. **`docs/SPEC-v1.3.md`（本次任务，第 1–8 节逐条实现）**
4. `theme.json`（已由规划者更新为 1.3.0，不要改）
5. 现有代码：`src/App.svelte`、`src/pages/*`、`src/components/*`、`src/lib/*`

## 你负责的文件
`src/**`、`public/**`、`index.html`、`vite.config.ts`、`package.json`/`package-lock.json`（只允许增减依赖；版本号已是 1.3.0，不要改）、`scripts/gen-map.mjs`、`README.md`、`preview.png`、`docs/design/v1.3/**`。
**不要改** `tests/**`、`scripts/` 下除 gen-map.mjs 以外的文件、`.github/**`、`theme.json`、`docs/SPEC*`。另一个 Codex 线程正在同时修改 tests/。

## 硬性要求
- 安全：不能出现 `{@html}` 或 innerHTML；所有来自 Hub 或设置的文本按纯文本渲染（SPEC §5.12）。
- 不能有任何发往 open.er-api.com 或 jsdelivr 的请求（汇率功能已删除）。访客定位只在 `visitor_info_enabled=true` 且配置加载完成之后才请求。
- 性能预算见 SPEC-v1.3 §6：入口 JS gzip 后不超过 60KB，首屏 JS 合计不超过 85KB，详情 chunk 不超过 40KB。完成后在报告里列出 `npm run build` 输出的各 chunk 的 gzip 体积。
- 保留所有现有的 testid（除 SPEC-v1.3 §8 中列出要删除的），并新增 §8 中列出的 testid。
- `npm run check && npm run build` 零错误零警告。`npm test` 和 `npm run test:e2e` 中与 v1.3 改动相关的旧断言可能失败，属于正常情况，测试线程会更新；但与本次改动**无关**的用例如果失败，必须修复。

## 自测
- 真实数据：`MONITOR_HUB=https://monitor.dingg.de npm run dev`（25 个节点、8 个国家；这是用户自己的公开站点，只读访问）
- Mock：`npm run build && node tests/mock-hub/server.mjs --scenario normal --dist dist`，打开 http://127.0.0.1:9911
- 用浏览器（Codex 内置浏览器或 Playwright 截图均可）检查 1440、1280、768、390 四个宽度下的首页和详情页。截图存到 `docs/design/v1.3/`，包括：首页 1440、首页 390、详情 1280、详情 390、滚动到底部时页脚和访客气泡合并的状态、筛选后的空状态。
- 用 Chrome DevTools 的 Performance 面板或 Lighthouse（模拟 Fast 3G）对比改版前后的 FCP，在报告中写明数值。
- 用 1280×800 的首页截图更新 `preview.png`；README 同步更新（删除汇率和剩余价值相关内容）。

## 报告
列出：改动文件清单、chunk 体积表、FCP 对比、截图路径、与规格的出入或疑问。
