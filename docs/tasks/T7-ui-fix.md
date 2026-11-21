# T7（Antigravity）：v1.1 审核返工

工作目录 /Volumes/SSD/项目/monitor-theme，不要执行 git 命令。T5 整体效果很好（5 列紧凑卡片、总览、地图、详情页结构都对）。下面 6 项必须修：

1. **访客请求在配置加载前就发出（隐私问题，最高优先级）**：`src/App.svelte` 在站点配置解析完成前就渲染了 `<VisitorBubble enabled={siteConfig.visitor_info_enabled}>`，此时用的是默认值 true，所以 `visitor_info_enabled=false` 时也会向 api.ip.sb 和 ipwho.is 各发一次请求。改为：`loadConfig()` 完成（成功或回退默认）后才渲染 VisitorBubble；VisitorBubble 内部也只在 enabled 为 true 时才调用 fetchVisitor（用 $effect 并检查 enabled，不要在 import 或初始化阶段发请求）。另外 App.svelte 第 22 行的 `state_referenced_locally` 警告一起处理。
2. **颜色校验退化**：`src/lib/config.ts` 第 42 行附近，没有 `CSS.supports` 时 `notacolor` 被当作合法颜色。恢复为：先用 `CSS.supports`；没有时用 `document.createElement('span').style.color = v` 后检查 `style.color !== ""`；document 也不存在时返回 false。单元测试 `tests/unit/config.test.ts`「rejects invented named colors even when CSS.supports is unavailable」必须通过。
3. **详情页时间范围重复**：现在同时有一排按钮（1 小时 … 90 天）和一个「6 小时」下拉框。只保留按钮组（保持 `range-btn` testid），删除下拉框。
4. **图表太占空间**：uPlot 图例「时间: — 平均 CPU: —」在每张图下方占了 1–2 行，导致卡片下半部分大量空白。改为：隐藏 uPlot 自带的 legend（`legend: { show: false }`），在卡片标题右侧用小号文字显示系列名和色块；悬停数值用一个跟随光标的紧凑 tooltip 显示（自己实现，纯文本）。图表高度：4 张趋势图 160px，TCP/UDP/进程和 Ping 图 180px。「显示峰值」勾选后要在标题旁的图例里出现「峰值」项（E2E 会检查这个）。
5. **README 丢了内容**：我在 v1.0 加的「路由」（`/`、`/node/{id}`，WAF 白名单说明）、「更新」（从 GitHub 更新）和「发版」三节被删掉了，请恢复（内容见 git 历史 `git show HEAD~3:README.md`，只读，不要执行其他 git 命令；也可以直接让我提供）。
6. 地图上国旗互相重叠（欧洲、东亚）：相距很近的标记做简单的避让（例如按屏幕距离小于 14px 时合并为一个带数量的圆点，悬停列出各国）。

完成后运行 `npm run check && npm test && npm run build`，三项必须全部零错误（`npm test` 现在只有 config 那一项失败，修完应全绿）。然后用 Mock Hub 的 config 场景（`node tests/mock-hub/server.mjs --scenario config --dist dist`，visitor_info_enabled=false）在 Antigravity 浏览器的网络面板确认没有发往 ip.sb 和 ipwho.is 的请求；用 normal 场景截图，更新 docs/design/v1.1/ 下的 detail-1280.png 和 home-1440.png。

报告改动和命令结果，最后单独一行回复 `T7-DONE`。
