# T52 · 体积留出余量（后端会话）

v2.0.0 发布在 GitHub Actions 上因体积检查失败（未生成 Release，标签已删除）。同一份构建产物（文件哈希完全相同），CI 的 Node 24 zlib 压缩结果比本地 Node 26 大约 0.5%：

| 组 | 本地 | CI | 预算 |
|---|---|---|---|
| 入口 | 41,761 | 41,884 | 42,000 |
| 首屏 | 59,866 | 60,053 | 60,000 |
| 详情 | 29,996 | 30,216 | 30,000 |

## 要做的
1. 在不改 `.svelte` 的前提下，把三组 JS 都压到**本地测量低于预算至少 1.5%**（入口 ≤ 41,370、首屏 ≤ 59,100、详情 ≤ 29,550）。优先考虑：
   - `vite.config.ts` 的压缩配置（例如改用 terser 并设置 `compress.passes`、`ecma: 2022`、`toplevel`，或调整当前 minifier 的选项），比较前后体积，选最小且不改变行为的方案；
   - `src/lib/**` 中可去除的重复代码。
2. 让本地检查能发现这类差异：`scripts/check-size.mjs` 增加一项「CI 余量」提示，例如任一组超过预算的 98.5% 时打印 WARN（不改变通过与否）。
3. 不要放宽预算，不要改 `.svelte`、`tests/**`、`theme.json`、版本号，不要执行 git。

## 验收
`npm run check`、`npm test`、`npm run build`、`node scripts/check-size.mjs`（无 WARN）、`npx playwright test` 全部通过，`npm run perf:compare` 全部 PASS。报告前后体积和所用方案。回复最后一行写 `T52-DONE`。
