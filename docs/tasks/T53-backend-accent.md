# T53 · 自定义主题色 + 首帧不闪色（后端会话）

用户反馈：①每次刷新会先显示默认颜色；②预设颜色偏深，要求改成后台自定义色值。先读 `docs/SPEC-v3.md` 第 5 节（新的接口约定，Antigravity 同时按它改页面）。theme.json 已由规划者改好（`accent_color`），可读不可改。

## 要做的
1. 新建 `src/lib/theme.ts`：`resolveAccent`、`accentPalette`、`applyAccent`，签名和规则见 SPEC-v3 §5。对比度按 WCAG 相对亮度计算；加深用 HSL 降亮度或向黑色混合均可，保持色相。
2. `config.ts`：`accent_color` 用 `resolveAccent` 校验；删除 `theme`/`ThemeKey`/`resolveTheme`。
3. `app-state.svelte.ts`：配置返回后 `applyAccent(accentPalette(config.accent_color))`；删除 `data-theme` 和 `dys:theme` 逻辑。
4. `main.ts`：`localStorage['dys:accent']` 没有有效缓存时，等 `loadSiteConfig()` 返回（最多 1500ms）再挂载，并在挂载前应用调色板；有缓存时立即挂载。不要因此推迟 `/api/nodes` 等请求的发出时间。
5. 在报告里给出这几个输入的调色板结果：`#10b981`、`#3b82f6`、`#8b5cf6`、`#f59e0b`、`#e11d48`、`#facc15`、`#09090b`，以及 `strong` 对白色、`text` 对 `soft` 的对比度。
6. 只改 `src/lib/**`、`src/main.ts`；体积保持 `check-size` 无 WARN。不要改 `.svelte`、`app.css`、`index.html`、`tests/**`、`theme.json`，不要执行 git。

## 完成信号
回复最后一行写 `T53-DONE`，并创建空文件 `docs/tasks/T53.done`。
