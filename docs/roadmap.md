# 版本路线图

## v0.1 — 核心功能

FTS5 全文搜索，跑通三层记忆的基本流程。

功能：
- kex-mem init（目录结构、CLAUDE.md 注入、SQLite FTS5）
- kex-mem log（每日日志写入 + 索引更新）
- kex-mem search（FTS5 BM25 搜索）
- kex-mem recall（查看日志 / MEMORY.md）
- kex-mem index（重建索引）
- kex-mem compact（输出旧日志供整理 + --auto 归档）

技术栈：
- Bun / Node.js 双运行时支持
- SQLite FTS5（porter + unicode61）
- Commander.js
- tsup 打包

发布：npm publish

## v0.2 — 混合搜索 ✓

加入向量语义搜索，参考 OpenClaw 的 70/30 权重方案。

新增：
- sqlite-vec 向量存储（自动检测，不可用时降级为纯 FTS5）
- `kex-mem config set embedding local|openai` 启用向量搜索
- embedding 可插拔：本地 Xenova/gte-small (@huggingface/transformers, 384维) / OpenAI text-embedding-3-small (1536维)
- 混合排序：向量 70% + BM25 30%，RRF 融合
- `kex-mem config` 管理 embedding 来源和 API key
- OpenAI API key 支持配置文件或 `OPENAI_API_KEY` 环境变量

技术新增：
- @huggingface/transformers（本地 ONNX embedding）
- sqlite-vec 扩展

## v0.3 — 自动化增强

减少手动操作，让记忆管理更自动。

新增：
- PostToolUse hook 自动捕获 Claude 文件操作
- `kex-mem compact --smart`：调用 LLM 自动提炼旧日志到 MEMORY.md
- memory/USER.md 支持（用户偏好）
- 增量索引优化（watch 模式可选）

## 未来考虑

- Zvec 替换 sqlite-vec（待生态成熟）
- 多项目全局记忆（跨项目搜索）
- Web UI（本地查看记忆时间线）
- 其他 AI 工具支持（Cursor、Windsurf 等）
