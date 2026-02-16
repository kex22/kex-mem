# kex-mem

本地长期记忆 CLI 工具，为 AI 编程助手（Claude Code 等）提供跨会话记忆能力。

基于三层记忆架构：

| 层 | 存储 | 用途 |
|---|---|---|
| Durable | `memory/MEMORY.md` | 长期决策、约定、架构 |
| Ephemeral | `memory/YYYY-MM-DD.md` | 每日工作日志 |
| Deep Search | `memory/.longmem.db` | SQLite FTS5 全文检索 |

Markdown 是数据源，SQLite 只是搜索索引。人类和 AI 都能直接读写。

## 安装

```bash
# 需要 Bun (内置 SQLite)
bun install -g longmem
```

## 快速开始

```bash
# 在项目根目录初始化
longmem init

# 记录
longmem log "选择 Bun 作为运行时" --tag decision
longmem log "修复了路径解析的 bug" --tag bug

# 查看近期日志
longmem recall            # 今天 + 昨天
longmem recall --week     # 最近 7 天
longmem recall --durable  # 长期记忆

# 全文搜索
longmem search "Bun"
longmem search "路径" --limit 20

# 重建索引
longmem index

# 归档旧日志
longmem compact           # 预览
longmem compact --auto    # 按月归档
```

## 标签

| 标签 | 用途 |
|---|---|
| `decision` | 技术决策及理由 |
| `bug` | Bug 及修复方式 |
| `convention` | 项目约定和模式 |
| `todo` | 待办和后续跟进 |

## Claude Code 集成

`longmem init` 会自动向项目 `CLAUDE.md` 注入使用说明，Claude Code 加载后即知道如何调用。

同时提供 `.claude-plugin/plugin.json`，支持：
- `/longmem` 斜杠命令
- `PostToolUse` hook（Write/Edit 后自动重建索引）

## 项目结构

```
src/
  cli.ts                 # Commander 入口
  commands/              # init, log, search, recall, compact, reindex
  lib/
    paths.ts             # 路径解析
    db.ts                # SQLite FTS5
    markdown.ts          # Markdown 读写
    config.ts            # 模板常量
tests/                   # 119 个单元测试
```

## 开发

```bash
bun install
bun run build
bun test
```

## 路线图

- **v0.1** — FTS5 全文搜索，6 个核心命令 ✅
- **v0.2** — sqlite-vec 向量搜索（可选）
- **v0.3** — `compact --smart`（LLM 自动提炼）

## License

MIT
