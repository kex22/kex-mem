import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { makeTempProject, cleanTempProject, captureOutput } from "../helpers.js";
import { initCommand } from "../../src/commands/init.js";
import { briefCommand } from "../../src/commands/brief.js";
import { memoryDir } from "../../src/lib/paths.js";

describe("briefCommand", () => {
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

  test("output includes DURABLE section", () => {
    const { stdout } = captureOutput(() => briefCommand());
    const output = stdout.join("\n");
    expect(output).toContain("=== DURABLE ===");
    expect(output).toContain("Durable Memory");
  });

  test("MEMORY.md truncated when exceeding --lines", () => {
    const lines = ["# Project Memory", ""];
    for (let i = 0; i < 30; i++) {
      lines.push(`- Line ${i}`);
    }
    writeFileSync(join(memoryDir(tmp), "MEMORY.md"), lines.join("\n") + "\n", "utf-8");

    const { stdout } = captureOutput(() => briefCommand({ lines: "5" }));
    const output = stdout.join("\n");
    expect(output).toContain("=== DURABLE ===");
    expect(output).toContain("# Project Memory");
    expect(output).toContain("more lines in MEMORY.md");
    expect(output).not.toContain("Line 29");
  });

  test("output includes RECENT section", () => {
    writeFileSync(
      join(memoryDir(tmp), "2026-02-15.md"),
      "# 2026-02-15\n\n- 14:30 [decision] Chose Bun\n",
      "utf-8",
    );

    const { stdout } = captureOutput(() => briefCommand());
    const output = stdout.join("\n");
    expect(output).toContain("=== RECENT (3d) ===");
    expect(output).toContain("Chose Bun");
  });

  test("--days controls recent log range", () => {
    writeFileSync(
      join(memoryDir(tmp), "2026-02-15.md"),
      "# 2026-02-15\n\n- 14:30 Day one\n",
      "utf-8",
    );
    writeFileSync(
      join(memoryDir(tmp), "2026-02-14.md"),
      "# 2026-02-14\n\n- 10:00 Day two\n",
      "utf-8",
    );
    writeFileSync(
      join(memoryDir(tmp), "2026-02-13.md"),
      "# 2026-02-13\n\n- 09:00 Day three\n",
      "utf-8",
    );

    const { stdout } = captureOutput(() => briefCommand({ days: "1" }));
    const output = stdout.join("\n");
    expect(output).toContain("=== RECENT (1d) ===");
    expect(output).toContain("Day one");
    expect(output).not.toContain("Day two");
    expect(output).not.toContain("Day three");
  });

  test("output includes TODO section", () => {
    writeFileSync(
      join(memoryDir(tmp), "2026-02-15.md"),
      "# 2026-02-15\n\n- 14:30 [todo] Write unit tests\n",
      "utf-8",
    );

    const { stdout } = captureOutput(() => briefCommand());
    const output = stdout.join("\n");
    expect(output).toContain("=== TODO (1 open) ===");
    expect(output).toContain("2026-02-15 14:30  Write unit tests");
  });

  test("empty sections are not output", () => {
    // No logs, no TODOs — only DURABLE from init
    const { stdout } = captureOutput(() => briefCommand());
    const output = stdout.join("\n");
    expect(output).toContain("=== DURABLE ===");
    expect(output).not.toContain("=== RECENT");
    expect(output).not.toContain("=== TODO");
  });

  test("no MEMORY.md skips DURABLE section", () => {
    rmSync(join(memoryDir(tmp), "MEMORY.md"));

    writeFileSync(
      join(memoryDir(tmp), "2026-02-15.md"),
      "# 2026-02-15\n\n- 14:30 Some entry\n",
      "utf-8",
    );

    const { stdout } = captureOutput(() => briefCommand());
    const output = stdout.join("\n");
    expect(output).not.toContain("=== DURABLE ===");
    expect(output).toContain("=== RECENT");
  });

  test("no logs skips RECENT section", () => {
    const { stdout } = captureOutput(() => briefCommand());
    const output = stdout.join("\n");
    expect(output).toContain("=== DURABLE ===");
    expect(output).not.toContain("=== RECENT");
  });

  test("completed TODOs excluded from TODO section", () => {
    writeFileSync(
      join(memoryDir(tmp), "2026-02-15.md"),
      "# 2026-02-15\n\n- 14:30 [todo] Open task\n- 15:00 [todo] Done task [done]\n",
      "utf-8",
    );

    const { stdout } = captureOutput(() => briefCommand());
    const output = stdout.join("\n");
    expect(output).toContain("=== TODO (1 open) ===");
    // The TODO section should only list the open task
    const todoSection = output.split("=== TODO")[1];
    expect(todoSection).toContain("Open task");
    expect(todoSection).not.toContain("Done task");
  });

  test("no data at all shows empty message", () => {
    rmSync(join(memoryDir(tmp), "MEMORY.md"));
    rmSync(join(memoryDir(tmp), "USER.md"));
    const { stdout } = captureOutput(() => briefCommand());
    expect(stdout.join(" ")).toContain("No memory data found.");
  });

  test("TODOs from older files beyond --days window are included", () => {
    // Recent file (within --days 1)
    writeFileSync(
      join(memoryDir(tmp), "2026-02-15.md"),
      "# 2026-02-15\n\n- 14:30 [decision] Recent decision\n",
      "utf-8",
    );
    // Older file (beyond --days 1) with a TODO
    writeFileSync(
      join(memoryDir(tmp), "2026-02-10.md"),
      "# 2026-02-10\n\n- 09:00 [todo] Old TODO from past\n",
      "utf-8",
    );

    const { stdout } = captureOutput(() => briefCommand({ days: "1" }));
    const output = stdout.join("\n");
    expect(output).toContain("=== TODO (1 open) ===");
    expect(output).toContain("Old TODO from past");
  });
});
