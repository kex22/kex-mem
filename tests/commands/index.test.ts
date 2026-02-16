import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { writeFileSync, unlinkSync } from "node:fs";
import { makeTempProject, cleanTempProject, captureOutput, captureOutputAsync } from "../helpers.js";
import { initCommand } from "../../src/commands/init.js";
import { indexCommand } from "../../src/commands/index.js";
import { memoryDir } from "../../src/lib/paths.js";
import { openDb, searchFts, getFileMeta } from "../../src/lib/db.js";
import { dbPath } from "../../src/lib/paths.js";

describe("indexCommand", () => {
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

  // --- Full rebuild (--full) ---

  test("--full indexes all markdown files", async () => {
    writeFileSync(join(memoryDir(tmp), "2025-01-01.md"), "# Jan 1\n\n- decided on Bun\n", "utf-8");
    writeFileSync(join(memoryDir(tmp), "2025-01-02.md"), "# Jan 2\n\n- fixed parser bug\n", "utf-8");

    await captureOutputAsync(() => indexCommand(undefined, { full: true }));

    const db = openDb(dbPath(tmp)).db;
    const r1 = searchFts(db, "Bun");
    expect(r1.length).toBe(1);
    expect(r1[0].filepath).toBe("2025-01-01.md");

    const r2 = searchFts(db, "parser");
    expect(r2.length).toBe(1);
    expect(r2[0].filepath).toBe("2025-01-02.md");
    db.close();
  });

  test("--full prints full rebuild message", async () => {
    writeFileSync(join(memoryDir(tmp), "a.md"), "# A\n\ncontent a\n", "utf-8");
    writeFileSync(join(memoryDir(tmp), "b.md"), "# B\n\ncontent b\n", "utf-8");

    // MEMORY.md + USER.md from init, plus a.md + b.md = 4
    const { stdout } = await captureOutputAsync(() => indexCommand(undefined, { full: true }));
    expect(stdout.join(" ")).toContain("Indexed 4 files (full rebuild).");
  });

  test("--full skips non-md files", async () => {
    writeFileSync(join(memoryDir(tmp), "notes.txt"), "not markdown", "utf-8");
    writeFileSync(join(memoryDir(tmp), "data.json"), "{}", "utf-8");

    const { stdout } = await captureOutputAsync(() => indexCommand(undefined, { full: true }));
    // MEMORY.md + USER.md from init
    expect(stdout.join(" ")).toContain("Indexed 2 files (full rebuild).");
  });

  test("--full skips empty markdown files", async () => {
    writeFileSync(join(memoryDir(tmp), "empty.md"), "", "utf-8");

    const { stdout } = await captureOutputAsync(() => indexCommand(undefined, { full: true }));
    // MEMORY.md + USER.md from init
    expect(stdout.join(" ")).toContain("Indexed 2 files (full rebuild).");
  });

  test("--full is idempotent", async () => {
    writeFileSync(join(memoryDir(tmp), "test.md"), "# Test\n\nidempotent content\n", "utf-8");

    await captureOutputAsync(() => indexCommand(undefined, { full: true }));
    await captureOutputAsync(() => indexCommand(undefined, { full: true }));

    const db = openDb(dbPath(tmp)).db;
    const results = searchFts(db, "idempotent");
    expect(results.length).toBe(1);
    db.close();
  });

  test("--full picks up updated content", async () => {
    const filePath = join(memoryDir(tmp), "evolving.md");
    writeFileSync(filePath, "# V1\n\nalpha content\n", "utf-8");
    await captureOutputAsync(() => indexCommand(undefined, { full: true }));

    writeFileSync(filePath, "# V2\n\nbeta content\n", "utf-8");
    await captureOutputAsync(() => indexCommand(undefined, { full: true }));

    const db = openDb(dbPath(tmp)).db;
    expect(searchFts(db, "beta").length).toBe(1);
    expect(searchFts(db, "alpha").length).toBe(0);
    db.close();
  });

  // --- Single-file mode ---

  test("single file indexes only that file", async () => {
    writeFileSync(join(memoryDir(tmp), "target.md"), "# Target\n\ntarget content\n", "utf-8");
    writeFileSync(join(memoryDir(tmp), "other.md"), "# Other\n\nother content\n", "utf-8");

    const { stdout } = await captureOutputAsync(() => indexCommand("target.md"));
    expect(stdout.join(" ")).toContain("Indexed target.md");

    const db = openDb(dbPath(tmp)).db;
    expect(searchFts(db, "target").length).toBe(1);
    // other.md was not indexed
    expect(searchFts(db, "other").length).toBe(0);
    db.close();
  });

  test("single file removes from index when file deleted", async () => {
    const filePath = join(memoryDir(tmp), "gone.md");
    writeFileSync(filePath, "# Gone\n\ngone content\n", "utf-8");
    await captureOutputAsync(() => indexCommand("gone.md"));

    unlinkSync(filePath);
    const { stdout } = await captureOutputAsync(() => indexCommand("gone.md"));
    expect(stdout.join(" ")).toContain("Removed gone.md from index.");

    const db = openDb(dbPath(tmp)).db;
    expect(searchFts(db, "gone").length).toBe(0);
    expect(getFileMeta(db, "gone.md")).toBeUndefined();
    db.close();
  });

  test("single file removes from index when file is empty", async () => {
    const filePath = join(memoryDir(tmp), "empty.md");
    writeFileSync(filePath, "# Has content\n\nreal content\n", "utf-8");
    await captureOutputAsync(() => indexCommand("empty.md"));

    writeFileSync(filePath, "", "utf-8");
    const { stdout } = await captureOutputAsync(() => indexCommand("empty.md"));
    expect(stdout.join(" ")).toContain("Removed empty.md from index.");
  });

  // --- Incremental mode (default) ---

  test("incremental skips unchanged files", async () => {
    writeFileSync(join(memoryDir(tmp), "a.md"), "# A\n\ncontent a\n", "utf-8");
    // First run indexes everything
    await captureOutputAsync(() => indexCommand());

    // Second run should skip
    const { stdout } = await captureOutputAsync(() => indexCommand());
    const output = stdout.join(" ");
    expect(output).toContain("skipped");
  });

  test("incremental detects deleted files", async () => {
    const filePath = join(memoryDir(tmp), "willdelete.md");
    writeFileSync(filePath, "# Delete me\n\ndelete content\n", "utf-8");
    await captureOutputAsync(() => indexCommand());

    unlinkSync(filePath);
    const { stdout } = await captureOutputAsync(() => indexCommand());
    const output = stdout.join(" ");
    expect(output).toContain("1 removed");

    const db = openDb(dbPath(tmp)).db;
    expect(searchFts(db, "delete").length).toBe(0);
    db.close();
  });

  test("incremental indexes only changed files", async () => {
    writeFileSync(join(memoryDir(tmp), "stable.md"), "# Stable\n\nstable content\n", "utf-8");
    await captureOutputAsync(() => indexCommand());

    // Add a new file
    writeFileSync(join(memoryDir(tmp), "new.md"), "# New\n\nnew content\n", "utf-8");
    const { stdout } = await captureOutputAsync(() => indexCommand());
    const output = stdout.join(" ");
    expect(output).toContain("Indexed 1 files");
    expect(output).toContain("skipped");
  });

  test("incremental output format with no changes", async () => {
    // Only MEMORY.md from init
    await captureOutputAsync(() => indexCommand());
    const { stdout } = await captureOutputAsync(() => indexCommand());
    const output = stdout.join(" ");
    expect(output).toContain("Indexed 0 files");
    expect(output).toContain("skipped");
  });

  test("incremental skips file that became empty", async () => {
    const filePath = join(memoryDir(tmp), "willclear.md");
    writeFileSync(filePath, "# Has content\n\nreal content\n", "utf-8");
    await captureOutputAsync(() => indexCommand());

    // Overwrite with empty content (mtime updates, so it won't be skipped by mtime check)
    writeFileSync(filePath, "", "utf-8");
    const { stdout } = await captureOutputAsync(() => indexCommand());
    const output = stdout.join(" ");
    // The empty file is read but skipped (not re-indexed), old entry remains
    expect(output).toContain("skipped");
  });
});
