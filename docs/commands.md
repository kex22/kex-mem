# CLI 命令设计

## kex-mem init

初始化项目记忆系统。

```bash
kex-mem init [--hooks]
```

行为：
1. 向上查找项目根目录（.git / package.json / CLAUDE.md）
2. 创建 `memory/` 目录
3. 创建 `memory/MEMORY.md`（初始模板）
4. 创建 `memory/USER.md`（用户偏好模板，不覆盖已有）
5. 创建 SQLite 数据库 `memory/.kex-mem.db`，建立 FTS5 表
6. 检测 sqlite-vec 可用性，输出提示
7. 在 CLAUDE.md 中注入 kex-mem 使用指令（`<!-- kex-mem:start/end -->` 标记）
8. `--hooks`：写入 `.claude-plugin/plugin.json`、`hooks/post-tool.sh`、`hooks/session-start.sh`、`hooks/session-end.sh`、`hooks/pre-compact.sh`（chmod +x），并生成 `.claude/settings.json`（含 SessionStart + PreCompact hooks，幂等合并已有内容）

输出：
```
Created memory/
Created memory/MEMORY.md
Created memory/USER.md
sqlite-vec detected. Enable vector search: kex-mem config set embedding local
Initialized memory/.kex-mem.db
Updated CLAUDE.md
kex-mem initialized.
```

## kex-mem log

追加记录到当天日志。

```bash
kex-mem log "内容"
kex-mem log --tag decision "选择 Bun 作为运行时"
kex-mem log --tag bug "修复 token 过期问题，根因是..."
kex-mem log --tag convention "API 错误统一用 RFC 7807"
kex-mem log --tag todo "需要补充单元测试"
```

行为：
1. 打开（或创建）`memory/YYYY-MM-DD.md`
2. 新文件写入标题 `# YYYY-MM-DD`
3. 追加带时间戳的条目：`## HH:MM\n[tag] 内容`
4. 更新 FTS5 索引（整个文件 delete + insert）

输出：
```
Logged to 2026-02-15
```

## kex-mem search

全文搜索所有记忆。

```bash
kex-mem search "关键词"
kex-mem search "database migration" --limit 5
kex-mem search "bug" --tag bug
```

行为：
1. 向量搜索启用时：生成查询 embedding，混合搜索（RRF 融合 BM25 30% + 向量 70%）
2. 向量搜索未启用时：FTS5 MATCH 查询，BM25 排序
3. 返回 top N 结果（默认 10）
4. 用 snippet() 提取匹配上下文
5. `--tag`：后过滤，只保留含指定 tag 的文件结果

输出（token 友好）：
```
[2026-02-10.md] >>>选择 PostgreSQL<<<，原因：JSONB 支持，生态成熟...
[MEMORY.md] 数据库：>>>PostgreSQL<<< 16 via Drizzle ORM...
```

无结果时：
```
No results.
```

FTS 查询语法错误时：
```
Invalid query: fts5: syntax error near "..."
```

## kex-mem recall

查看日志内容。

```bash
kex-mem recall              # 今天 + 昨天
kex-mem recall 2026-02-10   # 指定日期
kex-mem recall --week        # 最近 7 天（摘要视图）
kex-mem recall --durable     # 显示 MEMORY.md
kex-mem recall --user        # 显示 USER.md（用户偏好）
kex-mem recall --tag decision  # 按 tag 过滤
kex-mem recall --week --limit 20  # 截断输出
```

行为：
- 无参数：读取今天和昨天的日志文件，输出原始 Markdown
- 指定日期：读取该日期的日志
- `--week`：最近 7 天，每天完整内容，`---` 分隔
- `--durable`：输出 memory/MEMORY.md 内容
- `--user`：输出 memory/USER.md 内容
- `--tag <tag>`：解析日志条目，只输出匹配 tag 的条目（`--durable`/`--user` 下忽略）
- `--limit <n>`：截断输出到 N 行，被截断时追加 `... (N more lines)`

无日志时：
```
No log for 2026-02-10.
```

## kex-mem index

索引 Markdown 文件（增量模式为默认）。

```bash
kex-mem index                    # 增量索引（mtime 比对，跳过未变更）
kex-mem index 2026-02-15.md      # 单文件索引
kex-mem index --full             # 全量重建
```

行为：
- **增量模式**（默认）：比对 mtime，只处理变更文件 + 清理已删除文件
- **单文件模式**：只索引指定文件，文件不存在则从索引删除
- **全量重建**：清空 vec 后全量重建

