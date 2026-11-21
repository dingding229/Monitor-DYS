# T23 · 测试对齐（测试会话）

规划者确认：`summarizePing` 使用对象契约，空数组或无效输入返回 `{ latency: null, loss: null, probes: [] }`，不返回 null（T21 中「返回 null」指的是 latency 和 loss 为 null）。

1. 修改 `tests/unit/ping.test.ts` 的空数组用例，断言 `toEqual({ latency: null, loss: null, probes: [] })`。
2. UI 会话正在做 T22：`lossText` 的整数丢包显示为「100%」（不显示 100.0%）；卡片的在线时长改为「在线 98 天」这种粗粒度格式；ping 加载中显示「…」。如果有断言依赖这些格式，按新格式修改；E2E 的不折行用例增加一条检查：卡片内不能有 `scrollWidth > clientWidth` 的文本元素（即没有被省略号截断的内容），在 1280 宽度下运行。
3. 不要改 src。不要执行 git。

验收：`npx vitest run` 全部通过（UI 交付前，lossText 相关断言可以暂时失败，需注明）；`npx playwright test` 能运行。最后一行写 `T23-DONE`。
