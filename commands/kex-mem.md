# /kex-mem

Local long-term memory tool. Use these commands via Bash:

## Quick Reference

- `kex-mem recall` — recent logs (today + yesterday)
- `kex-mem recall --durable` — durable memory (MEMORY.md)
- `kex-mem recall --user` — user preferences (USER.md)
- `kex-mem recall --week` — past 7 days
- `kex-mem recall 2025-01-15` — specific date
- `kex-mem log "message" --tag decision` — record a memory
- `kex-mem search "query"` — full-text search
- `kex-mem index` — incremental index (mtime-based)
- `kex-mem index <file>` — index single file
- `kex-mem index --full` — full rebuild
- `kex-mem compact --auto` — archive old logs by month
- `kex-mem compact --smart` — output structured prompt for LLM compaction

## Tags

`decision` | `bug` | `convention` | `todo`

## Workflow

1. Session start: `kex-mem recall`
2. During work: `kex-mem log "..." --tag <tag>`
3. Session end: log unresolved items and key decisions
