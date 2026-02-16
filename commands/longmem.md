# /longmem

Local long-term memory tool. Use these commands via Bash:

## Quick Reference

- `longmem recall` — recent logs (today + yesterday)
- `longmem recall --durable` — durable memory (MEMORY.md)
- `longmem recall --week` — past 7 days
- `longmem recall 2025-01-15` — specific date
- `longmem log "message" --tag decision` — record a memory
- `longmem search "query"` — full-text search
- `longmem index` — rebuild search index
- `longmem compact --auto` — archive old logs by month

## Tags

`decision` | `bug` | `convention` | `todo`

## Workflow

1. Session start: `longmem recall`
2. During work: `longmem log "..." --tag <tag>`
3. Session end: log unresolved items and key decisions
