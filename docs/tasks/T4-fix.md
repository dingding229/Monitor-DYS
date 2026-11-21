# T4（Antigravity）：两处修复

工作目录 /Volumes/SSD/项目/monitor-theme。不要执行 git 命令。T1 已审核通过并提交，做得很好。Codex 已补全测试（`npm test` 107 项、`npm run test:e2e` 17 项）。

1. **图表填充色 bug**：`src/pages/NodeDetail.svelte` 第 500/516/539/555 行用 `${accent}1a` 拼透明色。只有 6 位 hex 时才有效；accent 是 `rebeccapurple`、`#abc`、`rgb(...)`、`oklch(...)` 等合法 CSS 颜色时会得到无效值，Canvas 会拒绝。
   新增 `src/lib/color.ts`，导出 `withAlpha(color: string, alpha: number): string`：在浏览器里把任意合法 CSS 颜色解析为 rgba（可用 1×1 canvas 的 fillStyle 回读，或者 getComputedStyle），解析失败时回退到默认主题色 `#2563eb`。把上述 4 处以及项目里其他手工拼接透明度的地方都改为调用它（用 grep 查一遍 `1a\``、`33\`` 之类的写法）。
   在 `tests/unit/color.test.ts` 加测试，覆盖 `#2563eb`、`#abc`、`rebeccapurple`、`rgb(1,2,3)`、非法值。jsdom 里没有 canvas 时要有合理的回退，测试必须能通过。
2. **开发依赖安全告警**：`npm audit` 报告 vitest 链路有 1 个中危和 2 个严重。把 vitest（以及相关的 vite / @sveltejs/vite-plugin-svelte，如有需要）升级到修复版本，要求 `npm audit` 为 0 个严重。不要动运行时依赖。
3. 最后依次运行并确认全部通过：`npm run check && npm test && npm run build && npm run test:e2e`。然后在 Antigravity 浏览器里，用 `node tests/mock-hub/server.mjs --scenario config --dist dist` 打开 /node/1，确认图表填充正常。

完成后在报告里列出改动和各命令的结果，最后回复 `T4-DONE`。
