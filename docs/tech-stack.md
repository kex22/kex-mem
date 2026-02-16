# 技术栈

## 运行时

**Bun** (首选) / Node.js (兼容)

- Bun 内置 `bun:sqlite`，无需 native addon
- 启动速度快，CLI 频繁调用场景关键
- 同样支持 npm 发布
- Node.js 通过 better-sqlite3 兼容

## 数据库

**SQLite** — 一个文件搞定全部存储

| 功能 | 实现 | 说明 |
|---|---|---|
| 全文搜索 | FTS5 | porter stemming + unicode61 tokenizer，内置 BM25 排序 |
| 向量搜索 | sqlite-vec (v0.2) | brute-force KNN，<100K 条记录性能足够 |
| 元数据 | 普通表 | file_meta 跟踪文件修改时间，支持增量索引 |

选择理由：
- OpenClaw 验证过的方案
- 单文件，零配置，可重建（从 Markdown 派生）
- FTS5 和 sqlite-vec 都是 SQLite 扩展，共用一个 db 文件

放弃的方案：
- Milvus — Zilliztech 商业推广，对本项目过度设计
- Zvec — 2026.02 刚开源，npm SDK 不成熟，观望中
- ChromaDB — 需要额外进程，违背轻量原则

## Embedding (v0.2)

**可插拔设计**，支持多种来源：

| 方案 | 模型 | 大小 | 说明 |
|---|---|---|---|
| 本地 (默认) | gte-small via transformers.js | ~70MB | 384 维，首次下载后缓存，完全离线 |
| API | OpenAI / Voyage | 0 | 需要 API key，按调用计费 |

混合搜索权重（参考 OpenClaw）：
- 向量语义：70%
- BM25 关键词：30%
- 结果归一化后加权合并

## CLI 框架

**Commander.js**

- npm 生态最成熟的 CLI 框架
- TypeScript 支持好（@commander-js/extra-typings）
- 零学习成本

## 构建工具

**tsup** (基于 esbuild)

- 打包 commander/glob 等纯 JS 依赖到单文件
- better-sqlite3 / bun:sqlite 标记为 external
- 自动注入 shebang (`#!/usr/bin/env node`)

## 依赖清单

### 运行时依赖

```
commander        — CLI 框架
better-sqlite3   — SQLite (Node.js 环境)
sqlite-vec       — 向量搜索扩展 (v0.2)
glob             — 文件扫描
```

### 开发依赖

```
typescript       — 类型系统
tsup             — 打包
@types/better-sqlite3
@types/node
vitest           — 测试
```

### v0.2 新增

```
@xenova/transformers  — 本地 embedding
sqlite-vec            — 向量存储
```

## 不引入的依赖

- date-fns — 用原生 Date + Intl 替代
- chalk/picocolors — Claude 读 stdout 不需要颜色
- any HTTP framework — 不需要 Web UI
- any daemon/process manager — 无常驻进程
