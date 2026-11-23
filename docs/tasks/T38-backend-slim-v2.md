# T38 · v2.0 返工：lib 体积与内存（后端会话）

T33 已审核通过并提交。Antigravity 已按新设计重写全部 `.svelte`（T35）。性能对比（`npm run perf` + `npm run perf:compare`，结果在 `docs/perf/current.json`）还有几项未达标：入口 JS 44.9KB（目标 ≤42KB）、首屏 62.3KB（≤60KB）、详情 chunk 32.6KB（≤30KB）、500 节点 60 秒后 JS 堆 10.16MiB（≤9.25MiB）。Antigravity 同时在精简组件；你负责 `src/lib/**` 这一侧。**本轮不要改任何 `.svelte`、`app.css`、`index.html`、`tests/**`。**

## 要做的
1. **lib 体积**：用 sourcemap 或 `rollup-plugin-visualizer` 一类的一次性分析（不要加进依赖，可以用 `npx`）找出入口和详情 chunk 中 lib 代码的占比。重点检查：`format.ts`、`app-state.svelte.ts`、`nodes.svelte.ts`、`ping.svelte.ts`、`api.ts`、`icons.ts`、`view-state.ts`、`config.ts`、`detail-series.ts`。合并重复逻辑，删除未使用导出（T33 列出的 `groupsOf`、`loadConfig`、`cycleMonths`、`mergeNodes`、`NodeStoreOptions`、`summarizePing` 等：只在测试里用到的导出，测试会话会同步调整，请在报告里列出最终删掉了哪些）。只在详情页用到的代码不能进入入口 chunk。
2. **内存**（mock `many`，500 节点）：用 CDP 堆快照，或者 `measure.mjs` 加一次 `--scenario many` 的临时对比，找出 lib 侧的主要持有者，例如：节点对象是否保留了原始 JSON 的多余字段、ping store 是否为每个节点保留了超过 12 个桶的历史、snapshot 序列化后是否还保留着字符串、Map/Set 在节点消失后是否清理、WS 帧是否在合并后仍被引用。修复 lib 侧可以修的部分。
3. `vite.config.ts`：确认 `build.target` 足够新（例如 `es2022`），避免不必要的降级代码；检查 modulePreload polyfill 是否可以关闭（只支持现代浏览器即可）。

## 验收
- `npm run check`、`npm test`（如果失败只是因为删除了仅测试使用的导出，在报告里列出，由测试会话处理）、`npm run build`。
- 报告：lib 各模块在入口和详情 chunk 中的体积（前后对比）、删除的导出、堆分析结论，以及你用堆快照得到的修复前后对比。**不要运行 `npm run perf`**：Antigravity 也在跑它，会互相干扰；最终性能对比由 Claude 来跑。
- 最后一行写 `T38-DONE`。不要执行 git。
