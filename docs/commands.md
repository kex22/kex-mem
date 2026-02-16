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
4. 创建 SQLite 数据库 `memory/.kex-mem.db`，建立 FTS5 表
5. 检测 sqlite-vec 可用性，输出提示
6. 在 CLAUDE.md 中注入 kex-mem 使用指令（`<!-- kex-mem:start/end -->` 标记）
7. `--hooks`：创建 `.claude-plugin` 目录，提示配置 PostToolUse hook

输出：
```
Created memory/
Created memory/MEMORY.md
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
```

行为：
1. 向量搜索启用时：生成查询 embedding，混合搜索（RRF 融合 BM25 30% + 向量 70%）
2. 向量搜索未启用时：FTS5 MATCH 查询，BM25 排序
3. 返回 top N 结果（默认 10）
4. 用 snippet() 提取匹配上下文

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
```

行为：
- 无参数：读取今天和昨天的日志文件，输出原始 Markdown
- 指定日期：读取该日期的日志
- `--week`：最近 7 天，每天完整内容，`---` 分隔
- `--durable`：输出 memory/MEMORY.md 内容

无日志时：
```
No log for 2026-02-10.
```

## kex-mem index

从 Markdown 文件重建搜索索引。

```bash
kex-mem index
```

行为：
1. 扫描 `memory/*.md`
2. 提取标题（首个 # 标题）和正文
3. 写入 FTS5 表（事务批量插入）
4. 向量搜索启用时：批量生成 embedding，写入 vec_entries

输出：
```
Indexed 47 files.
```

## kex-mem compact

整理旧日志到持久记忆。

```bash
kex-mem compact              # 列出可归档的旧日志
kex-mem compact --auto       # 自动按月归档
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

## 设计原则

- **输出极简**：每个 token 都占 Claude 的上下文窗口，能省则省
- **无颜色**：Claude 读 stdout 不需要 ANSI escape codes
- **快速启动**：每次调用都是新进程，冷启动要快（<100ms）
- **幂等安全**：重复执行不会破坏数据（index 可重建，log 只追加）
- **失败友好**：未初始化时给出明确提示，索引损坏可重建
