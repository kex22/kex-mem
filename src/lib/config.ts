export const CLAUDE_MD_MARKER_START = "<!-- kex-mem:start -->";
export const CLAUDE_MD_MARKER_END = "<!-- kex-mem:end -->";

export const CLAUDE_MD_INJECTION = `${CLAUDE_MD_MARKER_START}
## kex-mem — Local Long-Term Memory

You have access to \`kex-mem\`, a local memory tool. Use it to persist and recall information across sessions.

### Commands

- \`kex-mem brief\` — compact context summary (durable + recent + TODOs)
- \`kex-mem recall\` — show recent logs (today + yesterday)
- \`kex-mem recall --durable\` — show durable memory (MEMORY.md)
- \`kex-mem recall --user\` — show user preferences (USER.md)
- \`kex-mem recall --week\` — show past 7 days
- \`kex-mem recall --tag decision\` — filter by tag
- \`kex-mem recall 2025-01-15\` — show specific date
- \`kex-mem log "message" --tag decision\` — record a memory (tags: decision, bug, convention, todo)
- \`kex-mem search "query"\` — hybrid search (semantic + keyword) across all memories
- \`kex-mem search "query" --limit 20\` — search with custom limit
- \`kex-mem todo\` — list open TODOs
- \`kex-mem todo --resolve "substring"\` — mark a TODO as done
- \`kex-mem config\` — view current configuration
- \`kex-mem config set embedding local|openai\` — switch embedding provider

### When to Record

- Important decisions and their rationale
- Bugs found and how they were fixed
- Project conventions and patterns
- TODOs and follow-ups

### Workflow

- At session start: run \`kex-mem brief\` for quick context
- During work: \`kex-mem log\` important decisions and findings
- Before session end: record any unresolved items or key decisions
${CLAUDE_MD_MARKER_END}`;

export const MEMORY_MD_TEMPLATE = `# Durable Memory

Long-term facts, decisions, and conventions for this project.

## Decisions

## Conventions

## Architecture
`;

export const USER_MD_TEMPLATE = `# User Preferences

## Coding Style

## Communication Style

## Tools & Environment

## Notes
`;

export const PLUGIN_JSON_TEMPLATE = `{
  "name": "kex-mem",
  "description": "Local long-term memory for Claude Code",
  "version": "0.4.0",
  "skills": ["commands/kex-mem.md"],
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "command": "bash hooks/post-tool.sh"
    }]
  }
}
`;

export const POST_TOOL_HOOK_TEMPLATE = `#!/usr/bin/env bash
# PostToolUse hook: auto-index memory files after Write/Edit
# Called by Claude Code plugin when files in memory/ are modified

TOOL_NAME="$1"
FILE_PATH="$2"

case "$FILE_PATH" in
  */memory/*.md)
    REL_PATH="\${FILE_PATH##*/memory/}"
    kex-mem index "$REL_PATH" 2>/dev/null
    ;;
esac
`;

export const SESSION_START_HOOK = `#!/usr/bin/env bash
# Session start: output compact context summary
kex-mem brief 2>/dev/null
`;

export const SESSION_END_HOOK = `#!/usr/bin/env bash
# Session end: remind about open TODOs
TODOS=$(kex-mem todo 2>/dev/null)
if [ -n "$TODOS" ]; then
  echo "Open TODOs:"
  echo "$TODOS"
fi
`;
