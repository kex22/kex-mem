import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { existsSync, readFileSync, statSync } from "node:fs";
import { makeTempProject, cleanTempProject, captureOutput } from "../helpers.js";
import { initCommand } from "../../src/commands/init.js";
import {
  CLAUDE_MD_MARKER_START,
  CLAUDE_MD_MARKER_END,
  CLAUDE_MD_INJECTION,
  MEMORY_MD_TEMPLATE,
  USER_MD_TEMPLATE,
} from "../../src/lib/config.js";

describe("initCommand", () => {
  let tmp: string;
  let origCwd: string;

  beforeEach(() => {
    tmp = makeTempProject();
    origCwd = process.cwd();
    process.chdir(tmp);
  });

  afterEach(() => {
    process.chdir(origCwd);
    cleanTempProject(tmp);
  });

  test("creates memory directory", () => {
    // makeTempProject already creates memory/, remove it to test init
    const { rmSync } = require("node:fs");
    rmSync(join(tmp, "memory"), { recursive: true });
    captureOutput(() => initCommand({}));
    expect(existsSync(join(tmp, "memory"))).toBe(true);
  });

  test("creates MEMORY.md with template", () => {
    const { rmSync } = require("node:fs");
    rmSync(join(tmp, "memory", "MEMORY.md"), { force: true });
    captureOutput(() => initCommand({}));
    const content = readFileSync(join(tmp, "memory", "MEMORY.md"), "utf-8");
    expect(content).toBe(MEMORY_MD_TEMPLATE);
  });

  test("creates SQLite database", () => {
    captureOutput(() => initCommand({}));
    expect(existsSync(join(tmp, "memory", ".kex-mem.db"))).toBe(true);
  });

  test("creates CLAUDE.md with injection", () => {
    captureOutput(() => initCommand({}));
    const content = readFileSync(join(tmp, "CLAUDE.md"), "utf-8");
    expect(content).toContain(CLAUDE_MD_MARKER_START);
    expect(content).toContain(CLAUDE_MD_MARKER_END);
    expect(content).toContain("kex-mem recall");
  });

  test("appends to existing CLAUDE.md", () => {
    const { writeFileSync } = require("node:fs");
    writeFileSync(join(tmp, "CLAUDE.md"), "# My Project\n\nExisting content.\n", "utf-8");
    captureOutput(() => initCommand({}));
    const content = readFileSync(join(tmp, "CLAUDE.md"), "utf-8");
    expect(content).toContain("# My Project");
    expect(content).toContain("Existing content.");
    expect(content).toContain(CLAUDE_MD_MARKER_START);
  });

  test("replaces existing injection on re-init", () => {
    captureOutput(() => initCommand({}));
    captureOutput(() => initCommand({}));
    const content = readFileSync(join(tmp, "CLAUDE.md"), "utf-8");
    // Should only have one copy of the markers
    const startCount = content.split(CLAUDE_MD_MARKER_START).length - 1;
    expect(startCount).toBe(1);
  });

  test("does not overwrite existing MEMORY.md", () => {
    const { writeFileSync } = require("node:fs");
    writeFileSync(join(tmp, "memory", "MEMORY.md"), "# Custom\n\nMy notes", "utf-8");
    captureOutput(() => initCommand({}));
    const content = readFileSync(join(tmp, "memory", "MEMORY.md"), "utf-8");
    expect(content).toBe("# Custom\n\nMy notes");
  });

  test("prints initialization messages", () => {
    const { rmSync } = require("node:fs");
    rmSync(join(tmp, "memory"), { recursive: true });
    const { stdout } = captureOutput(() => initCommand({}));
    const output = stdout.join("\n");
    expect(output).toContain("Initialized");
    expect(output).toContain("kex-mem initialized.");
  });

  test("--hooks creates .claude-plugin directory", () => {
    captureOutput(() => initCommand({ hooks: true }));
    expect(existsSync(join(tmp, ".claude-plugin"))).toBe(true);
  });

  test("malformed CLAUDE.md with only start marker produces valid output", () => {
    const { writeFileSync } = require("node:fs");
    writeFileSync(
      join(tmp, "CLAUDE.md"),
      "# Project\n\n" + CLAUDE_MD_MARKER_START + "\nstale content without end marker",
      "utf-8",
    );
    captureOutput(() => initCommand({}));
    const content = readFileSync(join(tmp, "CLAUDE.md"), "utf-8");
    const startCount = content.split(CLAUDE_MD_MARKER_START).length - 1;
    const endCount = content.split(CLAUDE_MD_MARKER_END).length - 1;
    expect(startCount).toBe(1);
    expect(endCount).toBe(1);
    expect(content).toContain("# Project");
  });

  test("creates USER.md with template", () => {
    captureOutput(() => initCommand({}));
    const content = readFileSync(join(tmp, "memory", "USER.md"), "utf-8");
    expect(content).toBe(USER_MD_TEMPLATE);
  });

  test("does not overwrite existing USER.md", () => {
    const { writeFileSync } = require("node:fs");
    writeFileSync(join(tmp, "memory", "USER.md"), "# My Prefs\n\ncustom", "utf-8");
    captureOutput(() => initCommand({}));
    const content = readFileSync(join(tmp, "memory", "USER.md"), "utf-8");
    expect(content).toBe("# My Prefs\n\ncustom");
  });

  test("--hooks creates plugin.json with correct content", () => {
    captureOutput(() => initCommand({ hooks: true }));
    const pluginPath = join(tmp, ".claude-plugin", "plugin.json");
    expect(existsSync(pluginPath)).toBe(true);
    const content = JSON.parse(readFileSync(pluginPath, "utf-8"));
    expect(content.name).toBe("kex-mem");
    expect(content.hooks.PostToolUse).toBeDefined();
    expect(content.hooks.PostToolUse[0].matcher).toBe("Write|Edit");
  });

  test("--hooks creates post-tool.sh with executable permission", () => {
    captureOutput(() => initCommand({ hooks: true }));
    const hookPath = join(tmp, "hooks", "post-tool.sh");
    expect(existsSync(hookPath)).toBe(true);
    const content = readFileSync(hookPath, "utf-8");
    expect(content).toContain("kex-mem index");
    expect(content).toContain("REL_PATH");
    const stat = statSync(hookPath);
    // Check executable bit
    expect(stat.mode & 0o111).toBeGreaterThan(0);
  });

  test("CLAUDE.md injection includes recall --user", () => {
    captureOutput(() => initCommand({}));
    const content = readFileSync(join(tmp, "CLAUDE.md"), "utf-8");
    expect(content).toContain("recall --user");
  });
});
