import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { makeTempProject, cleanTempProject, captureOutput } from "../helpers.js";
import { initCommand } from "../../src/commands/init.js";
import { reindexCommand } from "../../src/commands/reindex.js";
import { memoryDir } from "../../src/lib/paths.js";
import { openDb, searchFts } from "../../src/lib/db.js";
import { dbPath } from "../../src/lib/paths.js";

describe("reindexCommand", () => {
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

  test("indexes markdown files in memory/", () => {
    writeFileSync(join(memoryDir(tmp), "2025-01-01.md"), "# Jan 1\n\n- decided on Bun\n", "utf-8");
    writeFileSync(join(memoryDir(tmp), "2025-01-02.md"), "# Jan 2\n\n- fixed parser bug\n", "utf-8");

    captureOutput(() => reindexCommand());

    const db = openDb(dbPath(tmp));
    const r1 = searchFts(db, "Bun");
    expect(r1.length).toBe(1);
    expect(r1[0].filepath).toBe("2025-01-01.md");

    const r2 = searchFts(db, "parser");
    expect(r2.length).toBe(1);
    expect(r2[0].filepath).toBe("2025-01-02.md");
    db.close();
  });

  test("prints indexed file count", () => {
    writeFileSync(join(memoryDir(tmp), "a.md"), "# A\n\ncontent a\n", "utf-8");
    writeFileSync(join(memoryDir(tmp), "b.md"), "# B\n\ncontent b\n", "utf-8");

    // MEMORY.md already exists from init, so total = 3
    const { stdout } = captureOutput(() => reindexCommand());
    expect(stdout.join(" ")).toContain("Indexed 3 files.");
  });

  test("skips non-md files", () => {
    writeFileSync(join(memoryDir(tmp), "notes.txt"), "not markdown", "utf-8");
    writeFileSync(join(memoryDir(tmp), "data.json"), "{}", "utf-8");

    const { stdout } = captureOutput(() => reindexCommand());
    // Only MEMORY.md from init
    expect(stdout.join(" ")).toContain("Indexed 1 files.");
  });

  test("skips empty markdown files", () => {
    writeFileSync(join(memoryDir(tmp), "empty.md"), "", "utf-8");

    const { stdout } = captureOutput(() => reindexCommand());
    // Only MEMORY.md
    expect(stdout.join(" ")).toContain("Indexed 1 files.");
  });

  test("is idempotent (re-running produces same results)", () => {
    writeFileSync(join(memoryDir(tmp), "test.md"), "# Test\n\nidempotent content\n", "utf-8");

    captureOutput(() => reindexCommand());
    captureOutput(() => reindexCommand());

    const db = openDb(dbPath(tmp));
    const results = searchFts(db, "idempotent");
    expect(results.length).toBe(1);
    db.close();
  });

  test("picks up updated content", () => {
    const filePath = join(memoryDir(tmp), "evolving.md");
    writeFileSync(filePath, "# V1\n\nalpha content\n", "utf-8");
    captureOutput(() => reindexCommand());

    // Update the file (mtime will change)
    writeFileSync(filePath, "# V2\n\nbeta content\n", "utf-8");
    captureOutput(() => reindexCommand());

    const db = openDb(dbPath(tmp));
    expect(searchFts(db, "beta").length).toBe(1);
    // Old content should be gone
    expect(searchFts(db, "alpha").length).toBe(0);
    db.close();
  });
});
