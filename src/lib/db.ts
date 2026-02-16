import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface SearchResult {
  filepath: string;
  title: string;
  snippet: string;
  rank: number;
}

export interface DbHandle {
  db: Database;
  vecEnabled: boolean;
  vecDimension: number;
}

function tryLoadVec(db: Database): boolean {
  try {
    // Bun supports require() in ESM; this avoids making openDb() async
    // just for extension loading. Not portable to Node ESM.
    const sqliteVec = require("sqlite-vec");
    sqliteVec.load(db);
    return true;
  } catch {
    return false;
  }
}

function getExistingVecDimension(db: Database): number | null {
  try {
    const row = db
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='vec_entries'",
      )
      .get() as { sql: string } | null;
    if (!row) return null;
    const match = row.sql.match(/float\[(\d+)\]/);
    return match ? parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

export function openDb(
  dbFilePath: string,
  opts?: { vecDimension?: number },
): DbHandle {
  const dir = dirname(dbFilePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbFilePath);
  db.run("PRAGMA journal_mode = WAL");

  db.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
      filepath, title, body,
      tokenize='porter unicode61'
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS file_meta (
      filepath TEXT PRIMARY KEY,
      mtime_ms INTEGER NOT NULL,
      size_bytes INTEGER NOT NULL
    );
  `);

  const vecEnabled = tryLoadVec(db);
  const requestedDim = opts?.vecDimension ?? 384;

  if (vecEnabled) {
    const existingDim = getExistingVecDimension(db);
    if (existingDim !== null && existingDim !== requestedDim) {
      db.run("DROP TABLE IF EXISTS vec_entries");
    }
    db.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_entries USING vec0(
        filepath TEXT,
        embedding float[${requestedDim}] distance_metric=cosine
      );
    `);
  }

  return { db, vecEnabled, vecDimension: vecEnabled ? requestedDim : 0 };
}

export function upsertDocument(
  db: Database,
  filepath: string,
  title: string,
  body: string,
  mtimeMs: number,
  sizeBytes: number,
  embedding?: Float32Array,
): void {
  const existing = db
    .prepare("SELECT mtime_ms FROM file_meta WHERE filepath = ?")
    .get(filepath) as { mtime_ms: number } | undefined;

  if (existing && existing.mtime_ms > mtimeMs) {
    return; // already up to date
  }

  const txn = db.transaction(() => {
    db.prepare("DELETE FROM memory_fts WHERE filepath = ?").run(filepath);
    db.prepare(
      "INSERT INTO memory_fts (filepath, title, body) VALUES (?, ?, ?)",
    ).run(filepath, title, body);
    db.prepare(
      `INSERT INTO file_meta (filepath, mtime_ms, size_bytes)
       VALUES (?, ?, ?)
       ON CONFLICT(filepath) DO UPDATE SET mtime_ms = excluded.mtime_ms, size_bytes = excluded.size_bytes`,
    ).run(filepath, mtimeMs, sizeBytes);

    if (embedding) {
      try {
        db.prepare("DELETE FROM vec_entries WHERE filepath = ?").run(filepath);
        db.prepare(
          "INSERT INTO vec_entries (filepath, embedding) VALUES (?, ?)",
        ).run(filepath, new Uint8Array(embedding.buffer));
      } catch {
        // vec_entries table may not exist if sqlite-vec is unavailable
      }
    }
  });

  txn();
}

export function searchFts(
  db: Database,
  query: string,
  limit: number = 10,
): SearchResult[] {
  const stmt = db.prepare(`
    SELECT filepath, title, snippet(memory_fts, 2, '>>>', '<<<', '...', 48) as snippet, rank
    FROM memory_fts
    WHERE memory_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `);

  return stmt.all(query, limit) as SearchResult[];
}

function searchVec(
  db: Database,
  embedding: Float32Array,
  limit: number,
): { filepath: string; distance: number }[] {
  const stmt = db.prepare(`
    SELECT filepath, distance
    FROM vec_entries
    WHERE embedding MATCH ?
    ORDER BY distance
    LIMIT ?
  `);
  return stmt.all(
    new Uint8Array(embedding.buffer),
    limit,
  ) as { filepath: string; distance: number }[];
}

