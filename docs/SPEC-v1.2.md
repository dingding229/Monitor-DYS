# DYS v1.2 规格（在 SPEC.md、SPEC-v1.1.md 基础上增补；冲突时以本文件为准）

来源：用户在真实站点 monitor.dingg.de（25 个节点、8 个国家；币种 CNY/USD/EUR/CAD；系统 Debian 12/13、iStoreOS）上看过 v1.1 后提出的反馈，以及规划者的检查结果。

## 1. 汇率换算：剩余价值全部计入
- `theme.json` 新增 `exchange_rate_enabled`（默认 true）；`finance_currency` 的选项扩展为 CNY/USD/EUR/HKD/JPY/GBP/CAD/SGD。
- 新增 `src/lib/rates.ts`：
  - `type Rates = { base: string; date: string; rates: Record<string, number> }`，其中 `rates[X]` = 1 单位 base 可换多少 X。
  - `fetchRates(base: string, fetchFn = fetch, nowMs = Date.now()): Promise<Rates | null>`
    1. 先读 localStorage 的 `dys:rates:<BASE>`，12 小时内直接用（读写都要包 try/catch）。
    2. 请求 `https://open.er-api.com/v6/latest/<BASE>`，要求 `result === "success"`，取 `base_code`、`time_last_update_utc`、`rates`。
    3. 失败时请求 `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/<base 小写>.json`，响应格式为 `{ date, <base小写>: { usd: n, … } }`，键转为大写。
    4. 每个请求 5 秒超时；全部失败返回 null。
  - `convert(amount: number, from: string, to: string, rates: Rates | null): number | null`：同币种直接返回；需要汇率但没有，或币种不在表里时返回 null。
- `finance.ts` 的 `summarizeValue(nodes, currency, rates?: Rates | null)` 返回 `{ amount, counted, skipped, converted, byCurrency }`：
  - `byCurrency` 是各原币种的小计（换算前）。
  - 能换算的节点都计入 counted；`converted` 表示是否用到了汇率。
  - 不传 rates 时行为与 v1.1 相同（向后兼容）。
- 总览「剩余价值」：
  - 显示换算后的总额，小字写「按 YYYY-MM-DD 汇率折算」。
  - 鼠标悬停（手机上点击）弹出纯文本小浮层，列出各币种原值小计和换算值。
  - 汇率不可用时回退为 v1.1 的行为（只累计同币种，显示「N 台未计入 · 汇率不可用」）。
  - `exchange_rate_enabled=false` 时不发任何汇率请求。
- 卡片和详情页上的单个节点仍显示原币种（不换算）。

## 2. 系统 logo
- 使用 `simple-icons`（CC0 许可，按图标名单独 import，保证 tree-shaking，不能整包引入）。
- `src/lib/icons.ts`：`osKey(os: string)`，返回 `"debian"|"ubuntu"|"centos"|"rocky"|"almalinux"|"fedora"|"alpine"|"arch"|"opensuse"|"openwrt"|"freebsd"|"windows"|"macos"|"linux"|"unknown"`。规则：
  - 不区分大小写，匹配 os 字符串里的关键字。
  - `iStoreOS`、`ImmortalWrt`、`OpenWrt` 都映射为 openwrt。
  - simple-icons 里没有的图标用 Tux（linux）代替；`unknown` 用中性的服务器图标。
- `src/components/BrandIcon.svelte`：输入 key 和尺寸，用 `{#each}` 渲染 SVG `<path d>`，**不能用 {@html}**，使用品牌色。
- 用在这些地方：卡片标题行（替换 v1.1 的字母徽章）、列表视图的名称列、详情页的「系统」行、访客面板的「系统」。`title` 属性写完整的 os 字符串。

## 3. 卡片底部三格去掉「网格框」
截图里卡片底部「实时速率 / 当期流量 / 到期与价值」三个带边框和底色的小格要去掉，风格与上方 2×2 指标保持一致：
- 无边框、无底色，上方用一条与卡片边框同色的 1px 细线分隔。
- 三列等宽：每列一行灰色小标签（12px）+ 两行数值（13px，tabular-nums），左对齐。颜色规则不变（上行绿、下行蓝、到期提醒琥珀、过期红）。

