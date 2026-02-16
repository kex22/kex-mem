import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { writeFileSync, readFileSync } from "node:fs";
import { makeTempProject, cleanTempProject, captureOutput, captureOutputAsync } from "../helpers.js";
import { initCommand } from "../../src/commands/init.js";
import { todoCommand } from "../../src/commands/todo.js";
import { memoryDir } from "../../src/lib/paths.js";

describe("todoCommand", () => {
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

  test("lists open TODOs across multiple days", async () => {
    writeFileSync(
      join(memoryDir(tmp), "2026-02-15.md"),
      "# 2026-02-15\n\n- 14:30 [todo] Need to add unit tests\n- 15:00 [decision] Use Bun\n",
      "utf-8",
    );
    writeFileSync(
      join(memoryDir(tmp), "2026-02-14.md"),
      "# 2026-02-14\n\n- 10:00 [todo] Review PR #42\n",
      "utf-8",
    );

    const { stdout } = await captureOutputAsync(() => todoCommand());
    const output = stdout.join("\n");
    expect(output).toContain("2026-02-15 14:30  Need to add unit tests");
    expect(output).toContain("2026-02-14 10:00  Review PR #42");
    expect(output).not.toContain("Use Bun");
  });

  test("hides completed TODOs by default", async () => {
    writeFileSync(
      join(memoryDir(tmp), "2026-02-15.md"),
      "# 2026-02-15\n\n- 14:30 [todo] Open task\n- 15:00 [todo] Done task [done]\n",
      "utf-8",
    );

    const { stdout } = await captureOutputAsync(() => todoCommand());
    const output = stdout.join("\n");
    expect(output).toContain("Open task");
    expect(output).not.toContain("Done task");
  });

  test("--all shows completed TODOs with [done] marker", async () => {
    writeFileSync(
      join(memoryDir(tmp), "2026-02-15.md"),
      "# 2026-02-15\n\n- 14:30 [todo] Open task\n- 15:00 [todo] Done task [done]\n",
      "utf-8",
    );

    const { stdout } = await captureOutputAsync(() => todoCommand({ all: true }));
    const output = stdout.join("\n");
    expect(output).toContain("Open task");
    expect(output).toContain("Done task");
    expect(output).toContain("[done]");
  });

  test("--resolve marks matching TODO as done and re-indexes", async () => {
    const filePath = join(memoryDir(tmp), "2026-02-15.md");
    writeFileSync(
      filePath,
      "# 2026-02-15\n\n- 14:30 [todo] Need to add unit tests\n- 15:00 [todo] Review PR #42\n",
      "utf-8",
    );

    const { stdout } = await captureOutputAsync(() => todoCommand({ resolve: "unit tests" }));
    expect(stdout.join(" ")).toContain("Resolved: Need to add unit tests");
    // indexCommand prints "Indexed ..." when it re-indexes
    expect(stdout.join(" ")).toContain("Indexed");

    // Verify file was modified
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("unit tests [done]");
    expect(content).not.toContain("Review PR #42 [done]");
  });

  test("--resolve with no match shows message", async () => {
    writeFileSync(
      join(memoryDir(tmp), "2026-02-15.md"),
      "# 2026-02-15\n\n- 14:30 [todo] Some task\n",
      "utf-8",
    );

    const { stdout } = await captureOutputAsync(() => todoCommand({ resolve: "nonexistent" }));
    expect(stdout.join(" ")).toContain("No matching open TODO.");
  });

  test("no TODOs shows message", async () => {
    const { stdout } = await captureOutputAsync(() => todoCommand());
    expect(stdout.join(" ")).toContain("No open TODOs.");
  });

  test("output format is date time message", async () => {
    writeFileSync(
      join(memoryDir(tmp), "2026-02-15.md"),
      "# 2026-02-15\n\n- 09:30 [todo] Check formatting\n",
      "utf-8",
    );

    const { stdout } = await captureOutputAsync(() => todoCommand());
    expect(stdout[0]).toBe("2026-02-15 09:30  Check formatting");
  });

  test("TODOs sorted by date descending", async () => {
    writeFileSync(
      join(memoryDir(tmp), "2026-02-10.md"),
      "# 2026-02-10\n\n- 09:00 [todo] Older task\n",
      "utf-8",
    );
    writeFileSync(
      join(memoryDir(tmp), "2026-02-15.md"),
      "# 2026-02-15\n\n- 14:00 [todo] Newer task\n",
      "utf-8",
    );

    const { stdout } = await captureOutputAsync(() => todoCommand());
    expect(stdout[0]).toContain("2026-02-15");
    expect(stdout[1]).toContain("2026-02-10");
  });

  test("--resolve does not match already-done TODOs", async () => {
    writeFileSync(
      join(memoryDir(tmp), "2026-02-15.md"),
      "# 2026-02-15\n\n- 14:30 [todo] Already done [done]\n",
      "utf-8",
    );

    const { stdout } = await captureOutputAsync(() => todoCommand({ resolve: "Already done" }));
    expect(stdout.join(" ")).toContain("No matching open TODO.");
  });

  test("all TODOs done without --all shows no open message", async () => {
    writeFileSync(
      join(memoryDir(tmp), "2026-02-15.md"),
      "# 2026-02-15\n\n- 14:30 [todo] Task A [done]\n- 15:00 [todo] Task B [done]\n",
      "utf-8",
    );

    const { stdout } = await captureOutputAsync(() => todoCommand());
    expect(stdout.join(" ")).toContain("No open TODOs.");
  });
});
