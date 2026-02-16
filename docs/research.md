# 调研笔记

## 现有方案对比

### claude-mem (thedotmack/claude-mem)

- 第三方 Claude Code 插件，非官方项目
- MCP Server 架构，3 个 tool 做渐进式披露：search → timeline → get_observations
- SQLite + ChromaDB 存储，AI 压缩约 10x
- 自动捕获 Claude 操作，被动记录
- Web UI (localhost:37777)
- Reddit 反馈：解决 session amnesia 有效，但"buggy as shit"，95% token 减少宣传被质疑

### OpenClaw (openclaw)

三层本地记忆架构，Markdown-first：

1. Ephemeral Memory — 每日 Markdown 日志 `memory/YYYY-MM-DD.md`，append-only
2. Durable Memory — `MEMORY.md` 存重要决策/偏好/约定，人类可读可编辑
3. Deep Knowledge — 混合搜索：BM25 (30%) + 向量语义搜索 (70%)

技术实现：
- 存储：SQLite + sqlite-vec（向量）+ FTS5（全文）
- Embedding：可插拔，支持本地模型 / OpenAI / Gemini / Voyage
- 记忆压缩：pre-compaction flush，接近 context limit 时写入持久层
- 整理：nightly cron 从日志提取关键信息更新 MEMORY.md
- 所有数据 Markdown + SQLite，可 Git 版本控制

### memsearch (zilliztech/memsearch)

- 受 OpenClaw 启发，Markdown-first
- 三层渐进式披露：自动 top-3 预览 → 按需完整段落 → JSONL 原始记录
- 有 Claude Code 插件
- 用 Milvus 做向量存储（Zilliztech 是 Milvus 母公司，商业推广目的）

### Mimir (SierraDevsec/mimir)

- 侧重多 agent 共享记忆
- DuckDB + Cloudflare bge-m3 向量搜索
- 有 VSCode 扩展和 Web Dashboard
- 更适合 swarm 场景，单人使用偏重

### Claude Code 内置 Auto Memory

- 路径：`~/.claude/projects/<project>/memory/MEMORY.md`
- 前 200 行自动加载到 system prompt
- Claude 自己写自己读，用户也可编辑
- 可通过 `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` 关闭

## 关键结论

1. OpenClaw 的 SQLite + sqlite-vec + FTS5 方案经过验证，是我们的参考基准
2. Markdown-first 是社区共识，透明、可控、可版本管理
3. MCP 不是必须的，CLI 更简洁，人和 AI 共用同一套命令
4. 向量搜索可以渐进式引入，FTS5 先跑起来
