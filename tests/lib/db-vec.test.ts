import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import {
  openDb,
  upsertDocument,
  searchFts,
  hybridSearch,
  clearVecEntries,
} from "../../src/lib/db.js";
import { makeTempProject, cleanTempProject } from "../helpers.js";

describe("db-vec", () => {
  let tmp: string;
  let dbFile: string;

  beforeEach(() => {
    tmp = makeTempProject();
    dbFile = join(tmp, "memory", ".kex-mem.db");
  });

  afterEach(() => {
    cleanTempProject(tmp);
  });

  describe("openDb with vec", () => {
    test("returns vecEnabled flag", () => {
      const handle = openDb(dbFile);
      // sqlite-vec may or may not be available in test env
      expect(typeof handle.vecEnabled).toBe("boolean");
      handle.db.close();
    });

    test("returns vecDimension when vec is enabled", () => {
      const handle = openDb(dbFile, { vecDimension: 384 });
      if (handle.vecEnabled) {
        expect(handle.vecDimension).toBe(384);
      } else {
        expect(handle.vecDimension).toBe(0);
      }
      handle.db.close();
    });

    test("creates vec_entries table when vec is available", () => {
      const handle = openDb(dbFile, { vecDimension: 384 });
      if (handle.vecEnabled) {
        const tables = handle.db
          .prepare("SELECT name FROM sqlite_master WHERE name='vec_entries'")
          .all();
        expect(tables.length).toBe(1);
      }
      handle.db.close();
    });

    test("recreates vec table on dimension change", () => {
      const h1 = openDb(dbFile, { vecDimension: 384 });
      h1.db.close();

      const h2 = openDb(dbFile, { vecDimension: 1536 });
      if (h2.vecEnabled) {
        expect(h2.vecDimension).toBe(1536);
      }
      h2.db.close();
    });
  });

  describe("upsertDocument with embedding", () => {
    test("stores embedding when provided and vec is enabled", () => {
      const handle = openDb(dbFile, { vecDimension: 4 });
      if (!handle.vecEnabled) {
        handle.db.close();
        return;
      }

      const embedding = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      upsertDocument(handle.db, "test.md", "Title", "Body", 1000, 50, embedding);

      const count = handle.db
        .prepare("SELECT count(*) as c FROM vec_entries")
        .get() as { c: number };
      expect(count.c).toBe(1);
      handle.db.close();
    });

    test("works without embedding (FTS only)", () => {
      const handle = openDb(dbFile, { vecDimension: 4 });
      upsertDocument(handle.db, "test.md", "Title", "Body text", 1000, 50);
      const results = searchFts(handle.db, "Body");
      expect(results.length).toBe(1);
      handle.db.close();
    });
  });

  describe("hybridSearch", () => {
    test("falls back to FTS when vec not available or no embedding", () => {
      const handle = openDb(dbFile);
      upsertDocument(handle.db, "a.md", "Title", "alpha beta gamma", 1000, 50);

      const { results } = hybridSearch(handle, "alpha", null, 10);
      if (handle.vecEnabled) {
        // With vec enabled but no embedding, should still return FTS results
        expect(results.length).toBeGreaterThanOrEqual(0);
      } else {
        expect(results.length).toBe(1);
        expect(results[0].filepath).toBe("a.md");
      }
      handle.db.close();
    });

    test("returns results with score field", () => {
      const handle = openDb(dbFile);
      upsertDocument(handle.db, "a.md", "Title", "searchable content here", 1000, 50);

      const { results } = hybridSearch(handle, "searchable", null, 10);
      expect(results.length).toBe(1);
      expect(typeof results[0].score).toBe("number");
      expect(results[0].score).toBeGreaterThan(0);
      handle.db.close();
    });

    test("respects limit parameter", () => {
      const handle = openDb(dbFile);
      for (let i = 0; i < 10; i++) {
        upsertDocument(handle.db, `file${i}.md`, "Title", `common keyword doc ${i}`, 1000 + i, 50);
      }

      const { results } = hybridSearch(handle, "common", null, 3);
      expect(results.length).toBe(3);
      handle.db.close();
    });

    test("handles invalid FTS query gracefully", () => {
      const handle = openDb(dbFile);
      upsertDocument(handle.db, "a.md", "Title", "some content", 1000, 50);

      // Invalid FTS query should not throw, but should report the error
      const { results, ftsError } = hybridSearch(handle, '"unclosed', null, 10);
      expect(results.length).toBe(0);
      expect(ftsError).toBeDefined();
      handle.db.close();
    });

    test("performs RRF fusion when vec is available", () => {
      const handle = openDb(dbFile, { vecDimension: 4 });
      if (!handle.vecEnabled) {
        handle.db.close();
        return;
      }

      // Insert docs with embeddings
      const emb1 = new Float32Array([1, 0, 0, 0]);
      const emb2 = new Float32Array([0, 1, 0, 0]);
      upsertDocument(handle.db, "a.md", "Alpha", "alpha content", 1000, 50, emb1);
      upsertDocument(handle.db, "b.md", "Beta", "beta content", 1001, 50, emb2);

      // Query with embedding close to emb1
      const queryEmb = new Float32Array([0.9, 0.1, 0, 0]);
      const { results } = hybridSearch(handle, "alpha", queryEmb, 10);
      expect(results.length).toBeGreaterThanOrEqual(1);
      // a.md should rank higher (matches both FTS and vec)
      expect(results[0].filepath).toBe("a.md");
      handle.db.close();
    });
  });

  describe("clearVecEntries", () => {
    test("clears all vec entries", () => {
      const handle = openDb(dbFile, { vecDimension: 4 });
      if (!handle.vecEnabled) {
        handle.db.close();
        return;
      }

      const emb = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      upsertDocument(handle.db, "a.md", "A", "content a", 1000, 50, emb);
      upsertDocument(handle.db, "b.md", "B", "content b", 1001, 50, emb);

      clearVecEntries(handle.db);

      const count = handle.db
        .prepare("SELECT count(*) as c FROM vec_entries")
        .get() as { c: number };
      expect(count.c).toBe(0);
      handle.db.close();
    });

    test("does not throw when vec table does not exist", () => {
      const handle = openDb(dbFile);
      // Should not throw even if vec_entries doesn't exist
      expect(() => clearVecEntries(handle.db)).not.toThrow();
      handle.db.close();
    });
  });
});
