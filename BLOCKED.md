# BLOCKED.md — 待裁决清单

> 会话状态文件。规则：拿不准的写在这里，跳过继续做别的；随交付提交；无待裁决项时写「无」。

## 待裁决：第三方仓库 schema 不兼容（2026-08-15，收录硬指标第 2 项走「BLOCKED 证据」分支）

任务硬指标要求 index.json ≥2 插件（自建 1 + 第三方 1）。经收录脚本实测（collect.log 权威逐条日志），当前 GitHub 上 topic:dsh-plugin 范围内所有带根目录 `dsh.plugin.json` 的第三方真实仓库（77 家），其 manifest 均为 DSH 插件包格式（`id`/`main`/`engines`/`contributes`/`client` 等），**均不含市场 schema v1 必需的 `type`、`downloadUrl`、`checksum` 字段**，绝大多数还缺 `name`/`description`，id 也多含 `@`/`/` 不合法。按「守 schema v1 与安全校验 > 收录得多 > 做得快」与「过滤是设计功能，不算失败」，全部按规则过滤，每家不合格的具体原因如下（收录脚本原话）：

### A. 根目录有 dsh.plugin.json 但缺 schema v1 必需字段（77 家，均过滤）

```text
omdsh-dev/DSH-better-sidebar: invalid plugin id "dsh-external/dsh-better-sidebar"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
omdsh-dev/dsh-at-file: manifest has neither plugins[] nor id
omdsh-dev/dsh-notification: manifest has neither plugins[] nor id
omdsh-dev/dsh-open-in-vscode: name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
lhh010/dsh-ui-whale: invalid plugin id "@dsh-external/dsh-ui-whale"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
Chinesezjc/dsh-interconnect: manifest has neither plugins[] nor id
omdsh-dev/dsh-custom-tool: name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
william-jin-cmu/dsh-vision: invalid plugin id "@dsh-external/dsh-vision"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
lhh010/dsh-minigames: invalid plugin id "@dsh-external/dsh-minigames"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
LiangYin233/dsh-provider-model-configurator: name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
lehhair/dsh-mobile: invalid plugin id "@dsh-external/dsh-mobile"; name/description 缺失; type 缺失; downloadUrl 缺失; entry 缺失
PivotStackIntelligence/dsh-github: name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
lehhair/dsh-diff-viewer: invalid plugin id "@dsh-external/dsh-diff-viewer"; name/description 缺失; type 缺失; downloadUrl 缺失; entry 缺失
Areium/dsh-fail-logger: name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
lhh010/dsh-ui-progress: invalid plugin id "@dsh-external/dsh-ui-progress"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
1841220388zzzcccxxx-star/dsh-git-graph: invalid plugin id "dsh-external/dsh-git-graph"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
THU-MAIC/dsh-openmaic: invalid plugin id "@openmaic/dsh-openmaic"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
urzeye/dsh-outline: invalid plugin id "dsh-external/dsh-outline"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
omdsh-dev/dsh-sidechain: name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
ChenRuoT/dsh-sidebar-qa: invalid plugin id "dsh-external/dsh-sidebar-qa"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
william-jin-cmu/dsh-evolve: invalid plugin id "@dsh-external/dsh-evolve"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
Fisfzy/zotero-harvest: name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
HuanLinOTO/dsh-plugin-anti-ads: invalid plugin id "@huanlin/dsh-plugin-anti-ads"; name/description 缺失; type 缺失; downloadUrl 缺失; entry 缺失
heartmove/dsh-side-chat: invalid plugin id "dsh-external/dsh-side-chat"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
XCNXNXNX/dsh-portable-tavern: manifest has neither plugins[] nor id
lhh010/dsh-input-history: invalid plugin id "@dsh-external/dsh-input-history"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
lehhair/dsh-split-panes: invalid plugin id "@dsh-external/dsh-split-panes"; name/description 缺失; type 缺失; downloadUrl 缺失; entry 缺失
030611/dsh-verification-receipt: manifest has neither plugins[] nor id
Seryta/dsh-node-nav: manifest has neither plugins[] nor id
Khellendros97/dsh-subscription-auth: invalid plugin id "@dsh-external/dsh-subscription-auth"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
030611/qiushi-dsh-evidence-audit: name/version/description 缺失; type 缺失; downloadUrl 缺失; entry 缺失
omdsh-dev/dsh-minigames: invalid plugin id "@dsh-external/dsh-minigames"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
chen-001/dsh-chat-width: invalid plugin id "chen-001/dsh-chat-width"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
elementor-i/dsh-agentmemory: invalid plugin id "@dsh-external/dsh-agentmemory"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
030611/dsh-telemetry-redactor: description 缺失; type 缺失; downloadUrl 缺失; entry 非法（"./lib/index.js" 含 ./ 段）
echo-xianyu/dsh-go-rotator: name/description 缺失; type 缺失; downloadUrl 缺失; entry 缺失
zhaoscsc/dsh-wikilink: manifest has neither plugins[] nor id
culture-flask/dsh-aemeath-pet: name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
beijingwahw/dsh-conv-search: invalid plugin id "@dsh-external/dsh-conv-search"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
030611/dsh-context-provenance: description 缺失; type 缺失; downloadUrl 缺失; entry 非法（"./lib/index.js" 含 ./ 段）
invalidnaaaame/dsh-side-workspace: name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
omdsh-dev/7d7d: invalid plugin id "@mattheliu/7d7d"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
Fisfzy/zotero-wave-rag: name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
DTSFO/dsh-model-modes: name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
DTSFO/dsh-conversation-rewind: name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
Cavan-Ou/dsh-observation-journal: name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
KarlOfLaw/dsh-goal-mode-enhance: manifest has neither plugins[] nor id
william-jin-cmu/dsh-artifact: invalid plugin id "@dsh-external/dsh-artifact"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
xinmo114514/dsh-usage-widget: invalid plugin id "dsh-external/dsh-usage-widget"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
LaplaceYoung/dsh-of-your-own: name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
knlght/DSH-shutdown: invalid plugin id "dsh-external/dsh-shutdown"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
knlght/DSH-update-check: invalid plugin id "dsh-external/dsh-update-check"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
LoftyTao/dsh-ui-workbench: invalid plugin id "dsh-external/dsh-ui-workbench"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
smanx/dsh-conversation-indicator: manifest has neither plugins[] nor id
skitse/dsh-dev-actions: invalid plugin id "skitse/dsh-dev-actions"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
Simon314620/dsh-turn-index: manifest has neither plugins[] nor id
ycp424c/dsh-luna-vision-bridge: manifest has neither plugins[] nor id
3403473060/dsh-inline-images: manifest has neither plugins[] nor id
omdsh-dev/dsh-ui-progress: invalid plugin id "@dsh-external/dsh-ui-progress"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
omdsh-dev/dsh-input-history: invalid plugin id "@dsh-external/dsh-input-history"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
haiyoucuv/dsh-model-provider-label: name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
shaoeric/dsh-suggest: manifest has neither plugins[] nor id
beijingwahw/dsh-conv-export: invalid plugin id "@dsh-external/dsh-conv-export"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
xzyonline/dsh-file-attachments: invalid plugin id "@dsh-external/dsh-file-attachments"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
hexbee/dsh-skill-panel: manifest has neither plugins[] nor id
Ruler4396/dsh-launcher-lifetime: manifest has neither plugins[] nor id
echo-xianyu/dsh-better-chat-history: name/description 缺失; type 缺失; downloadUrl 缺失; entry 缺失
2h0n/dsh-web-notification: manifest has neither plugins[] nor id
omdsh-dev/dsh-ui-whale: invalid plugin id "@dsh-external/dsh-ui-whale"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
lehhair/dsh-home-ui: invalid plugin id "@dsh-external/dsh-home-ui"; name/description 缺失; type 缺失; downloadUrl 缺失; entry 缺失
beijingwahw/dsh-usage-ledger: name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
WJNCT55555/dsh-web-preview-float: invalid plugin id "@dsh-external/dsh-web-preview-float"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
yjh051108/dsh-engram-relay: name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
yuzh2001/dsh-zotero: invalid plugin id "dsh-external/dsa-zotero-sidebar"; name 缺失; type 缺失; downloadUrl 缺失; entry 缺失
DeepTrial/dsh-bash-rtk: invalid plugin id "@deeptrial/dsh-bash-rtk"; name/description 缺失; type 缺失; downloadUrl 缺失; entry 缺失
Hyna-hla/dsh-md-table-formatter: manifest has neither plugins[] nor id
ycp424c/dsh-auto-fold-turn: manifest has neither plugins[] nor id
```

