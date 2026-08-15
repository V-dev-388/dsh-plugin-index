# dsh-plugin-index

DSH 插件市场默认索引。任何 GitHub 公开仓库只要在根目录放一个可解析的 `dsh.plugin.json`（并给仓库打上 `dsh-plugin` 标签），就会被收录脚本自动收录进本索引，用户无需手动填写仓库地址。

- 索引文件（schema v1）：`https://raw.githubusercontent.com/V-dev-388/dsh-plugin-index/main/index.json`
- 本仓库：<https://github.com/V-dev-388/dsh-plugin-index>
- 自动收录：每 6 小时由 GitHub Actions 定时执行（也可手动 `workflow_dispatch` 触发）。

## dsh.plugin.json 约定

仓库根目录的 `dsh.plugin.json` 描述该仓库提供的插件，支持两种形态：

目录形态（与索引 schema v1 一致）：

```json
{
  "version": 1,
  "plugins": [
    {
      "id": "dsh-plugin-hello",
      "name": "Hello",
      "version": "1.0.0",
      "description": "一个示例插件。",
      "type": "static",
      "downloadUrl": "https://raw.githubusercontent.com/V-dev-388/dsh-plugin-hello/main/index.js",
      "checksum": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "entry": "index.js"
    }
  ]
}
```

单插件形态（省略 `version`/`plugins` 外壳，字段与目录形态中的单个条目相同）。

字段要求（schema v1）：

- `id`：`[a-z0-9][a-z0-9._-]{0,63}`，全索引唯一。
- `type`：`static` 或 `dynamic`。
- `downloadUrl`：必须为 HTTPS，指向可下载的插件文件（raw 文件或 release asset）。
- `checksum`：可选；小写 SHA-256 十六进制摘要。未填写时由收录脚本实算写入（算不出则过滤）。
- `entry`：相对路径，禁止绝对路径、反斜杠和 `..`。
- `permissions`、`config`、`controllable` 为可选字段。

## 收录规则

自动收录只接受同时满足以下条件的仓库：

1. 非 fork、非 archived，且有默认分支；
2. 根目录存在可解析且通过 schema v1 校验的 `dsh.plugin.json`；
3. `downloadUrl` 为 HTTPS 且内容可下载（HTTP 200）；
4. 未命中 `removed.json` 下架清单（按仓库名 `owner/repo` 或插件 `id` 匹配）；
5. 插件 `id` 不与他人冲突：冲突时保留先收录者，后见者记入日志跳过。

其他行为：

- 已收录但本轮不再合格的条目：跳过不删（下架只能通过 `removed.json` 手动执行）。
- 单个仓库探测/下载失败：记日志，跳过，不中断整个收录。
- 索引以原子写方式更新（临时文件 rename），CI 只在索引有变化时提交推送。
- 收录日志见每次 CI 运行输出（本地运行写入 `collect.log`）。

## 下架

把要下架的仓库名（`owner/repo`）或插件 `id` 追加进 `removed.json` 并提交，下次收录即生效：

```json
["owner/bad-repo", "some-plugin-id"]
```

## 本地复现与校验

```bash
# 无依赖校验（规则 = 本 README 的 schema v1 字段要求）
node scripts/validate.mjs index.json

# 本地收录（需要 GITHUB_TOKEN；只读 GitHub API，不改远程）
GITHUB_TOKEN=xxx node scripts/build-index.mjs

# 单元测试
node --test
```

## 手动触发收录

仓库 Actions 页 → `sync plugin index` → Run workflow。
