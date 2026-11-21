# T24 · 极端价格截断（UI 会话）

复核时 `npx playwright test` 有 1 个用例失败。在 mock 的 normal 场景、1280px 宽度下，`/node/8` 卡片底部被截断（price 120.5、currency SGD、billing_cycle 18m）：
```
"/node/8: ↑ 74.3KB/s (60px > 56px)",
"/node/8: ↑ 16.0 GB (55px > 52px)",
"/node/8: ↓ 24.0 GB (55px > 52px)",
"/node/8: SGD 120.50/18月 (101px > 95px)",
```
原因是「SGD 120.50/18月」太长，挤占了另外两列的宽度。

修复：
1. 在 `priceShort`（只用于卡片和列表的短价格）里，币种使用紧凑符号：CNY ¥、USD US$、EUR €、GBP £、JPY JP¥、HKD HK$、SGD S$、CAD C$、AUD A$、TWD NT$、KRW ₩、RUB ₽，其他币种保持 `CODE ` 前缀。金额为整数时不显示小数（已经是这样），有小数时保留 2 位。详情页的完整价格不变。
2. 修复后在 1280px 和 236px 卡片下，`S$120.50/18月` 和另外两列同时完整显示。如果仍然放不下，第三列允许把价格行的字号降到 12px（只降价格这一行）。
3. 运行 `npx playwright test`（可以运行测试，但不要修改 tests/**），确认 9/9 通过；运行 `npm run check`、`npm run build`、`node scripts/check-size.mjs`。`tests/unit/format.test.ts` 如果因为新的符号格式失败，在报告中列出失败的断言，由测试会话修改，你不要改测试。

不要执行 git。最后一行写 `T24-DONE`。
