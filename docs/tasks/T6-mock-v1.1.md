# T6（Codex）：v1.1 测试准备（与 Antigravity 的 UI 改版并行）

工作目录 `/Volumes/SSD/项目/monitor-theme`。**不要执行 git 命令。**
先阅读 `docs/SPEC-v1.1.md`（本次改版）和 `theme.json`（config 已更新：删除了 color_scheme，新增 card_size、show_map、show_search、show_sort、finance_currency、expiry_warning_days、visitor_info_enabled、footer_url）。
Antigravity 正在同时重写 `src/**`。你**只能**改 `tests/**`、`playwright.config.ts`、`scripts/**`。

## 1. Mock Hub
- `normal` 场景扩充到 16 个节点，覆盖至少 8 个国家（CN、HK、JP、SG、US、DE、GB、KR……）。补全这些字段：`traffic_limit`（包括 0 = 无限）、`traffic_mode`、`month_used`、`traffic_reset_day`、`month_start`、`day_rx/day_tx`、`price`/`currency`/`billing_cycle`（包括 once，以及 CNY/USD/EUR/JPY/HKD 多币种）、`expires_in`（包括 3 天，用于测试提醒色）、`swap_total`、`cpu_cores`、`cpu_name`、`public_remark`。字段名以参考实现 `/Volumes/SSD/项目/monitor-theme-reference/src/lib/api.ts` 的 `Node` 类型为准。
- 新增 `admin` 场景：`/api/me` 返回 `authed: true`，节点带上管理员字段（ip/ipv4/hostname/remark 等）。其余场景保持 `authed: false`。
- 历史数据要与扩充后的节点一致；冒烟测试 `tests/mock-hub/smoke.mjs` 同步更新并通过。

## 2. 单元测试（先按规格写，src 尚未实现时可以失败）
按 SPEC-v1.1 §E/§F 的签名写：
- `tests/unit/finance.test.ts`：monthlyCost（各周期、once、`<n>m`、price 0、未知周期）；remainingValue（expires_in 为正数、0、负数、null、键缺失；once）；summarizeValue（混合币种时的 counted/skipped）。
- `tests/unit/visitor.test.ts`：parseUA，至少 10 个真实 UA（Chrome Win、Edge、Safari mac、iOS Safari、iPad、Android Chrome、Firefox、微信、QQ 浏览器、Opera）；normalizeGeo 处理 ipsb 和 ipwho 的真实响应样例（自己构造，字段以这两家公开文档为准；ipwho 失败时返回 `{success:false}`）；fetchVisitor 的成功、ipsb 失败转 ipwho、两者都失败返回 null、5 秒超时（用假定时器）。
- 删除或改写依赖深色模式和 `color_scheme` 的现有测试。`color.test.ts` 中默认色改为 `#10b981`。

## 3. E2E 准备
- `tests/e2e/helpers.ts`：`mockGeo(page, mode: "ipsb"|"ipwho"|"fail")`，用 `page.route` 拦截 `https://api.ip.sb/**` 和 `https://ipwho.is/**`；另外提供一个函数，统计页面对这两个域名的请求次数。
- 按 SPEC-v1.1 起草新的 E2E 用例，可以先标 `test.fixme`，等 UI 完成后再启用：
  - 未登录不出现 admin-link 和任何「登录」文字；admin 场景出现 admin-link
  - 无 html.dark、无配色按钮
  - 访客气泡：ipsb 正常、回退到 ipwho、两者都失败只显示浏览器；`visitor_info_enabled=false` 时（在 config 场景里设置）两个域名请求次数为 0、没有 visitor-bubble；点击展开出现 visitor-panel；地区等文本作为纯文本渲染（在 geo 返回里注入 `<img>`，页面上不应出现 img 元素）
  - 紧凑：1280 宽时首行卡片数 ≥ 4；1440 宽时 ≥ 5
  - summary-tile 有 6 个；剩余价值只按 finance_currency 累计
  - world-map 中 map-marker 数量等于国家数；390 宽时地图隐藏
  - 搜索「东京」只剩匹配的卡片；排序 CPU 降序；选择刷新后保持
  - 详情页：node-switcher 的上一个/下一个可以切换；4 张趋势图出现；勾选「显示峰值」后图例出现峰值
  - 现有 v1.0 用例（不可用/等待/401/502/ws503/legacy/nogroups）保留，卡片数等断言按新数据更新

## 报告
列出文件清单、场景变更、新用例清单（哪些标了 fixme）、冒烟测试输出。
