import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { makeTempProject, cleanTempProject, captureOutput, captureOutputAsync } from "../helpers.js";
import { initCommand } from "../../src/commands/init.js";
import { logCommand } from "../../src/commands/log.js";
import { searchCommand } from "../../src/commands/search.js";
import { reindexCommand } from "../../src/commands/reindex.js";
import { memoryDir } from "../../src/lib/paths.js";

describe("search-hybrid", () => {
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

  test("search still works with FTS when vec config is disabled", async () => {
    await captureOutputAsync(() => logCommand("decided to use TypeScript", { tag: "decision" }));
    const { stdout } = await captureOutputAsync(() => searchCommand("TypeScript", {}));
    expect(stdout.join(" ")).toContain("TypeScript");
  });

  test("search returns no results for unmatched query", async () => {
    await captureOutputAsync(() => logCommand("some content here", {}));
    const { stdout } = await captureOutputAsync(() => searchCommand("nonexistent_xyz", {}));
    expect(stdout.join(" ")).toContain("No results.");
  });

  test("search works after reindex", async () => {
    writeFileSync(join(memoryDir(tmp), "2025-06-01.md"), "# June\n\n- chose Rust for performance\n", "utf-8");
    await captureOutputAsync(() => reindexCommand());

    const { stdout } = await captureOutputAsync(() => searchCommand("Rust", {}));
    expect(stdout.join(" ")).toContain("Rust");
  });

  test("search handles invalid FTS query gracefully", async () => {
    await captureOutputAsync(() => logCommand("test content", {}));
    const { stdout } = await captureOutputAsync(() => searchCommand('"unclosed', {}));
    const output = stdout.join(" ");
    // Should not crash — either "Invalid query" or "No results."
    expect(output).toMatch(/Invalid query|No results\./);
  });
});
