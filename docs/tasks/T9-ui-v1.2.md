# T9（Antigravity）：v1.2 UI

工作目录 /Volumes/SSD/项目/monitor-theme，不要执行 git 命令。v1.1 已上线，用户已经在自己的站点 https://monitor.dingg.de 启用了 DYS，并提出了反馈。

## 必读
- `docs/SPEC-v1.2.md`（本次全部要求，逐条实现，第 1–7 节）
- 用户截图 `docs/design/feedback-v1.2/`：card-bottom-grid.png（要去掉网格框的卡片底部区域）、visitor-bubble.png、detail-list-button.png（红色箭头指向要删除的「列表」按钮）
- `theme.json`（规划者已更新，不要改）

## 你负责的文件
`src/**`、`public/**`、`index.html`、`package.json`/`package-lock.json`（可以新增：运行时依赖 `simple-icons`；开发依赖 `world-atlas`、`topojson-client`、`d3-geo`，这三个只在 `scripts/gen-map.mjs` 中使用，不能进入运行时包）、`scripts/gen-map.mjs`（只有这一个脚本归你）、`README.md`、`preview.png`、`docs/design/v1.2/**`。
**不要改** `tests/**`、其他 `scripts/*`、`.github/**`、`theme.json`、`docs/SPEC*`。Codex 正在同时改 tests/。

## 要点
- 新的 lib 函数签名必须与 SPEC-v1.2 完全一致（Codex 会直接写测试）：`rates.ts`（fetchRates / convert / Rates 类型）、`finance.ts`（summarizeValue 增加第三个参数，返回值增加字段）、`icons.ts`（osKey / browserKey）、`format.ts`（bytes 在 ≥1000 时进位，另加 `regionName(code)`）。
- 不能出现 `{@html}` 或 innerHTML；SVG 图标通过 path 数据渲染。
- 主 JS gzip 后不超过 130KB（simple-icons 必须按名称单独引入；地图数据压缩后不超过 20KB）。
- package.json 里加 `"gen:map": "node scripts/gen-map.mjs"`；生成的 `src/lib/map-data.ts` 要提交，构建时不重新生成。
- `npm run check && npm run build` 必须零错误。`npm test` 中与 v1.2 相关的旧断言可能失败，属于正常情况，Codex 会更新。
- 自测：
  - `MONITOR_HUB=https://monitor.dingg.de npm run dev`（真实数据：25 个节点、8 个国家、CNY/USD/EUR/CAD）
  - Mock Hub 的 normal 场景
  - 1440 / 1280 / 768 / 390 四个宽度的首页（含地图悬停、国家筛选）、详情页（7 天和 30 天两种范围）、访客面板展开，截图存到 `docs/design/v1.2/`
- 用 1280×800 的首页截图更新 preview.png，README 同步更新（汇率请求的说明写进隐私相关段落）。

## 报告
列出：改动清单、新函数签名、包体积、截图路径、与规格的出入。最后单独一行回复 `T9-DONE`。
