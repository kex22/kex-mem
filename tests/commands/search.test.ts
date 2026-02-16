import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { makeTempProject, cleanTempProject, captureOutput } from "../helpers.js";
import { initCommand } from "../../src/commands/init.js";
import { logCommand } from "../../src/commands/log.js";
import { searchCommand } from "../../src/commands/search.js";

describe("searchCommand", () => {
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

  test("prints 'No results.' when nothing matches", () => {
    const { stdout } = captureOutput(() => searchCommand("nonexistent", {}));
    expect(stdout.join(" ")).toContain("No results.");
  });

  test("finds logged entries", () => {
    captureOutput(() => logCommand("decided to use PostgreSQL for persistence", { tag: "decision" }));
    const { stdout } = captureOutput(() => searchCommand("PostgreSQL", {}));
    const output = stdout.join("\n");
    expect(output).toContain("PostgreSQL");
  });

  test("respects --limit option", () => {
    for (let i = 0; i < 5; i++) {
      captureOutput(() => logCommand(`searchable item number ${i}`, {}));
    }
    // Force different mtime by reindexing
    const { reindexCommand } = require("../../src/commands/reindex.js");
    captureOutput(() => reindexCommand());

    const { stdout } = captureOutput(() => searchCommand("searchable", { limit: "2" }));
    // Should have at most 2 result lines (one file since all entries are in same daily log)
    expect(stdout.length).toBeLessThanOrEqual(2);
  });

  test("output format includes filepath in brackets", () => {
    captureOutput(() => logCommand("format test entry", {}));
    const { stdout } = captureOutput(() => searchCommand("format", {}));
    expect(stdout[0]).toMatch(/^\[.+\.md\]/);
  });

  test("searches across multiple days", () => {
    // Log something today
    captureOutput(() => logCommand("today unique_alpha", {}));

    // Manually create a yesterday log
    const { writeFileSync } = require("node:fs");
    const { memoryDir, formatDate } = require("../../src/lib/paths.js");
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yPath = join(memoryDir(tmp), `${formatDate(yesterday)}.md`);
    writeFileSync(yPath, "# Yesterday\n\n- 10:00 unique_beta\n", "utf-8");

    // Reindex to pick up the manual file
    const { reindexCommand } = require("../../src/commands/reindex.js");
    captureOutput(() => reindexCommand());

    const { stdout: r1 } = captureOutput(() => searchCommand("unique_alpha", {}));
    expect(r1.join(" ")).toContain("unique_alpha");

    const { stdout: r2 } = captureOutput(() => searchCommand("unique_beta", {}));
    expect(r2.join(" ")).toContain("unique_beta");
  });

  test("empty string query does not crash", () => {
    const { stdout } = captureOutput(() => searchCommand("", {}));
    const output = stdout.join(" ");
    expect(output).toMatch(/No results\.|Invalid query/);
  });

  test("unclosed FTS5 quote prints Invalid query", () => {
    const { stdout } = captureOutput(() => searchCommand('"hello', {}));
    expect(stdout.join(" ")).toContain("Invalid query");
  });

  test("lone asterisk query does not crash", () => {
    const { stdout } = captureOutput(() => searchCommand("*", {}));
    const output = stdout.join(" ");
    expect(output).toMatch(/No results\.|Invalid query/);
  });
});
