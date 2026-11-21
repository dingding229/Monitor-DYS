# T28 · 丢包格式断言（测试会话）

UI 在 T27 中按规划者的要求调整了 ping 区块：整数丢包不带小数（`0·0·0`、`0·100·100`），非整数保留 1 位（`2.5`）；缺失探针用「—」占位，仍然用「·」连接。

修改 `tests/e2e/smoke.spec.ts` 中「card Ping displays three per-probe values and twelve segments」用例：把 `0.0·0.0·0.0` 改为匹配新格式，例如用正则 `/^(—|\d+(\.\d)?)(·(—|\d+(\.\d)?)){2}$/` 匹配，并且三个值之间要有两个「·」。不要改 src，不要执行 git。

验收：`npx playwright test` 12/12 通过、`npx vitest run` 通过。最后一行写 `T28-DONE`。
