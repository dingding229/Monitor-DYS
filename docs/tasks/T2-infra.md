# T2（Codex）：Mock Hub、打包脚本、CI/Release

工作目录：`/Volumes/SSD/项目/monitor-theme`。先完整阅读 `docs/SPEC.md`（唯一依据）。参考实现在 `/Volumes/SSD/项目/monitor-theme-reference`（只读）。
**不要执行 git 命令。** Antigravity 正在同时改 `src/`、`package.json` 等前端文件，你**只能**写下面列出的路径。

## 你负责的文件
`tests/mock-hub/**` `tests/fixtures/**` `scripts/**` `.github/workflows/**` `.gitignore` `LICENSE`（MIT，2026 dingding229，并附上 monitor-theme-default 的版权声明，因为移植了它的逻辑）

## 要做的
1. **Mock Hub**：`tests/mock-hub/server.mjs`，只用 Node 24 内置模块，零依赖（WS 握手和帧自己实现，或用 `node:http` 的 upgrade）。
   - `node tests/mock-hub/server.mjs [--port 9911] [--scenario <name>] [--dist dist]`
   - 托管 `--dist` 静态文件；未知路径回退 `index.html`；`/api/*` 按 SPEC §4 返回数据。
   - WS `/api/ws` 每 2s 推送一次；带 `?gzip` 时发二进制 gzip 帧。
   - 错误格式与真实 Hub 一致：`text/plain` 中文一行。
   - 场景（`tests/fixtures/scenarios/*.json`）至少要有：
     `normal`（12 个节点、3 个分组加部分未分组、多种币种和计费周期、`<n>m`、到期 -3/0/5/60/null、离线节点有 last_seen_ago，也有 null 的情况）、
     `nogroups`、`allgrouped`、`anonymous`（缺少管理员字段）、`legacy-1.2`（没有 group / expires_in / last_seen_ago / history_days / net_*_max / cpu_max，`/api/themes/dys/config` 返回 404）、
     `corrupt`（某节点 metrics 字段类型错误，或 load 长度不为 3）、`waiting`（online:true 且 metrics:null）、`private`（所有读接口返回 401 和「需要登录后查看」）、`ws503`（WS 握手返回 503，以此测试降级轮询）、`proxy502`（返回 HTML 错误页）、
     `config`（`/api/themes/dys/config` 返回部分合法、部分非法的值，例如 accent 写成 "notacolor"、poll_interval 写成 999）。
   - `/api/nodes/{id}/metrics` 遵守 hours / points / series：`step` 在 7 天以内取 60 的倍数，更长时取 3600 的倍数；包含 minutes 不满的时间段；ping 带 task_id 和 probes。
   - 字段名参考 `/Volumes/SSD/项目/monitor-theme-reference/src/lib/api.ts` 的 `Node` / `Metrics` 类型和 NodeDetail.tsx。
2. **`scripts/pack.sh`**：确认 `dist/index.html` 存在 → 校验 package.json、package-lock.json 和 theme.json 三者 version 一致 → `tar czf theme.tar.gz dist theme.json preview.png` → `gzip -t` → 检查限制（总包 ≤32MiB、解压 ≤64MiB、单文件 ≤8MiB、条目 ≤2000、只能有普通文件和目录）→ 输出 sha256 到 `theme.tar.gz.sha256`。在 macOS 上设置 `COPYFILE_DISABLE=1`，并且不要把 `._*` 打进包。
3. **`scripts/verify-package.mjs`**：解压到临时目录，校验 theme.json 的 6 个必填字段都是字符串、`short` 符合 `^[A-Za-z0-9_-]+$`、config 每一项都符合文档规则（key 唯一；default 的类型与 type 一致；select 的 default 必须在 options 里；number 的 min ≤ default ≤ max；title 项只有 label）。
4. **`.github/workflows/ci.yml`**（push 到 main、PR 时触发）：npm ci → 版本一致性校验 → `npm run check` → `npm test` → build → `npx playwright install --with-deps chromium && npm run test:e2e` → `scripts/pack.sh` → `node scripts/verify-package.mjs`。
   **`.github/workflows/release.yml`**（推送 `v*` tag 时触发）：tag 必须等于 `v$(theme.json.version)` → 构建 → 测试 → 打包 → 校验 → `gh release create "$GITHUB_REF_NAME" theme.tar.gz theme.tar.gz.sha256 --generate-notes --latest`（发正式版）。权限 `contents: write`，checkout 时 `persist-credentials: false`。Node 24。action 版本参考参考实现里的写法。
5. `.gitignore`：node_modules、dist、theme.tar.gz*、test-results、playwright-report、.DS_Store。
6. 自测：`node tests/mock-hub/server.mjs --scenario normal` 后，用 curl 逐个验证接口、WS（可写个小的 node 客户端，验证 gzip 帧能解压并得到 JSON），以及 401/503/502 场景。`dist/` 还不存在时，用一个假的 index.html 测静态托管和回退。pack.sh 可以用假 dist 跑通（结束后删掉假文件）。

## 完成后的报告
列出：文件清单、每个场景的说明、自测命令及输出摘要、对 SPEC 的疑问。
