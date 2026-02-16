import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import {
  openDb,
  upsertDocument,
  searchFts,
  removeDocument,
  getFileMeta,
} from "../../src/lib/db.js";
import { makeTempProject, cleanTempProject } from "../helpers.js";
import type { Database } from "bun:sqlite";

describe("db", () => {
  let tmp: string;
  let db: Database;
  let dbFile: string;

  beforeEach(() => {
    tmp = makeTempProject();
    dbFile = join(tmp, "memory", ".longmem.db");
    db = openDb(dbFile);
  });

  afterEach(() => {
    db.close();
    cleanTempProject(tmp);
  });

  describe("openDb", () => {
    test("creates database file", () => {
      const { existsSync } = require("node:fs");
      expect(existsSync(dbFile)).toBe(true);
    });

    test("creates memory_fts virtual table", () => {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='memory_fts'")
        .all();
      expect(tables.length).toBe(1);
    });

    test("creates file_meta table", () => {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='file_meta'")
        .all();
      expect(tables.length).toBe(1);
    });

    test("creates parent directories if missing", () => {
      const nested = join(tmp, "deep", "nested", "dir", "test.db");
      const db2 = openDb(nested);
      const { existsSync } = require("node:fs");
      expect(existsSync(nested)).toBe(true);
      db2.close();
    });

    test("is idempotent (can open same db twice)", () => {
      db.close();
      const db2 = openDb(dbFile);
      const tables = db2
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all();
      expect(tables.length).toBeGreaterThanOrEqual(2);
      db2.close();
      // reopen for afterEach
      db = openDb(dbFile);
    });
  });

  describe("upsertDocument", () => {
    test("inserts new document", () => {
      upsertDocument(db, "2025-01-01.md", "Jan 1", "Hello world", 1000, 50);
      const meta = getFileMeta(db, "2025-01-01.md");
      expect(meta).toBeDefined();
      expect(meta!.mtime_ms).toBe(1000);
      expect(meta!.size_bytes).toBe(50);
    });

    test("updates document with newer mtime", () => {
      upsertDocument(db, "test.md", "Title", "Body v1", 1000, 50);
      upsertDocument(db, "test.md", "Title v2", "Body v2", 2000, 60);
      const meta = getFileMeta(db, "test.md");
      expect(meta!.mtime_ms).toBe(2000);
      expect(meta!.size_bytes).toBe(60);
    });

    test("skips update when mtime is not newer", () => {
      upsertDocument(db, "test.md", "Title", "Body v1", 2000, 50);
      upsertDocument(db, "test.md", "Title v2", "Body v2", 1000, 60);
      const meta = getFileMeta(db, "test.md");
      expect(meta!.mtime_ms).toBe(2000);
      expect(meta!.size_bytes).toBe(50); // unchanged
    });

    test("skips update when mtime is equal", () => {
      upsertDocument(db, "test.md", "Title", "Body v1", 1000, 50);
      upsertDocument(db, "test.md", "Title v2", "Body v2", 1000, 60);
      const meta = getFileMeta(db, "test.md");
      expect(meta!.size_bytes).toBe(50); // unchanged
    });

    test("FTS content is updated on newer mtime", () => {
      upsertDocument(db, "test.md", "Title", "alpha beta gamma", 1000, 50);
      upsertDocument(db, "test.md", "Title", "delta epsilon zeta", 2000, 60);
      const results = searchFts(db, "delta");
      expect(results.length).toBe(1);
      const oldResults = searchFts(db, "alpha");
      expect(oldResults.length).toBe(0);
    });
  });

  describe("searchFts", () => {
    test("finds matching documents", () => {
      upsertDocument(db, "a.md", "Decisions", "We chose TypeScript for safety", 1000, 50);
      upsertDocument(db, "b.md", "Bugs", "Fixed null pointer in parser", 1001, 40);
      const results = searchFts(db, "TypeScript");
      expect(results.length).toBe(1);
      expect(results[0].filepath).toBe("a.md");
    });

    test("returns empty array for no matches", () => {
      upsertDocument(db, "a.md", "Title", "Some content", 1000, 50);
      const results = searchFts(db, "nonexistent");
      expect(results.length).toBe(0);
    });

    test("respects limit parameter", () => {
      for (let i = 0; i < 20; i++) {
        upsertDocument(db, `file${i}.md`, "Title", `common keyword doc ${i}`, 1000 + i, 50);
      }
      const results = searchFts(db, "common", 5);
      expect(results.length).toBe(5);
    });

    test("default limit is 10", () => {
      for (let i = 0; i < 15; i++) {
        upsertDocument(db, `file${i}.md`, "Title", `shared term entry ${i}`, 1000 + i, 50);
      }
      const results = searchFts(db, "shared");
      expect(results.length).toBe(10);
    });

    test("searches across title and body", () => {
      upsertDocument(db, "a.md", "Architecture Decision", "We use microservices", 1000, 50);
      const byTitle = searchFts(db, "Architecture");
      expect(byTitle.length).toBe(1);
      const byBody = searchFts(db, "microservices");
      expect(byBody.length).toBe(1);
    });

    test("porter stemming works (searching 'running' finds 'run')", () => {
      upsertDocument(db, "a.md", "Title", "We need to run the tests", 1000, 50);
      const results = searchFts(db, "running");
      expect(results.length).toBe(1);
    });

    test("results include snippet with markers", () => {
      upsertDocument(db, "a.md", "Title", "The quick brown fox jumps over the lazy dog", 1000, 50);
      const results = searchFts(db, "fox");
      expect(results.length).toBe(1);
      expect(results[0].snippet).toContain(">>>");
      expect(results[0].snippet).toContain("<<<");
    });

    test("results have rank field", () => {
      upsertDocument(db, "a.md", "Title", "fox fox fox", 1000, 50);
      upsertDocument(db, "b.md", "Title", "the fox", 1001, 50);
      const results = searchFts(db, "fox");
      expect(results.length).toBe(2);
      // rank is negative in FTS5 (more negative = better match)
      expect(typeof results[0].rank).toBe("number");
    });
  });

  describe("removeDocument", () => {
    test("removes document from FTS and meta", () => {
      upsertDocument(db, "test.md", "Title", "Body", 1000, 50);
      removeDocument(db, "test.md");
      expect(getFileMeta(db, "test.md")).toBeUndefined();
      expect(searchFts(db, "Body").length).toBe(0);
    });

    test("no-op for non-existent document", () => {
      // Should not throw
      removeDocument(db, "nonexistent.md");
    });
  });

  describe("getFileMeta", () => {
    test("returns undefined for non-existent file", () => {
      expect(getFileMeta(db, "nope.md")).toBeUndefined();
    });

    test("returns correct metadata", () => {
      upsertDocument(db, "test.md", "T", "B", 12345, 678);
      const meta = getFileMeta(db, "test.md");
      expect(meta).toEqual({ mtime_ms: 12345, size_bytes: 678 });
    });
  });
});
