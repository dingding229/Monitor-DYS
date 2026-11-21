# T11（Antigravity）：v1.2 审核返工

工作目录 /Volumes/SSD/项目/monitor-theme，不要执行 git 命令。T9 整体做得很好：汇率折算、系统 logo、卡片底部、访客中文地区名、新地图都符合要求。下面 4 处需要修改：

1. **regionName 回退**：非法代码（如 `not-a-region`）应原样返回，现在被转成了大写 `NOT-A-REGION`。只在 `Intl.DisplayNames` 成功返回且结果不等于输入的大写形式时才使用返回值，否则返回原始输入。`npm test` 中的「falls back to the original invalid code」必须通过。
2. **`world-map` 的 testid 位置**：现在 `world-map` 放在同时包住地图和国家列表的外层，导致 390px 宽度时绘图区已经隐藏，但这个 testid 仍然可见。把 `world-map` 移到只包住 SVG 绘图区的元素上，国家列表保留 `country-list`。
3. **首页国家列表被截断**：12 个国家只显示了前 6 个，下面的被裁掉了。列表区域固定高度（与地图同高），内部纵向滚动（细滚动条），保证所有国家都能看到。
4. **详情页图表**：
   - 坐标轴刻度文字太小（约 8px），改为 11px，颜色用中性 500。
   - 4 张趋势图卡片下方仍有约 60px 空白：卡片高度跟随内容，不要固定最小高度；图表区固定 160px。

完成后运行 `npm run check && npm test && npm run build`，三项必须全部零错误。用 Mock Hub 的 normal 场景重新截图，更新 `docs/design/v1.2/home-1440.png`、`home-390.png` 和 `detail-1280-7d.png`。

最后单独一行回复 `T11-DONE`。