export interface HybridSearchResult extends SearchResult {
  score: number;
}

export interface HybridSearchOutput {
  results: HybridSearchResult[];
  ftsError?: string;
}

export function hybridSearch(
  handle: DbHandle,
  ftsQuery: string,
  queryEmbedding: Float32Array | null,
  limit: number = 10,
): HybridSearchOutput {
  const { db, vecEnabled } = handle;
  const pool = limit * 2;

  // FTS results
  let ftsResults: SearchResult[] = [];
  let ftsError: string | undefined;
  try {
    ftsResults = searchFts(db, ftsQuery, pool);
  } catch (err: any) {
    ftsError = err.message;
  }

  // If vec not available or no embedding, return FTS-only
  if (!vecEnabled || !queryEmbedding) {
    return {
      results: ftsResults.slice(0, limit).map((r, i) => ({
        ...r,
        score: 1 / (60 + i),
      })),
      ftsError,
    };
  }

  // Vec results
  const vecResults = searchVec(db, queryEmbedding, pool);

  // Build rank maps
  const ftsRank = new Map<string, number>();
  ftsResults.forEach((r, i) => ftsRank.set(r.filepath, i));

  const vecRank = new Map<string, number>();
  vecResults.forEach((r, i) => vecRank.set(r.filepath, i));

  // Collect all unique filepaths
  const allFiles = new Set([...ftsRank.keys(), ...vecRank.keys()]);

  // Build snippet map from FTS results
  const snippetMap = new Map<string, SearchResult>();
  for (const r of ftsResults) snippetMap.set(r.filepath, r);

  // RRF fusion: score(d) = 0.3/(60+rank_bm25) + 0.7/(60+rank_vec)
  const scored: HybridSearchResult[] = [];
  for (const fp of allFiles) {
    const ftsR = ftsRank.get(fp);
    const vecR = vecRank.get(fp);
    const ftsScore = ftsR !== undefined ? 0.3 / (60 + ftsR) : 0;
    const vecScore = vecR !== undefined ? 0.7 / (60 + vecR) : 0;
    const score = ftsScore + vecScore;

    let existing = snippetMap.get(fp);
    // Fill in title/snippet for vec-only results via FTS table lookup
    if (!existing) {
      const row = db
        .prepare("SELECT title, body FROM memory_fts WHERE filepath = ?")
        .get(fp) as { title: string; body: string } | null;
      if (row) {
        existing = {
          filepath: fp,
          title: row.title,
          snippet: row.body.length > 200 ? row.body.slice(0, 200) + "..." : row.body,
          rank: 0,
        };
      }
    }

    scored.push({
      filepath: fp,
      title: existing?.title ?? "",
      snippet: existing?.snippet ?? "",
      rank: existing?.rank ?? 0,
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return { results: scored.slice(0, limit), ftsError };
}

export function removeDocument(
  db: Database,
  filepath: string,
  vecEnabled?: boolean,
): void {
  const txn = db.transaction(() => {
    db.prepare("DELETE FROM memory_fts WHERE filepath = ?").run(filepath);
    db.prepare("DELETE FROM file_meta WHERE filepath = ?").run(filepath);
    if (vecEnabled) {
      db.prepare("DELETE FROM vec_entries WHERE filepath = ?").run(filepath);
    }
  });
  txn();
}

export function getFileMeta(
  db: Database,
  filepath: string,
): { mtime_ms: number; size_bytes: number } | undefined {
  return (
    (db
      .prepare("SELECT mtime_ms, size_bytes FROM file_meta WHERE filepath = ?")
      .get(filepath) as { mtime_ms: number; size_bytes: number } | null) ??
    undefined
  );
}

export function clearVecEntries(db: Database): void {
  try {
    db.run("DELETE FROM vec_entries");
  } catch {
    // vec table may not exist
  }
}

export function getAllIndexedFilepaths(db: Database): string[] {
  const rows = db.prepare("SELECT filepath FROM file_meta").all() as { filepath: string }[];
  return rows.map((r) => r.filepath);
}
