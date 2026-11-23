# T55 · 更新测试：自定义主题色与地区列表（测试会话）

v2.0.1 把 6 套主题预设换成了自定义主题色（规格见 `docs/SPEC-v3.md` §5），并修复了地区列表展开后拉长页面的问题。代码已经完成，现在有 17 个单元测试和 2 个 E2E 测试仍引用旧接口。

## 要做的
1. `tests/unit/config.test.ts`：删除 `resolveTheme` / `theme` 相关断言，改为 `accent_color`（合法 `#rgb`、`#RRGGBB`、带空白 → 归一为小写 `#rrggbb`；非法值、非字符串 → `#10b981`；旧键 `theme`、`accent`、`color_scheme` 被忽略）。
2. 新建 `tests/unit/theme.test.ts`，覆盖 `src/lib/theme.ts`：
   - `resolveAccent` 的归一与回退；
   - `accentPalette`：对 `#10b981`、`#3b82f6`、`#facc15`、`#ffffff`、`#09090b` 以及若干随机色，断言五个字段都是 `#rrggbb`，`accent` 等于输入，`strong` 对白色对比度 ≥ 4.5，`text` 对 `soft` 对比度 ≥ 4.5；`#10b981` 的结果与 `src/app.css` 中 `:root` 的默认变量完全一致（读取 CSS 文件比对，防止两边漂移）；
   - `readCachedAccent`：合法缓存、缺字段、非法色值、JSON 损坏、存储抛异常；
   - `applyAccent` 写入 5 个 CSS 变量和 `localStorage['dys:accent']`，`paintAccent` 不写缓存。
3. `tests/e2e/smoke.spec.ts`：
   - 替换第 52 行附近对 `index.html` 内联 `dataset.theme` 的检查：改为内联脚本读取 `dys:accent` 并设置 `--accent`。
   - 替换第 331 行附近的主题测试：mock hub 配置 `accent_color: "#3b82f6"`，首次加载后 `--accent` 为 `#3b82f6`、`dys:accent` 已缓存；刷新时在首帧（用 `addInitScript` 记录 `DOMContentLoaded` 时的计算值，或 MutationObserver）就是蓝色，而不是默认绿色。
   - 新增：无缓存时，配置响应延迟 800ms，挂载后的第一帧按钮/选中态颜色已是配置色（不会先渲染绿色再变）；配置请求失败时不把默认色写入缓存（已有缓存保持不变）。
   - 新增：1440px 和 390px 下点击「另外 N 个地区」前后，`[data-testid="world-map"]` 所在卡片高度不变，按钮文字变为「收起」，列表可内部滚动（`scrollHeight > clientHeight`），页面 `document.documentElement.scrollHeight` 不变。
   - 修复第 29 行「home renders four summary tiles…」的失败：先查清楚原因。如果是测试依赖了已改变的 DOM 或旧配置，就改测试；如果是产品代码的 bug，**不要改源码**，在报告里写清楚现象和定位。
4. 如果 mock hub 需要支持 `accent_color`，可以改 `tests/mock-hub/server.mjs`。

## 限制
只改 `tests/**`。不要改 `src/**`、`index.html`、`theme.json`，不要执行 git。

## 验收
- `npm test` 和 `npx playwright test` 全部通过（连跑两次 E2E 确认不抖动）。
- 报告：新增/修改的测试列表，第 29 行测试失败的原因。
- 回复最后一行写 `T55-DONE`。
