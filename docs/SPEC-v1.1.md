# DYS v1.1 改版规格（在 SPEC.md 基础上增补；冲突时以本文件为准，官方文档仍是最高依据）

用户需求：① 更紧凑 ② 未登录隐藏登录按钮 ③ 参考 https://monitor.dingg.de（青屿 Qingyu 主题）提高信息密度、去掉“过于简约” ④ 取消深色模式 ⑤ 增加底部访客气泡。
参考截图：`docs/design/ref/*.png`。**只参考布局和信息组织，不要复制其代码、图标或背景素材。** DYS 要有自己的风格：浅色、细边框、紧凑。

## A. 全局
- **删除深色模式**：去掉 `html.dark`、所有 `dark:` 样式、配色切换按钮，以及 prefs 里的 colorScheme。只保留浅色。`theme.json` 已删除 `color_scheme`。
- 主题色默认改为 `#10b981`；`color.ts` 的默认值同步修改。
- 背景：浅灰底 `#f6f8f7`，顶部加一层很淡的主题色径向渐变（约 6–8% 透明度，用 `withAlpha`）。不用图片。
- 密度：正文 13px，次要信息 12px，数字使用 tabular-nums；卡片内边距 12px、间距 12px、圆角 10px；页面最大宽度 1440px，左右 16px。
- `card_size=compact`：卡片最小宽 260px，1280 宽时每行 4 张、1440 时 5 张；`standard`：最小宽 320px。

## B. 顶栏
左侧：`/favicon.svg` 图标 + `site_name`（链接到 `/`）。
右侧：
- 连接状态：绿点 + 「实时更新」，降级轮询时为琥珀点 + 「轮询更新」，鼠标悬停显示「最后更新 HH:mm:ss」。
- 视图切换（卡片/列表）。
- **后台入口：只在 `/api/me` 的 `authed === true` 时显示**（齿轮图标，链接 `/admin`）。未登录时不渲染任何登录/后台按钮。
不再有配色按钮。

## C. 首页
1. **总览区**（`show_summary`）：左侧 6 个统计卡片，3×2 排列，每个带小图标：内存用量（已用/总量 + 细进度条）、剩余价值（`finance_currency`，下方小字「N 台未计入」）、实时上行、硬盘用量（同内存）、累计流量（本月上下行合计，悬停显示累计）、实时下行。数字较大（22px），单位较小。所有数字跟随当前分组。
   右侧（`show_map`）：点阵世界地图（本地生成的 SVG 圆点，无 WebGL，无外部请求）。按 `country` 用国家中心点放置国旗和标记，悬停显示「国家 · 在线 x/y」；左上角显示在线数徽章，有离线节点时再显示琥珀色离线数。国家中心点表放在 `src/lib/geo.ts`（ISO2 → [lon, lat]）。地图数据要压缩（例如用 RLE 字符串表示陆地点阵），gzip 后不超过 15KB。宽度小于 900px 时地图移到统计卡片下方，小于 520px 时隐藏。
2. **工具条**：分组标签（带数量徽章，仍按 SPEC §5.7 处理）、右侧视图切换、排序下拉（`show_sort`：默认顺序 / 名称 / CPU / 内存 / 硬盘 / 上行 / 下行 / 到期，选择保存到 localStorage）、搜索框（`show_search`：匹配 name、country、os、public_remark，不区分大小写）。
3. **节点卡片**（紧凑，参考截图）：
   - 标题行：状态点、名称（单行省略）、系统小图标（可用 OS 名首字母徽章代替）、国旗。
   - 标签行（小胶囊）：「在线 N 天 N 小时」或「离线 · 时长」、价格/周期。
   - 2×2 指标网格，每格为小图标 + 标签 + 百分比 + 细进度条 + 下方小字：CPU（负载）、内存（已用/总量）、硬盘（已用/总量）、本期流量（`month_used` 或按 `traffic_mode` 计算的值 / `traffic_limit`，无限额显示 ∞，无数据显示 —）。进度条 ≥80% 用琥珀色，≥90% 用红色。
   - 底部 3 个小格：实时速率（↑↓）、当期流量（↑↓）、到期与价值（剩余 N 天 / 剩余价值；到期 ≤ `expiry_warning_days` 时用琥珀色，过期用红色）。`show_billing=false` 时价格和价值隐藏，只保留到期。
   - 「不可用」「等待数据」状态保持 v1.0 的逻辑和 testid。
