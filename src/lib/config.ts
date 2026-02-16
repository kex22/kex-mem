export const CLAUDE_MD_MARKER_START = "<!-- longmem:start -->";
export const CLAUDE_MD_MARKER_END = "<!-- longmem:end -->";

export const CLAUDE_MD_INJECTION = `${CLAUDE_MD_MARKER_START}
## longmem — Local Long-Term Memory

You have access to \`longmem\`, a local memory tool. Use it to persist and recall information across sessions.

### Commands

- \`longmem recall\` — show recent logs (today + yesterday)
- \`longmem recall --durable\` — show durable memory (MEMORY.md)
- \`longmem recall --week\` — show past 7 days
- \`longmem recall 2025-01-15\` — show specific date
- \`longmem log "message" --tag decision\` — record a memory (tags: decision, bug, convention, todo)
- \`longmem search "query"\` — full-text search across all memories
- \`longmem search "query" --limit 20\` — search with custom limit

### When to Record

- Important decisions and their rationale
- Bugs found and how they were fixed
- Project conventions and patterns
- TODOs and follow-ups

### Workflow

- At session start: run \`longmem recall\` to load recent context
- During work: \`longmem log\` important decisions and findings
- Before session end: record any unresolved items or key decisions
${CLAUDE_MD_MARKER_END}`;

export const MEMORY_MD_TEMPLATE = `# Durable Memory

Long-term facts, decisions, and conventions for this project.

## Decisions

## Conventions

## Architecture
`;
