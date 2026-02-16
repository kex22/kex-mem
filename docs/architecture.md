# 三层架构

## OpenClaw 原始架构（完整参考）

OpenClaw 不只是三层记忆，而是一套 agent 文件操作系统：

### 身份层（静态，基本不变）

| 文件 | 用途 |
|---|---|
| SOUL.md | agent 的"宪法"：人格原则、边界、工具权限、记忆规则 |
| IDENTITY.md | agent 身份：名字、persona、emoji、头像 |
| USER.md | 人类用户画像：工作模式、偏好、时区、沟通风格 |
| TOOLS.md | 可用工具清单及本地配置 |
| AGENTS.md | 行为准则 |
| HEARTBEAT.md | 主动交互策略（定时检查等） |
| SKILL.md | 技能定义（每个技能一个文件夹） |

### 记忆层（动态，持续演化）

| 层 | 文件 | 特点 |
|---|---|---|
| Durable | MEMORY.md | 经提炼的长期知识，人类可编辑，仅私有会话加载 |
| Ephemeral | memory/YYYY-MM-DD.md | 每日 append-only 日志，自动加载当天+前一天 |

### 检索层

- SQLite + sqlite-vec（向量）+ FTS5（BM25）
- 混合搜索：向量语义 + BM25 关键词
- 文件写入后自动重新索引

### 关键机制：Pre-compaction Memory Flush

当会话接近 context limit 时：
1. 触发 "silent agentic turn"（用户不可见的内部操作）
2. Agent 自动审查当前上下文
3. 把重要信息写入 MEMORY.md（如果没什么重要的，返回 NO_REPLY）
4. 然后才执行 compaction（在 user-message 边界裁剪，保留消息首尾）

---

## kex-mem 架构（基于 OpenClaw 的简化适配）

我们是 Claude Code 插件，不是独立 agent OS。Claude Code 已经提供了身份层（用户自己的 CLAUDE.md），所以 kex-mem 只聚焦记忆管理。

### 映射关系

| OpenClaw | kex-mem | 说明 |
|---|---|---|
| SOUL.md | 不需要 | Claude Code 自身有 system prompt |
| IDENTITY.md | 不需要 | Claude 身份由 Anthropic 定义 |
| USER.md | memory/USER.md (可选) | 用户偏好，可手动创建 |
| MEMORY.md | memory/MEMORY.md | 持久记忆，核心 |
| daily logs | memory/YYYY-MM-DD.md | 每日日志，核心 |
| TOOLS.md | CLAUDE.md 中的 kex-mem 指令 | 告诉 Claude 有哪些命令可用 |
| hybrid search | SQLite FTS5 (v0.1) + sqlite-vec (v0.2) | 渐进式引入 |
| pre-compaction flush | kex-mem compact | 手动/Claude 触发，非自动 silent turn |

### 数据流

```
写入:
  Claude 决策/发现 → kex-mem log → memory/YYYY-MM-DD.md → FTS5 索引

读取:
  Claude 需要上下文 → kex-mem recall / search → stdout → Claude context

整理:
  旧日志积累 → kex-mem compact → Claude 提炼 → 更新 MEMORY.md → 归档旧日志

索引:
  memory/*.md 变更 → kex-mem index → SQLite FTS5 (+ sqlite-vec v0.2)
```

### 目录结构

```
project-root/
├── CLAUDE.md                      # 含 kex-mem 使用指令（Claude Code 自动加载）
├── memory/
│   ├── MEMORY.md                  # 持久记忆（Git tracked）
│   ├── USER.md                    # 用户偏好（可选，Git tracked）
│   ├── 2026-02-15.md              # 今日日志（Git tracked）
│   ├── 2026-02-14.md              # 昨日日志（Git tracked）
│   ├── archive/                   # compact 归档（Git tracked）
│   │   └── 2026-01.md
│   ├── .longmem.db                # 搜索索引（gitignore，可重建）
│   └── .hooks/                    # hook 脚本（gitignore）
│       └── post-tool.sh
└── .claude/
    └── settings.local.json        # hook 配置（可选）
```

### 上下文注入

不依赖 MCP，不依赖常驻进程：

1. **CLAUDE.md** — `kex-mem init` 注入指令，Claude Code 每次会话自动加载
2. **Bash tool** — Claude 根据指令自主调用 kex-mem CLI
3. **stdout** — CLI 输出直接进入 Claude 上下文

```
会话开始
  → Claude 读到 CLAUDE.md 中的 kex-mem 指令
  → 执行 kex-mem recall 加载近期上下文
  → 工作中按需 kex-mem search / kex-mem log
  → 会话结束前 kex-mem log 记录重要决策
```

### 与 OpenClaw 的关键差异

| 方面 | OpenClaw | kex-mem |
|---|---|---|
| 定位 | 独立 agent OS | Claude Code CLI 插件 |
| 身份管理 | SOUL.md + IDENTITY.md | 不需要，Claude Code 自带 |
| 上下文注入 | 自有 agent runner | 利用 Claude Code 原生 CLAUDE.md + Bash |
| pre-compaction | 自动 silent agentic turn | 手动 kex-mem compact（Claude 可主动调用） |
| 搜索 | 内置混合搜索 | CLI 命令，按需调用 |
| 部署 | 独立服务 | npm install -g，零配置 |