4. **列表视图**同样紧凑：表头固定，列为 状态/名称/地区/CPU/内存/硬盘/↑/↓/本期流量/到期。

## D. 详情页
- 顶部：返回、节点切换器（上一个/下一个按钮 + 下拉选择，顺序与首页当前分组和排序一致）、「全部节点 · N 台」。
- 标题：国旗 + 名称 + 在线状态胶囊 + 小字（地区 · 分组 · 最近上报 N 秒前）。
- 4 个统计卡片：CPU（核数、负载）、内存（总量）、磁盘（总量）、网络速率（↑↓）。
- 信息条：负载 1/5/15、Swap、进程、TCP/UDP、运行时长。
- 「资源趋势」：时间范围下拉（rangesFor）+「显示峰值」复选框 + 刷新按钮；4 张图并排（宽屏 4 列、中屏 2 列、手机 1 列）：CPU、内存（虚线为总量）、磁盘（虚线为总量）、网络速率。下方是 Ping 延迟和丢包。
- 下方两栏面板：「硬件与系统」（CPU 型号、核心、架构/虚拟化、系统、内核、内存/Swap、磁盘总量、Agent 版本；管理员字段只在存在时显示）和「流量与费用」（当期计费流量进度、当期上下行、计费方向/重置日、累计上下行、录入标价、月均折算、到期时间、剩余价值估算）。

## E. 剩余价值（`src/lib/finance.ts`，纯函数）
- `monthlyCost(node)`：`price / cycleMonths(billing_cycle)`；`once`、NaN、price ≤ 0 时返回 null。
- `remainingValue(node)`：需要 `expires_in > 0` 且 monthlyCost 不为 null，结果为 `monthlyCost * expires_in / 30.4375`；`once` 返回 null；否则 null。
- `summarizeValue(nodes, currency)` → `{ amount, counted, skipped }`：只累计 `currency` 与目标币种相同的节点，其余有值的节点计入 skipped。

## F. 底部访客气泡（`visitor_info_enabled`）
- 固定在底部居中的胶囊：国旗 + 地区（城市或国家）+ 浏览器图标或首字母 + 浏览器名。可以关闭（×，本次会话 sessionStorage 内不再显示）。
- 点击展开小卡片：设备/系统、浏览器版本、IP、运营商（ISP/ASN）、访问时间（本地时间）。
- 数据：`src/lib/visitor.ts`
  - `parseUA(ua)` → `{ browser, version, os, device: "desktop"|"mobile"|"tablet" }`（Edge / Chrome / Safari / Firefox / Opera / 微信 / QQ 浏览器；Windows / macOS / iOS / Android / Linux）
  - `normalizeGeo(source: "ipsb"|"ipwho", json)` → `{ ip, countryCode, country, region, city, isp } | null`
  - `fetchVisitor(fetchFn = fetch)`：先请求 `https://api.ip.sb/geoip`（5 秒超时），失败或返回无效数据时请求 `https://ipwho.is/`；都失败返回 null，此时气泡只显示浏览器信息。
  - 结果缓存到 sessionStorage，只请求一次；所有文本按纯文本渲染。
- 配置为 false 时不发任何请求，也不渲染气泡。离页面底部约 12px，不能遮住页脚（页脚底部留白 ≥ 56px）。手机上自动缩小。

## G. 页脚
「Powered by Monitor」（链接 https://github.com/monitor-probe/monitor）· 「Theme by DYS」（链接仓库），右侧显示 `footer` 文字；`footer_url` 为 http/https 时把文字变为链接。

## H. 新增 testid
`summary-tile`、`world-map`、`map-marker`、`search-input`、`sort-select`、`admin-link`、`conn-status`、`visitor-bubble`、`visitor-panel`、`node-switcher`、`remaining-value`。
删除：配色切换相关的 testid。
