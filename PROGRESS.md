# PROGRESS.md

> 会话状态文件。本文件与 BLOCKED.md 因市场仓库的边界约束（市场仓库只许改 3 个文件、新建只许在 test/ 下），存放在索引仓库交付。

## 目标 / 顺序 / 最大风险（≤10 行）
- 目标：DSH 插件市场从手输仓库升级为 dsh-plugin 标签自动收录；索引仓库 V-dev-388/dsh-plugin-index 经 CI 定时收录并真发布。
- 顺序：任务 0 基线 → 任务 1 索引仓库+收录脚本（本地测绿再 push）→ 任务 2 自建闭环插件 dsh-plugin-hello → 任务 3 CI 上线+真收录 → 任务 4 市场端默认仓库 seed。
- 最大风险：Search API 未认证限速 10 req/min（认证 30）→ 收录脚本限并发≤8、退避重试、单仓库失败跳过不中断；第三方仓库可能全被规则过滤 → BLOCKED.md 记录每家不合格原因。
- 要求冲突时：守 schema v1 与安全校验 > 收录得多 > 做得快。

## 执行记录（每完成一项立刻更新）
- [x] 任务 0 基线（2026-08-15）：npm run verify 退出 0；gh auth 正常（V-dev-388）；V-dev-388/dsh-plugin-index 404 不存在。全部符合预期。
- [x] 任务 1 本地开发（2026-08-15）：索引仓库骨架 + validate.mjs + build-index.mjs + test/collect.test.mjs（红→绿已贴）+ 本地实跑 build-index 产出 index.json 并过 validate。
- [x] 任务 1 push（2026-08-15）：V-dev-388/dsh-plugin-index 已创建并 push（初始空 index.json + 全部脚本 + sync.yml）。
- [x] 任务 2（2026-08-15）：V-dev-388/dsh-plugin-hello 已创建（public，index.js + dsh.plugin.json 实算 checksum），raw URL 实测 200；已补打 dsh-plugin topic 标签。
- [x] 关键实测（2026-08-15）：topic:dsh-plugin 可枚举 1924 家；根目录有 dsh.plugin.json 的第三方共 77 家，全部缺 schema v1 必需字段（type/downloadUrl/checksum）→ 全部按规则过滤，逐家原因已写入 BLOCKED.md（收录硬指标第 2 项走 BLOCKED 证据分支）。
- [x] 任务 4 代码（2026-08-15）：市场端 defaultRepositoryUrl 常量 + config 覆盖 + load() ENOENT seed 分支（vendor 与 lib 两处一致），README 默认仓库小节；npm run verify 全绿；market 仓库已提交 "Seed default plugin market repository"。
- [ ] 任务 3：CI 上线与真收录（workflow_dispatch；hello 带 topic 后的本地复跑确认中）
- [ ] 任务 4 收尾：真机复验归领导（本环境摸不到 DSH 运行时，以静态断言 + verify 验收）
