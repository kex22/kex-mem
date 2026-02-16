export const CLAUDE_MD_MARKER_START = "<!-- kex-mem:start -->";
export const CLAUDE_MD_MARKER_END = "<!-- kex-mem:end -->";

export const CLAUDE_MD_INJECTION = `${CLAUDE_MD_MARKER_START}
## kex-mem — Local Long-Term Memory

You have access to \`kex-mem\`, a local memory tool. Use it to persist and recall information across sessions.

### Commands

- \`kex-mem recall\` — show recent logs (today + yesterday)
- \`kex-mem recall --durable\` — show durable memory (MEMORY.md)
- \`kex-mem recall --week\` — show past 7 days
- \`kex-mem recall 2025-01-15\` — show specific date
- \`kex-mem log "message" --tag decision\` — record a memory (tags: decision, bug, convention, todo)
- \`kex-mem search "query"\` — hybrid search (semantic + keyword) across all memories
- \`kex-mem search "query" --limit 20\` — search with custom limit
- \`kex-mem config\` — view current configuration
- \`kex-mem config set embedding local|openai\` — switch embedding provider

### When to Record

- Important decisions and their rationale
- Bugs found and how they were fixed
- Project conventions and patterns
- TODOs and follow-ups

### Workflow

- At session start: run \`kex-mem recall\` to load recent context
- During work: \`kex-mem log\` important decisions and findings
- Before session end: record any unresolved items or key decisions
${CLAUDE_MD_MARKER_END}`;

export const MEMORY_MD_TEMPLATE = `# Durable Memory

Long-term facts, decisions, and conventions for this project.

## Decisions

## Conventions

## Architecture
`;
