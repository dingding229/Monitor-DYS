# T34 · v2.0 性能/资源基线（测试会话）

先读 `docs/SPEC-v2.0.md` 第 3 节。项目路径 `/Volumes/SSD/项目/monitor-theme`。v2.0 会重写全部 UI，需要在重写前量出 v1.6 的基线，之后用同一个脚本对比。

## 任务
1. 新增 `tests/perf/measure.mjs`（用 Playwright chromium，读取已构建的 `dist`，连 `tests/mock-hub`）：对 `normal`（默认场景）和 `many`（500 节点）两个场景各测 3 次取中位数，输出 JSON：
   - `firstCardMs`：导航到首张 `[data-testid=node-card]` 可见
   - `maxLongTaskMs`、`longTaskCount`：首屏后 10 秒内（PerformanceObserver longtask）
   - `heapMB`：60 秒后 `performance.memory.usedJSHeapSize`（或 CDP `Runtime.getHeapUsage`），先触发一次 GC（CDP `HeapProfiler.collectGarbage`）
   - `domNodes`：总 DOM 节点数；`domPerCard`：首张卡片 `querySelectorAll('*').length`
   - `cssGzip`、`jsEntryGzip`：读 dist 文件计算
   - 详情页：进入 `/node/<id>` 到首个 `[data-testid=chart]` 渲染的耗时 `detailChartMs`，以及离开详情页回到首页 30 秒后的堆（检查泄漏）`heapAfterDetailMB`
2. `package.json` 的 scripts 由 Claude 加；你在报告里写清楚运行命令（例如 `node tests/perf/measure.mjs --out docs/perf/x.json`）。
3. 跑出基线，保存到 `docs/perf/baseline-v1.6.json`（这是允许你写的唯一 `docs` 路径）。
4. 增加 `tests/perf/compare.mjs`：读两个 JSON，按 SPEC-v2.0 第 3 节的目标逐项打印 PASS/FAIL。
5. 不改 `src/**`。mock hub 如需改动可以改。整套性能测试单独运行，不进入 CI 的常规流程。

## 约束
- 文件归属：`tests/**`、`docs/perf/**`。不要执行 git。

## 验收
- 基线 JSON 已生成；报告里贴出基线表格和运行命令。
- `npx vitest run` 和 `npx playwright test` 仍然全部通过。
- 最后一行写 `T34-DONE`。

## 补充：基线用独立的 v1.6 构建
后端会话 T33 正在同时修改 `src/**`，所以不要用当前工作区的 `dist` 测基线。Claude 已把 v1.6.0 原样导出并构建到 `/Volumes/SSD/项目/monitor-theme-v16/dist`（只读，不要修改）。`measure.mjs` 必须支持 `--dist <path>` 参数，基线用这个目录测；之后对比 v2.0 时用工作区的 `dist`。
