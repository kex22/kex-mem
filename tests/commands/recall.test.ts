import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { makeTempProject, cleanTempProject, captureOutput } from "../helpers.js";
import { initCommand } from "../../src/commands/init.js";
import { logCommand } from "../../src/commands/log.js";
import { recallCommand } from "../../src/commands/recall.js";
import { memoryDir, formatDate } from "../../src/lib/paths.js";
import { MEMORY_MD_TEMPLATE } from "../../src/lib/config.js";

describe("recallCommand", () => {
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

  test("--durable shows MEMORY.md content", () => {
    const { stdout } = captureOutput(() => recallCommand(undefined, { durable: true }));
    const output = stdout.join("\n");
    expect(output).toContain("Durable Memory");
  });

  test("--durable shows message when no MEMORY.md", () => {
    const { rmSync } = require("node:fs");
    rmSync(join(tmp, "memory", "MEMORY.md"));
    const { stdout } = captureOutput(() => recallCommand(undefined, { durable: true }));
    expect(stdout.join(" ")).toContain("No durable memory found");
  });

  test("default recall shows today's log", () => {
    captureOutput(() => logCommand("today entry", {}));
    const { stdout } = captureOutput(() => recallCommand());
    expect(stdout.join("\n")).toContain("today entry");
  });

  test("default recall shows yesterday's log too", () => {
    // Create yesterday's log manually
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yPath = join(memoryDir(tmp), `${formatDate(yesterday)}.md`);
    writeFileSync(yPath, "# Yesterday\n\n- 10:00 yesterday entry\n", "utf-8");

    captureOutput(() => logCommand("today entry", {}));
    const { stdout } = captureOutput(() => recallCommand());
    const output = stdout.join("\n");
    expect(output).toContain("today entry");
    expect(output).toContain("yesterday entry");
  });

  test("separator between multiple days", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yPath = join(memoryDir(tmp), `${formatDate(yesterday)}.md`);
    writeFileSync(yPath, "# Yesterday\n\n- 10:00 old\n", "utf-8");

    captureOutput(() => logCommand("new", {}));
    const { stdout } = captureOutput(() => recallCommand());
    expect(stdout).toContain("---");
  });

  test("specific date recall", () => {
    const target = "2025-06-15";
    const logPath = join(memoryDir(tmp), `${target}.md`);
    writeFileSync(logPath, "# 2025-06-15\n\n- 09:00 specific day\n", "utf-8");

    const { stdout } = captureOutput(() => recallCommand(target));
    expect(stdout.join("\n")).toContain("specific day");
  });

  test("specific date with no log", () => {
    const { stdout } = captureOutput(() => recallCommand("2020-01-01"));
    expect(stdout.join(" ")).toContain("No log for 2020-01-01");
  });

  test("--week shows 7 days", () => {
    // Create logs for several days
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const path = join(memoryDir(tmp), `${formatDate(d)}.md`);
      writeFileSync(path, `# ${formatDate(d)}\n\n- 10:00 day${i}\n`, "utf-8");
    }

    const { stdout } = captureOutput(() => recallCommand(undefined, { week: true }));
    const output = stdout.join("\n");
    expect(output).toContain("day0");
    expect(output).toContain("day6");
  });

  test("no recent logs message when empty", () => {
    const { stdout } = captureOutput(() => recallCommand());
    expect(stdout.join(" ")).toContain("No recent logs.");
  });

  test("invalid date string handles gracefully", () => {
    const { stdout } = captureOutput(() => recallCommand("not-a-date"));
    expect(stdout.join(" ")).toContain("No log for not-a-date");
  });

  test("--user shows USER.md content", () => {
    const { stdout } = captureOutput(() => recallCommand(undefined, { user: true }));
    const output = stdout.join("\n");
    expect(output).toContain("User Preferences");
  });

  test("--user shows message when no USER.md", () => {
    const { rmSync } = require("node:fs");
    rmSync(join(tmp, "memory", "USER.md"));
    const { stdout } = captureOutput(() => recallCommand(undefined, { user: true }));
    expect(stdout.join(" ")).toContain("No user preferences found");
  });

  test("--user shows custom USER.md content", () => {
    writeFileSync(join(memoryDir(tmp), "USER.md"), "# User Preferences\n\n## Coding Style\n\nPrefer functional style\n", "utf-8");
    const { stdout } = captureOutput(() => recallCommand(undefined, { user: true }));
    expect(stdout.join("\n")).toContain("Prefer functional style");
  });
});
