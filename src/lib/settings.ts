export function generateHooksSettings(): Record<string, any> {
  return {
    hooks: {
      SessionStart: [{
        matcher: "",
        hooks: [{ type: "command", command: "bash hooks/session-start.sh" }]
      }],
      PreCompact: [{
        matcher: "",
        hooks: [{ type: "command", command: "bash hooks/pre-compact.sh" }]
      }]
    }
  };
}

const KEX_MEM_HOOK_COMMANDS = [
  "bash hooks/session-start.sh",
  "bash hooks/pre-compact.sh",
];

function isKexMemHook(hook: any): boolean {
  return hook?.type === "command" && KEX_MEM_HOOK_COMMANDS.includes(hook?.command);
}

// Shallow merge — caller should not reuse `existing` after calling this.
export function mergeSettings(existing: Record<string, any>, hooks: Record<string, any>): Record<string, any> {
  const result = { ...existing };
  const newHooks = hooks.hooks as Record<string, any[]>;

  if (!result.hooks) {
    result.hooks = { ...newHooks };
    return result;
  }

  result.hooks = { ...result.hooks };

  for (const [event, entries] of Object.entries(newHooks)) {
    const existingEntries = result.hooks[event] as any[] | undefined;
    if (!existingEntries) {
      result.hooks[event] = entries;
      continue;
    }

    // Replace existing kex-mem entries, keep others.
    // Assumes kex-mem hooks occupy their own entry (not mixed with other commands).
    const filtered = existingEntries.filter((entry: any) => {
      const entryHooks = entry.hooks as any[] | undefined;
      if (!entryHooks) return true;
      return !entryHooks.some(isKexMemHook);
    });

    result.hooks[event] = [...filtered, ...entries];
  }

  return result;
}
