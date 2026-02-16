import { describe, test, expect } from "bun:test";
import { generateHooksSettings, mergeSettings } from "../../src/lib/settings.js";

describe("generateHooksSettings", () => {
  test("returns correct structure", () => {
    const settings = generateHooksSettings();
    expect(settings.hooks).toBeDefined();
    expect(settings.hooks.SessionStart).toHaveLength(1);
    expect(settings.hooks.PreCompact).toHaveLength(1);
    expect(settings.hooks.SessionStart[0].hooks[0].command).toBe("bash hooks/session-start.sh");
    expect(settings.hooks.PreCompact[0].hooks[0].command).toBe("bash hooks/pre-compact.sh");
  });

  test("hooks have empty matcher", () => {
    const settings = generateHooksSettings();
    expect(settings.hooks.SessionStart[0].matcher).toBe("");
    expect(settings.hooks.PreCompact[0].matcher).toBe("");
  });

  test("hooks have type command", () => {
    const settings = generateHooksSettings();
    expect(settings.hooks.SessionStart[0].hooks[0].type).toBe("command");
    expect(settings.hooks.PreCompact[0].hooks[0].type).toBe("command");
  });
});

describe("mergeSettings", () => {
  test("empty existing -> generates full settings", () => {
    const hooks = generateHooksSettings();
    const result = mergeSettings({}, hooks);
    expect(result.hooks.SessionStart).toHaveLength(1);
    expect(result.hooks.PreCompact).toHaveLength(1);
  });

  test("preserves existing permissions", () => {
    const existing = {
      permissions: { allow: ["Bash(npm test)"] }
    };
    const hooks = generateHooksSettings();
    const result = mergeSettings(existing, hooks);
    expect(result.permissions).toEqual({ allow: ["Bash(npm test)"] });
    expect(result.hooks.SessionStart).toHaveLength(1);
  });

  test("preserves other hooks", () => {
    const existing = {
      hooks: {
        PostToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "echo done" }] }]
      }
    };
    const hooks = generateHooksSettings();
    const result = mergeSettings(existing, hooks);
    expect(result.hooks.PostToolUse).toHaveLength(1);
    expect(result.hooks.SessionStart).toHaveLength(1);
    expect(result.hooks.PreCompact).toHaveLength(1);
  });

  test("updates existing kex-mem hooks (idempotent)", () => {
    const existing = {
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
    const hooks = generateHooksSettings();
    const result = mergeSettings(existing, hooks);
    expect(result.hooks.SessionStart).toHaveLength(1);
    expect(result.hooks.PreCompact).toHaveLength(1);
  });

  test("preserves non-kex-mem hooks in same event", () => {
    const existing = {
      hooks: {
        SessionStart: [
          { matcher: "", hooks: [{ type: "command", command: "echo hello" }] },
          { matcher: "", hooks: [{ type: "command", command: "bash hooks/session-start.sh" }] }
        ]
      }
    };
    const hooks = generateHooksSettings();
    const result = mergeSettings(existing, hooks);
    expect(result.hooks.SessionStart).toHaveLength(2);
    expect(result.hooks.SessionStart[0].hooks[0].command).toBe("echo hello");
    expect(result.hooks.SessionStart[1].hooks[0].command).toBe("bash hooks/session-start.sh");
  });

  test("does not mutate original existing object", () => {
    const existing = { permissions: { allow: [] }, hooks: {} };
    const hooks = generateHooksSettings();
    mergeSettings(existing, hooks);
    expect(existing.hooks).toEqual({});
  });
});
