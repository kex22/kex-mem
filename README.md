# kex-mem

本地长期记忆 CLI 工具，为 AI 编程助手（Claude Code 等）提供跨会话记忆能力。

基于三层记忆架构：

| 层 | 存储 | 用途 |
|---|---|---|
| Durable | `memory/MEMORY.md` | 长期决策、约定、架构 |
| User | `memory/USER.md` | 用户偏好和习惯 |
| Ephemeral | `memory/YYYY-MM-DD.md` | 每日工作日志 |
| Deep Search | `memory/.kex-mem.db` | SQLite FTS5 + sqlite-vec 混合搜索 |

Markdown 是数据源，SQLite 只是搜索索引。人类和 AI 都能直接读写。

## 安装

```bash
# 需要 Bun (内置 SQLite)
bun install -g @kex22/kex-mem
```

## 快速开始

```bash
# 在项目根目录初始化
kex-mem init

# 记录
kex-mem log "选择 Bun 作为运行时" --tag decision
kex-mem log "修复了路径解析的 bug" --tag bug

# 查看近期日志
kex-mem recall            # 今天 + 昨天
kex-mem recall --week     # 最近 7 天
kex-mem recall --durable  # 长期记忆
kex-mem recall --user     # 用户偏好

# 全文搜索
kex-mem search "Bun"
kex-mem search "路径" --limit 20

# 索引
kex-mem index             # 增量索引（默认）
kex-mem index --full      # 全量重建

# 归档旧日志
kex-mem compact           # 预览
kex-mem compact --auto    # 按月归档
kex-mem compact --smart   # 输出结构化 prompt 供 LLM 提炼
```

## 标签

| 标签 | 用途 |
|---|---|
| `decision` | 技术决策及理由 |
| `bug` | Bug 及修复方式 |
| `convention` | 项目约定和模式 |
| `todo` | 待办和后续跟进 |

## Claude Code 集成

`kex-mem init` 会自动向项目 `CLAUDE.md` 注入使用说明，Claude Code 加载后即知道如何调用。

同时提供 `.claude-plugin/plugin.json`，支持：
- `/kex-mem` 斜杠命令
- `PostToolUse` hook（Write/Edit 后自动单文件索引）

运行 `kex-mem init --hooks` 自动安装 plugin.json 和 hook 脚本。

## 项目结构

```
src/
  cli.ts                 # Commander 入口
  commands/              # init, log, search, recall, compact, index, config
  lib/
    paths.ts             # 路径解析
    db.ts                # SQLite FTS5 + sqlite-vec
    markdown.ts          # Markdown 读写
    config.ts            # 模板常量
    config-store.ts      # 向量搜索配置
    embedder.ts          # Embedding 接口
tests/                   # 169 个单元测试
```

## 开发

```bash
bun install
bun run build
bun test
```

## 路线图

- **v0.1** — FTS5 全文搜索，6 个核心命令 ✅
- **v0.2** — sqlite-vec 混合搜索 + `kex-mem config` ✅
- **v0.3** — 增量索引 + PostToolUse hook + USER.md + `compact --smart` ✅

## License

MIT
