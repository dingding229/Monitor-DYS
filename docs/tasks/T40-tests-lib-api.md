# T40 · 单元测试跟上 T38 的 lib 接口调整（测试会话）

T38 后端会话精简了 `src/lib`，导致 `npx vitest run` 现在 **25 条失败**（集中在 `tests/unit/api.test.ts` 和 `tests/unit/nodes.test.ts`）。后端报告：
- 已移除或收回的导出：`groupsOf`、`sample`、`speedHistory`、`loadConfig`、`cycleMonths`、`mergeNodes`、`NodeStoreOptions`、`ConnectionState`、`summarizePing`、`latencyColor`、`lossColor`。
- 旧测试调用了 `speedHistory.clear()`、`speedHistory.get()`、`sample()`，或断言 `store.connected`。改用 `connectionState === "live"`；WS 帧顺序通过节点状态更新来断言。

## 要做的
- 把这些测试改为通过公开接口验证同样的行为；已经不存在的内部细节就删除相应断言，不要为了测试去恢复导出。
- 不要改 `src/**`（UI 马上会整体重新设计，`.svelte` 会大改；只改 `tests/**`）。E2E 先不用动，等新 UI 完成后再统一更新。

## 验收
- `npx vitest run` 全部通过。最后一行写 `T40-DONE`。不要执行 git。
