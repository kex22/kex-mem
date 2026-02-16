import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { makeTempProject, cleanTempProject, captureOutput } from "../helpers.js";
import { initCommand } from "../../src/commands/init.js";
import { logCommand } from "../../src/commands/log.js";
import { formatDate } from "../../src/lib/paths.js";

describe("logCommand", () => {
  let tmp: string;
  let origCwd: string;

  beforeEach(() => {
    tmp = makeTempProject();
    origCwd = process.cwd();
    process.chdir(tmp);
    captureOutput(() => initCommand({}));
  });

  afterEach(() => {
    process.chdir(origCwd);
    cleanTempProject(tmp);
  });

  test("creates daily log file", () => {
    captureOutput(() => logCommand("test entry", {}));
    const today = formatDate();
    expect(existsSync(join(tmp, "memory", `${today}.md`))).toBe(true);
  });

  test("daily log has date heading", () => {
    captureOutput(() => logCommand("test entry", {}));
    const today = formatDate();
    const content = readFileSync(join(tmp, "memory", `${today}.md`), "utf-8");
    expect(content).toContain(`# ${today}`);
  });

  test("entry includes timestamp", () => {
    captureOutput(() => logCommand("test entry", {}));
    const today = formatDate();
    const content = readFileSync(join(tmp, "memory", `${today}.md`), "utf-8");
    // Should match HH:MM pattern
    expect(content).toMatch(/- \d{2}:\d{2} test entry/);
  });

  test("entry includes tag when provided", () => {
    captureOutput(() => logCommand("chose Bun", { tag: "decision" }));
    const today = formatDate();
    const content = readFileSync(join(tmp, "memory", `${today}.md`), "utf-8");
    expect(content).toContain("[decision]");
  });

  test("entry without tag has no brackets", () => {
    captureOutput(() => logCommand("plain note", {}));
    const today = formatDate();
    const content = readFileSync(join(tmp, "memory", `${today}.md`), "utf-8");
    expect(content).toMatch(/- \d{2}:\d{2} plain note/);
    // No tag brackets between time and message
    expect(content).not.toMatch(/- \d{2}:\d{2} \[/);
  });

  test("multiple logs append to same file", () => {
    captureOutput(() => logCommand("first", {}));
    captureOutput(() => logCommand("second", {}));
    captureOutput(() => logCommand("third", {}));
    const today = formatDate();
    const content = readFileSync(join(tmp, "memory", `${today}.md`), "utf-8");
    expect(content).toContain("first");
    expect(content).toContain("second");
    expect(content).toContain("third");
    // Header should appear only once
    const headingCount = content.split(`# ${today}`).length - 1;
    expect(headingCount).toBe(1);
  });

  test("all valid tags are accepted", () => {
    for (const tag of ["decision", "bug", "convention", "todo"]) {
      captureOutput(() => logCommand(`entry for ${tag}`, { tag }));
    }
    const today = formatDate();
    const content = readFileSync(join(tmp, "memory", `${today}.md`), "utf-8");
    expect(content).toContain("[decision]");
    expect(content).toContain("[bug]");
    expect(content).toContain("[convention]");
    expect(content).toContain("[todo]");
  });

  test("invalid tag prints error", () => {
    // logCommand calls process.exit(1) on invalid tag, mock it
    const origExit = process.exit;
    let exitCode: number | undefined;
    process.exit = ((code?: number) => { exitCode = code; }) as any;
    try {
      const { stderr } = captureOutput(() => logCommand("bad", { tag: "invalid" }));
      expect(exitCode).toBe(1);
      expect(stderr.join(" ")).toContain("Invalid tag");
    } finally {
      process.exit = origExit;
    }
  });

  test("prints confirmation with date", () => {
    const { stdout } = captureOutput(() => logCommand("test", {}));
    expect(stdout.join(" ")).toContain(`Logged to ${formatDate()}`);
  });

  test("updates FTS index after logging", () => {
    captureOutput(() => logCommand("unique_searchable_term_xyz", {}));
    // Verify via search
    const { openDb, searchFts } = require("../../src/lib/db.js");
    const { dbPath } = require("../../src/lib/paths.js");
    const db = openDb(dbPath(tmp));
    const results = searchFts(db, "unique_searchable_term_xyz");
    expect(results.length).toBe(1);
    db.close();
  });
});
