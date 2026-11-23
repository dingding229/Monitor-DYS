# T37 · v2.0 测试更新（测试会话）

T34 基线已提交（`npm run perf`、`npm run perf:compare` 两个脚本已由 Claude 加到 package.json）。UI 已按 v2.0 重写（T35），现在测试需要跟上。Antigravity 和后端会话还在并行精简 `src/**`，**你只改 `tests/**`、`playwright.config.ts`、`vitest.config.ts`、`.github/workflows/**`**。

## 要做的
1. **E2E 修复**：`smoke.spec.ts` 中「inline background in built <head>」仍按旧颜色断言。v2.0 的 `index.html` 有浅色和深色两套关键 CSS，以及一段首帧前设置 `html[data-scheme]` 的内联脚本。改为断言：内联 CSS 同时包含浅色背景（与 `app.css` 中 `--bg` 的浅色值一致）和 `[data-scheme="dark"]` 的深色背景，并且内联脚本出现在第一个 `<link rel="stylesheet">` 之前。从 `app.css` 读取颜色值，不要写死。
2. **新增 E2E（总数不超过 16 个）**：
   - 深色模式：`colorScheme: 'dark'` 的 context 打开首页，`html[data-scheme]` 为 `dark`，`body` 的背景色和浅色不同；mock hub 的配置返回 `color_scheme: "light"` 时，即使系统是深色也显示浅色（mock hub 需要支持通过场景或 query 设置主题配置，如果还不支持就加上）。
   - 刷新时不闪：深色 context 中，在 `DOMContentLoaded` 之前（`page.addInitScript` 记录首帧时 `html` 的 `data-scheme`）就已经是 `dark`。
   - 单卡元素数：首张 `node-card` 的后代元素数不超过 70。
3. **单元测试**：后端会话可能会删除只在测试中使用的导出（`groupsOf`、`loadConfig`、`cycleMonths`、`mergeNodes`、`summarizePing` 等）。测试改为通过公开的接口验证同样的行为；如果某个导出已经被删除，相应的测试改测它的调用方。为 T33 新增的纯函数 `summarizeNodes`、`aggregateCountries`、`resolveColorScheme` 补单元测试。
4. **CI**：`.github/workflows/ci.yml` 的体积检查改为默认 v2 预算（去掉 `SIZE_BUDGET=v1`，如果有的话）。等其他两个会话完成后由 Claude 确认是否达标，你先改好即可。

## 验收
- `npx vitest run` 全部通过（如果失败是因为其他会话正在修改 `src`，写进报告）。
- `npx playwright test` 中你新增的和修改的用例都通过。
- 最后一行写 `T37-DONE`。不要执行 git。