## 4. 访客气泡的浏览器 logo
- `icons.ts` 新增 `browserKey(name)`，返回 `"chrome"|"edge"|"safari"|"firefox"|"opera"|"wechat"|"qq"|"unknown"`。simple-icons 有图标的就用（例如 Google Chrome、Firefox Browser、Safari、Opera、WeChat）；没有的（例如 Edge）用中性地球图标，不要手绘仿冒品牌图标。
- 气泡格式：国旗 + 地区名 | 浏览器 logo + 浏览器名 ×。
- **地区名用中文**：根据 countryCode 用 `Intl.DisplayNames("zh-CN", { type: "region" })` 显示，例如 HK → 香港。城市（英文原文）只在展开面板里显示。

## 5. 删除顶栏的「列表/卡片」按钮
详情页不显示视图切换。首页工具条已有卡片/列表切换，顶栏这个按钮重复，**所有页面都删除**。

## 6. 规划者检查发现的其他问题（全部修复）
a. 连接状态初始显示「轮询更新」（WS 还没连上时）。改为：首次数据到达前显示灰点「连接中」，WS 正常时显示「实时更新」，只有真正降级时才显示「轮询更新」。
b. 图表里 `minutes < step/60` 的时间段画成了灰色色块，看起来像网格。去掉色块：数据不满的时间段正常画出，只有 minutes=0 或没有数据的时间段断开线条。
c. X 轴最后一个刻度被截断（显示成「23:0」），需要增加右侧内边距或让最后一个标签右对齐。
d. 时间范围大于 24 小时时，X 轴改为显示日期（`MM-DD`）；大于 2 小时且不超过 24 小时显示 `HH:mm`；跨天时在第一个刻度上带日期。
e. 「Ping 延迟」标题旁的副标题与图例重复，删除副标题；「Ping 丢包率」图例里的「丢包」二字去掉。
f. 少于 30 个点时才显示数据点圆圈，否则不显示。
g. 节点卡片现在是 `role=button`，改为 `<a href="/node/{id}">`：普通点击由路由接管，中键或 Cmd/Ctrl+点击可以在新标签页打开。列表视图的行也一样（名称用链接）。
h. `bytes()`：数值 ≥1000 时进位到下一个单位（「1011 KB/s」应显示为「0.99 MB/s」），单元测试要同步修改。

## 7. 地图改为直观的设计（替换 v1.1 的稀疏点阵地图）
用户反馈当前地图「不直观」：陆地点阵太稀疏、认不出大洲，国旗浮在空中，与位置的关系不清楚。新设计如下：
- **真实轮廓的点阵**：
  - 新增构建脚本 `scripts/gen-map.mjs`（Antigravity 负责，开发依赖 `world-atlas` + `topojson-client` + `d3-geo`，只在构建时使用）。
  - 用 Natural Earth 110m 国家边界生成等距圆柱投影点阵：纬度 -56°～78°，点距 1.5°。每个点记录所属国家的 ISO2 代码。
  - 输出到 `src/lib/map-data.ts`（压缩格式，例如按行做游程编码 RLE），gzip 后不超过 20KB。
  - 运行时不能有任何外部请求。
- **按国家高亮**：
  - 有节点的国家，它的点全部用主题色显示，透明度随节点数加深。
  - 没有节点的陆地用浅灰色点。
- **国家标记**：
  - 在国家中心点画一个圆形徽章，里面写该国节点数，旁边放国旗。
  - 颜色：全部在线为主题色，部分离线为琥珀色，全部离线为灰色。
  - 相互重叠的徽章用引线错开，引线指向真实位置。
- **悬停浮层**（纯文本）：国家名，在线数/总数，该国合计 ↑↓ 速率，以及节点名列表（最多 6 个，多余的显示「等 N 台」）。
- **国家列表**：地图右侧（宽屏）或下方（窄屏）放一个紧凑列表，按节点数降序排列，每行为：国旗、中文国家名、在线数/总数、↑↓ 速率。
- **点击筛选**：点击地图上的国家或列表中的行，节点列表按国家筛选，工具条出现「地区：香港 ×」筛选标签，再点一次或点 × 取消。筛选与分组、搜索同时生效；总览数字按筛选结果计算。
- 卡片内保持紧凑：地图区高度与左侧 6 格总览一致。宽度小于 900px 时地图移到下方，小于 520px 时只显示国家列表。
- testid：`world-map`、`map-country`（每个有节点的国家一个，带 `data-country="HK"` 和 `data-count`）、`country-list`、`country-row`、`country-filter-chip`。

## 7.1 testid 变动
- 新增：`brand-icon`（带 `data-key`）、`value-breakdown`（剩余价值浮层）、`rate-date`。
- 删除：顶栏的视图切换按钮。
- `map-marker` 改名为 `map-country`。
