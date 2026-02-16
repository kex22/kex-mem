# /kex-mem

Local long-term memory tool. Use these commands via Bash:

## Quick Reference

- `kex-mem recall` — recent logs (today + yesterday)
- `kex-mem recall --durable` — durable memory (MEMORY.md)
- `kex-mem recall --week` — past 7 days
- `kex-mem recall 2025-01-15` — specific date
- `kex-mem log "message" --tag decision` — record a memory
- `kex-mem search "query"` — full-text search
- `kex-mem index` — rebuild search index
- `kex-mem compact --auto` — archive old logs by month

## Tags

`decision` | `bug` | `convention` | `todo`

## Workflow

1. Session start: `kex-mem recall`
2. During work: `kex-mem log "..." --tag <tag>`
3. Session end: log unresolved items and key decisions