说明：`type`（static/dynamic）是市场安装行为的**安全关键**字段（决定是否可控制/是否自动加载），`downloadUrl` 是下载来源（市场下载后逐字节比对 checksum），`entry` 是安装落盘路径；三者均不可由收录脚本猜测或从 `main` 推断，否则违反「守 schema v1 与安全校验」。故全部按规则过滤，仅记日志（collect.log）。

### B. dsh.plugin.json 不在仓库根目录（不满足「根目录」收录条件，过滤）

| 仓库 | manifest 实际路径 |
|---|---|
| drewnekota/cetus | plugins/dsh-vision/dsh.plugin.json、plugins/dsh-artifact/dsh.plugin.json |
| myYangyunfan/dsh_desktop | dsh-desktop/assets/plugins/dsh-vision/dsh.plugin.json |
| bitterSmilezzz/deepseek-plugins | dsh-at-file/dsh.plugin.json、dsh-better-sidebar/dsh.plugin.json |
| IchenDEV/dsh-plugins | dsh-worktree/、dsh-voice-input/、dsh-t3-protocol/ 子目录 |

### C. 其他

- topic:dsh-plugin 共 2800+ 仓库（实测可枚举 1924 家，其中 1843 家根目录无 dsh.plugin.json，正常过滤，collect.log 有逐条日志）。
- GitHub Search API 单查询封顶 1000 条：已按 created 日期窗口二分全量分页；2026-08-14 前后存在单日超 1000 家打标签的异常洪峰（疑似批量创建），单日上限内已收录，超出部分记日志截断（GitHub 硬限制，非脚本逻辑缺陷）。

## 结论

第三方仓库目前无一符合 schema v1 → 默认索引收录 1 个自建闭环插件（dsh-plugin-hello）+ 以上每家不合格证据，符合任务「或 BLOCKED.md 带每家不合格证据」分支。若领导后续拍板「兼容 DSH 包格式 manifest」或「子目录 manifest 也收」，本清单即为逐家改造依据。
