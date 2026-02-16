import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { writeFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { makeTempProject, cleanTempProject, captureOutput } from "../helpers.js";
import { initCommand } from "../../src/commands/init.js";
import { compactCommand } from "../../src/commands/compact.js";
import { memoryDir, formatDate } from "../../src/lib/paths.js";

describe("compactCommand", () => {
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

  function createOldLog(daysAgo: number, content: string): string {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const name = `${formatDate(d)}.md`;
    const path = join(memoryDir(tmp), name);
    writeFileSync(path, content, "utf-8");
    return name;
  }

  test("no old logs message when all recent", () => {
    createOldLog(1, "# Yesterday\n\n- recent\n");
    const { stdout } = captureOutput(() => compactCommand({}));
    expect(stdout.join(" ")).toContain("No logs older than 30 days");
  });

  test("lists old files in dry-run mode (no --auto)", () => {
    createOldLog(40, "# Old\n\n- old entry\n");
    createOldLog(50, "# Older\n\n- older entry\n");
    const { stdout } = captureOutput(() => compactCommand({}));
    const output = stdout.join("\n");
    expect(output).toContain("2 logs older than 30 days");
    expect(output).toContain("Run with --auto to archive by month");
  });

  test("respects --days option", () => {
    createOldLog(10, "# Ten days\n\n- entry\n");
    const { stdout: s1 } = captureOutput(() => compactCommand({ days: "30" }));
    expect(s1.join(" ")).toContain("No logs older than 30 days");

    const { stdout: s2 } = captureOutput(() => compactCommand({ days: "5" }));
    expect(s2.join("\n")).toContain("1 logs older than 5 days");
  });

  test("--auto creates archive directory", () => {
    createOldLog(40, "# Old\n\n- entry\n");
    captureOutput(() => compactCommand({ auto: true }));
    expect(existsSync(join(memoryDir(tmp), "archive"))).toBe(true);
  });

  test("--auto creates monthly archive file", () => {
    const name = createOldLog(40, "# Old\n\n- archived entry\n");
    captureOutput(() => compactCommand({ auto: true }));

    const month = name.slice(0, 7); // YYYY-MM
    const archivePath = join(memoryDir(tmp), "archive", `${month}.md`);
    expect(existsSync(archivePath)).toBe(true);
    const content = readFileSync(archivePath, "utf-8");
    expect(content).toContain(`# Archive: ${month}`);
    expect(content).toContain("archived entry");
  });

  test("--auto moves original files to archive/daily-*", () => {
    const name = createOldLog(40, "# Old\n\n- entry\n");
    captureOutput(() => compactCommand({ auto: true }));

    // Original should be gone
    expect(existsSync(join(memoryDir(tmp), name))).toBe(false);
    // Should be in archive as daily-*
    expect(existsSync(join(memoryDir(tmp), "archive", `daily-${name}`))).toBe(true);
  });

  test("--auto groups multiple files by month", () => {
    // Create two files in the same old month
    const d1 = new Date();
    d1.setDate(d1.getDate() - 60);
    const d2 = new Date(d1);
    d2.setDate(d2.getDate() + 1);

    const name1 = `${formatDate(d1)}.md`;
    const name2 = `${formatDate(d2)}.md`;
    writeFileSync(join(memoryDir(tmp), name1), "# D1\n\n- entry1\n", "utf-8");
    writeFileSync(join(memoryDir(tmp), name2), "# D2\n\n- entry2\n", "utf-8");

    const { stdout } = captureOutput(() => compactCommand({ auto: true }));
    const output = stdout.join("\n");
    expect(output).toContain("Archived");

    // Both should be in archive
    const archiveFiles = readdirSync(join(memoryDir(tmp), "archive"));
    expect(archiveFiles.filter((f) => f.startsWith("daily-")).length).toBe(2);
  });

  test("--auto prints archived count per month", () => {
    createOldLog(40, "# Old\n\n- entry\n");
    const { stdout } = captureOutput(() => compactCommand({ auto: true }));
    expect(stdout.join(" ")).toMatch(/Archived \d+ files? for \d{4}-\d{2}/);
  });

  test("does not touch recent files with --auto", () => {
    createOldLog(1, "# Recent\n\n- keep me\n");
    createOldLog(40, "# Old\n\n- archive me\n");
    captureOutput(() => compactCommand({ auto: true }));

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const recentName = `${formatDate(yesterday)}.md`;
    expect(existsSync(join(memoryDir(tmp), recentName))).toBe(true);
  });

  test("--smart outputs structured prompt with MEMORY.md", () => {
    createOldLog(40, "# Old\n\n- important decision\n");
    const { stdout } = captureOutput(() => compactCommand({ smart: true }));
    const output = stdout.join("\n");
    expect(output).toContain("## kex-mem compact --smart");
    expect(output).toContain("### Instructions");
    expect(output).toContain("### Current MEMORY.md");
    expect(output).toContain("Durable Memory");
    expect(output).toContain("### Daily Logs to Process");
    expect(output).toContain("important decision");
    expect(output).toContain("### Files to Delete After Processing");
  });

  test("--smart includes all old log files", () => {
    const name1 = createOldLog(40, "# Day1\n\n- entry1\n");
    const name2 = createOldLog(50, "# Day2\n\n- entry2\n");
    const { stdout } = captureOutput(() => compactCommand({ smart: true }));
    const output = stdout.join("\n");
    expect(output).toContain(name1);
    expect(output).toContain(name2);
    expect(output).toContain("entry1");
    expect(output).toContain("entry2");
    expect(output).toContain(`memory/${name1}`);
    expect(output).toContain(`memory/${name2}`);
  });

  test("--smart respects --days option", () => {
    createOldLog(10, "# Ten days\n\n- entry\n");
    const { stdout: s1 } = captureOutput(() => compactCommand({ smart: true, days: "30" }));
    expect(s1.join(" ")).toContain("No logs older than 30 days");

    const { stdout: s2 } = captureOutput(() => compactCommand({ smart: true, days: "5" }));
    expect(s2.join("\n")).toContain("## kex-mem compact --smart");
  });

  test("--smart does not modify any files", () => {
    const name = createOldLog(40, "# Old\n\n- entry\n");
    captureOutput(() => compactCommand({ smart: true }));
    // Original file should still exist
    expect(existsSync(join(memoryDir(tmp), name))).toBe(true);
    // No archive directory should be created
    expect(existsSync(join(memoryDir(tmp), "archive"))).toBe(false);
  });
});
