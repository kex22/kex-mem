# longmem

Local long-term memory CLI tool + Claude Code plugin, based on a three-layer memory architecture (Durable / Ephemeral / Deep Search).

## Tech Stack

- TypeScript (ESM only)
- Bun (runtime, built-in SQLite with FTS5)
- Commander.js (CLI framework)
- tsup (build)
- Published via npm (`npm install -g kex-mem`)

## Coding Conventions

- ESM only (`"type": "module"` in package.json)
- No color output (no chalk, no ANSI codes) — keep output plain and pipe-friendly
- Minimal output — prefer terse, machine-readable results
- Use native `Date` — no date-fns or similar libraries
- No HTTP frameworks, no daemons, no background processes
- All paths resolved via `src/lib/paths.ts` relative to project root

## Project Structure

```
src/
  cli.ts              # Commander entry point
  commands/            # One file per CLI command
    init.ts, log.ts, search.ts, recall.ts, compact.ts, reindex.ts
  lib/
    paths.ts           # Path resolution (memory dir, db, MEMORY.md, daily logs)
    db.ts              # SQLite FTS5 init, upsert, search
    markdown.ts        # Markdown file read/write helpers
    config.ts          # Template constants (CLAUDE.md injection, MEMORY.md template)
```

## Three-Layer Memory

| Layer | Storage | Access |
|---|---|---|
| Durable | `memory/MEMORY.md` | `kex-mem recall --durable` |
| Ephemeral | `memory/YYYY-MM-DD.md` | `kex-mem recall` |
| Deep Search | `memory/.longmem.db` | `kex-mem search "query"` |

## Key Design Decisions

- CLI-first: works standalone for any AI tool or human use
- Claude Code integration via plugin.json + slash command + hooks (optional layer)
- Markdown-first: human-readable files are the source of truth; SQLite is a search index
- FTS5 with porter+unicode61 tokenizer for full-text search
- No vector search in v0.1 (planned for v0.2 with sqlite-vec)

## Reference

See `docs/` for architecture details, command specs, and roadmap.
