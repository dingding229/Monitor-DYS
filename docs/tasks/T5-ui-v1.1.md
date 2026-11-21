# T5（Antigravity）：v1.1 UI 改版

工作目录 `/Volumes/SSD/项目/monitor-theme`。**不要执行 git 命令。**
v1.0 已发布，用户的反馈是：太空旷、太简约；未登录时要隐藏登录按钮；取消深色模式；要加底部访客气泡。

## 必读
1. `docs/SPEC-v1.1.md`（本次改版规格，逐条实现）
2. `docs/SPEC.md`（原规格，数据规则仍然有效）
3. `theme.json`（规划者已更新 config，**不要改**）
4. 参考截图 `docs/design/ref/`：home.jpg、card.png、detail-top.jpg、detail-bottom.jpg。来自用户自己的站点 https://monitor.dingg.de（公开页面，可以直接用浏览器打开看效果）。只参考布局和信息密度，不要照抄代码或素材。

## 你负责的文件
`src/**`、`public/**`、`index.html`、`package.json`（只能加运行时依赖，尽量不加）、`README.md`、`preview.png`、`docs/design/v1.1/**`（存放截图）。
**不要改** `tests/**`、`scripts/**`、`.github/**`、`theme.json`、`docs/SPEC*`。Codex 正在同时改 tests/。

## 要点
- 严格按 SPEC-v1.1 的 A–H 节实现，`src/lib` 新增 `finance.ts`、`visitor.ts`、`geo.ts`，导出的函数签名必须与规格完全一致（Codex 会直接写测试）。
- 删除深色模式：`grep -rn "dark" src` 结果中不能再有深色相关代码。
- 未登录（`authed !== true`）时页面上不能出现任何「登录」「后台」按钮或链接；登录后显示齿轮图标，链接到 `/admin`，testid 为 `admin-link`。
- 访客气泡：所有外部请求只能发往 `api.ip.sb` 和 `ipwho.is`；配置关闭时不能发出这两个请求。
- 保留 v1.0 的所有 testid 和数据规则（不可用/等待数据/登录提示/502/轮询降级/分组）。
- 主 JS gzip 后不超过 110KB（地图数据要压缩）。
- 完成后运行：`npm run check && npm run build` 必须零错误。不需要跑 `npm test`（Codex 正在改测试）。
- 自测：
  - `node tests/mock-hub/server.mjs --scenario normal --dist dist` 打开 http://127.0.0.1:9911
  - 也可以 `MONITOR_HUB=https://monitor.dingg.de npm run dev` 看真实数据（25 个节点、8 个国家）
  - 检查 1440、1280、768、390 四个宽度下的首页和详情页，截图存到 `docs/design/v1.1/`
- 用 1280×800 的首页截图更新 `preview.png`；README 的特性和设置部分同步更新（去掉深色模式）。

## 报告
列出：改动文件、新函数签名、构建体积、四个宽度的截图路径、不确定的点。最后回复 `T5-DONE`。