输出：
```
Indexed 3 files (12 skipped, 1 removed).
Indexed 47 files (full rebuild).
Indexed 2026-02-15.md
```

## kex-mem compact

整理旧日志到持久记忆。

```bash
kex-mem compact              # 列出可归档的旧日志
kex-mem compact --auto       # 自动按月归档
kex-mem compact --smart      # 输出结构化 prompt 供 LLM 提炼
kex-mem compact --days 14    # 自定义阈值（默认 30 天）
```

**默认模式**（列出旧日志）：
```
12 logs older than 30 days:
  2026-01-01.md
  2026-01-02.md
  ...

Run with --auto to archive by month.
```

**--auto 模式**（按月归档）：
1. 按月合并日志到 `memory/archive/YYYY-MM.md`
2. 移动原始日志到 archive 目录
3. 输出归档统计

```
Archived 12 files for 2026-01
```

**--smart 模式**（LLM 辅助提炼）：
输出结构化 prompt 到 stdout，包含当前 MEMORY.md 和所有旧日志内容，供 LLM 读取后自行更新 MEMORY.md 并删除已处理日志。不调用任何 API。

## kex-mem config

查看或更新配置。

```bash
kex-mem config                          # 查看当前配置
kex-mem config set embedding local      # 启用本地 embedding (384维)
kex-mem config set embedding openai     # 启用 OpenAI embedding (1536维)
kex-mem config set openai-key sk-xxx    # 设置 OpenAI API key
```

行为：
- 无参数：输出 `memory/.kex-mem.json` 内容（JSON 格式）
- `set embedding`：切换 embedding provider，自动启用向量搜索，维度变化时提示重建索引
- `set openai-key`：保存 API key，提示将配置文件加入 .gitignore
- OpenAI API key 也支持 `OPENAI_API_KEY` 环境变量

输出示例：
```
Embedding provider: local (dimension: 384)
```

维度变化时：
```
Embedding provider: openai (dimension: 1536)
Dimension changed. Run `kex-mem index` to rebuild vector index.
```

## kex-mem todo

管理 TODO 待办事项。

```bash
kex-mem todo                        # 列出未完成 TODO
kex-mem todo --all                  # 列出所有 TODO（含已完成）
kex-mem todo --resolve "substring"  # 标记匹配的 TODO 为完成
```

行为：
- 扫描 `memory/` 下所有 `YYYY-MM-DD.md`，提取 `[todo]` 标签条目
- 默认只显示未完成的（不含 `[done]` 标记）
- `--all`：包含已完成的，已完成条目带 `[done]` 标记
- `--resolve`：找到最近一条消息包含该子串的未完成 TODO，在源文件行末追加 ` [done]`
- 按日期倒序输出

输出格式：
```
2026-02-15 14:30  Need to add unit tests
2026-02-14 10:00  Review PR #42
```

标记完成时：
```
Resolved: Need to add unit tests
```

无待办时：
```
No open TODOs.
```

## kex-mem brief

精简上下文输出，用于会话启动时快速恢复上下文。

```bash
kex-mem brief                # 默认：MEMORY.md 前 20 行 + 近 3 天日志 + 未完成 TODO
kex-mem brief --days 1       # 只看最近 1 天
kex-mem brief --lines 5      # MEMORY.md 最多 5 行
```

行为：
1. 读 MEMORY.md 前 N 行（默认 20，`--lines` 控制）
2. 读最近 N 天日志（默认 3，`--days` 控制），提取所有条目
3. 扫描所有日志提取未完成 TODO
4. 空 section 不输出

输出格式：
```
=== DURABLE ===
# Project Memory
## Decisions
- Use PostgreSQL with Drizzle ORM
... (15 more lines in MEMORY.md)

=== RECENT (3d) ===
# 2026-02-15
- 14:30 [decision] Chose Bun as runtime

=== TODO (2 open) ===
2026-02-14 11:00  Need to add unit tests
2026-02-10 09:30  Review error handling strategy
```

## 设计原则

- **输出极简**：每个 token 都占 Claude 的上下文窗口，能省则省
- **无颜色**：Claude 读 stdout 不需要 ANSI escape codes
- **快速启动**：每次调用都是新进程，冷启动要快（<100ms）
- **幂等安全**：重复执行不会破坏数据（index 可重建，log 只追加）
- **失败友好**：未初始化时给出明确提示，索引损坏可重建
