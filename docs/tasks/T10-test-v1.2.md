# T10（Codex）：v1.2 测试准备（与 Antigravity 并行）

工作目录 /Volumes/SSD/项目/monitor-theme，不要执行 git 命令。阅读 `docs/SPEC-v1.2.md`；`theme.json` 已更新（新增 `exchange_rate_enabled`，`finance_currency` 增加 GBP/CAD/SGD）。
Antigravity 正在同时改 `src/**` 和 `scripts/gen-map.mjs`。你只能改 `tests/**`、`playwright.config.ts`，以及 `scripts/` 下除 `gen-map.mjs` 以外的文件。

1. **Mock Hub**：
   - normal 场景的 os 覆盖：Debian 12 / Debian 13 / Ubuntu 24.04 / CentOS 7 / Rocky 9 / Alpine 3.20 / Arch / iStoreOS 25.12.6 / Windows Server 2022 / FreeBSD 14
   - 币种增加 CAD、GBP
   - 新增 `fewpoints` 场景：历史只有最近 3 小时的数据，用于测试 30 天范围只有 4 个点的情况
2. **单元测试**（按 SPEC-v1.2 的签名写；src 还没实现时可以失败，在报告里注明）：
   - `tests/unit/rates.test.ts`：缓存命中、过期、localStorage 抛异常；open.er-api 成功；失败后回退到 jsdelivr（键名大小写转换）；两者都失败返回 null；5 秒超时；convert 的同币种、缺少汇率、币种不在表中
   - `tests/unit/finance.test.ts`：summarizeValue 带 rates 时全部计入、byCurrency 小计、converted 标志；不带 rates 时与 v1.1 行为一致
   - `tests/unit/icons.test.ts`：osKey 覆盖上面所有 os 字符串及大小写变体，iStoreOS/ImmortalWrt/OpenWrt 都映射为 openwrt，空值为 unknown；browserKey 覆盖所有浏览器
   - `tests/unit/format.test.ts`：bytes 在 999 / 1000 / 1011 / 1023 / 1024 等边界的进位；regionName("HK") 返回「香港」，非法代码时回退为原代码
   - 增加一个静态扫描测试：`src/**` 中不能有 `from "simple-icons"` 的整包引入（只能按名称单独引入，例如 `import { siDebian } from "simple-icons"` 可以，`import * as` 不行）
3. **E2E 起草**（先标 `test.fixme`）：
   - 用 `page.route` 模拟 open.er-api 和 jsdelivr（`mockRates(page, mode)`），统计请求次数
   - 汇率可用时剩余价值全部计入并显示汇率日期；只有 jsdelivr 可用时也能计入；都失败时显示「汇率不可用」；`exchange_rate_enabled=false`（config 场景）时两个域名的请求次数都为 0；悬停或点击出现 value-breakdown
   - 卡片底部没有带边框的小格（检查三列容器没有 border/background 样式）
   - 系统 logo：`brand-icon[data-key=debian]` 出现，iStoreOS 节点为 openwrt
   - 访客气泡：显示中文地区名「香港」，浏览器 brand-icon 存在
   - 首页和详情页都没有顶栏视图切换按钮；工具条的视图切换仍然可用
   - 连接状态首帧前为「连接中」
   - 节点卡片是 `a[href="/node/<id>"]`，普通点击后客户端路由跳转（页面不整页刷新）
   - 地图：map-country 的数量等于国家数，`data-count` 之和等于节点数；点击 map-country 后出现 country-filter-chip，卡片只剩该国节点，总览数字随之变化；点 × 后恢复；country-row 点击效果相同；390 宽度时 world-map 隐藏但 country-list 可见
   - fewpoints 场景、30 天范围：X 轴刻度显示日期格式，最后一个刻度没有被截断（检查文字的 bbox 在画布内）
4. 现有 v1.1 用例保留，按 v1.2 的变化调整：map-marker 改为 map-country；删除顶栏视图切换相关的断言。

报告：文件清单、用例清单（哪些标了 fixme）、mock 场景变更、冒烟测试输出。
