# T54 · 自定义主题色的页面侧改动（Antigravity）

用户反馈：①每次刷新会先显示默认颜色；②预设颜色偏深，改为后台自定义色值。接口约定见 `docs/SPEC-v3.md` 第 5 节，后端（T53）同时在改 `src/lib`。

## 要做的
1. `index.html`：去掉 `data-theme` 属性和旧脚本；新的首帧内联脚本读 `localStorage['dys:accent']`（JSON），五个字段 `accent/strong/soft/border/text` 都匹配 `^#[0-9a-f]{6}$` 时，分别写入 html 的 `--accent`、`--accent-strong`、`--accent-soft`、`--accent-border`、`--accent-text`（try/catch）。
2. `app.css`：删除 6 个 `html[data-theme]` 块；`:root` 默认值改为 `#10b981` 的调色板（等 `docs/tasks/T53.done` 出现后，用 `accentPalette("#10b981")` 的实际结果填入）。检查所有用到 `--accent*` 的地方，浅色主题色（如 `#facc15`）时文字和按钮仍清晰（文字用 `--accent-text`，白字底色用 `--accent-strong`）。
3. `ChartCard.svelte`、`NodeDetail.svelte` 等读取 CSS 变量的组件：把监听 `data-theme` 改为监听 html 的 `style` 属性变化后重绘。
4. 截图到 `docs/design/v3/impl/accent/`：首页 1440 宽，分别用 `#10b981`、`#3b82f6`、`#8b5cf6`、`#f59e0b`、`#e11d48`（mock hub 配置 `accent_color`）。

## 验收
等 `T53.done` 出现后联调：`npm run check`、`npm run build`、`node scripts/check-size.mjs`（无 WARN）通过；测试中只因 `data-theme` 旧断言失败的列出来即可（测试会话会改）。不要改 `src/lib/**`、`tests/**`、`theme.json`，不要执行 git。回复最后一行写 `T54-DONE`。
