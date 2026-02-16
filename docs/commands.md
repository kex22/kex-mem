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
4. 创建 SQLite 数据库 `memory/.longmem.db`，建立 FTS5 表
5. 在 CLAUDE.md 中注入 kex-mem 使用指令（`<!-- longmem:start/end -->` 标记）
6. 更新 .gitignore（排除 .longmem.db 等）
7. `--hooks`：安装 PostToolUse hook 到 `.claude/settings.local.json`

输出：
```
Initialized kex-mem in /path/to/project
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
Logged to memory/2026-02-15.md
```

## kex-mem search

全文搜索所有记忆。

```bash
kex-mem search "关键词"
kex-mem search "database migration" --limit 5
```

行为：
1. FTS5 MATCH 查询，BM25 排序
2. 返回 top N 结果（默认 10）
3. 用 snippet() 提取匹配上下文

输出（token 友好）：
```
Found 3 results for "database migration"

--- memory/2026-02-10.md (score: 1.23) ---
[decision] 选择 PostgreSQL，原因：JSONB 支持，生态成熟
迁移策略：Drizzle ORM + push-based migrations

--- memory/MEMORY.md (score: 0.87) ---
## 架构
数据库：PostgreSQL 16 via Drizzle ORM
```

无索引时：
```
No index found. Run "kex-mem index" first.
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
- `--week`：最近 7 天，每天只显示标题 + 前 5 行
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
1. 扫描 `memory/**/*.md`
2. 对比 file_meta 表中的 mtime，只重新索引修改过的文件
3. 提取标题（首个 # 标题）和正文
4. 写入 FTS5 表（事务批量插入）

输出：
```
Indexed 47 files (3 updated, 44 unchanged)
```

## kex-mem compact

整理旧日志到持久记忆。

```bash
kex-mem compact              # 输出旧日志内容，供 Claude 整理
kex-mem compact --auto       # 自动按月归档
kex-mem compact --days 14    # 自定义阈值（默认 7 天）
```

**默认模式**（输出供 Claude 处理）：
```
Found 12 daily logs older than 7 days.

Please review and extract key decisions, conventions, and architecture notes
into memory/MEMORY.md. Then delete processed logs.

--- memory/2026-02-01.md ---
[内容]

--- memory/2026-02-02.md ---
[内容]
...
```

**--auto 模式**（机械归档）：
1. 按月合并日志到 `memory/archive/YYYY-MM.md`
2. 删除原始日志文件
3. 重建索引

```
Archived 12 logs → memory/archive/2026-01.md
Re-indexed.
```

## 设计原则

- **输出极简**：每个 token 都占 Claude 的上下文窗口，能省则省
- **无颜色**：Claude 读 stdout 不需要 ANSI escape codes
- **快速启动**：每次调用都是新进程，冷启动要快（<100ms）
- **幂等安全**：重复执行不会破坏数据（index 可重建，log 只追加）
- **失败友好**：未初始化时给出明确提示，索引损坏可重建
