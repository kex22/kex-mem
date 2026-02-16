import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface SearchResult {
  filepath: string;
  title: string;
  snippet: string;
  rank: number;
}

export function openDb(dbFilePath: string): Database {
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

  return db;
}

export function upsertDocument(
  db: Database,
  filepath: string,
  title: string,
  body: string,
  mtimeMs: number,
  sizeBytes: number,
): void {
  const existing = db
    .prepare("SELECT mtime_ms FROM file_meta WHERE filepath = ?")
    .get(filepath) as { mtime_ms: number } | undefined;

  if (existing && existing.mtime_ms >= mtimeMs) {
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

export function removeDocument(db: Database, filepath: string): void {
  const txn = db.transaction(() => {
    db.prepare("DELETE FROM memory_fts WHERE filepath = ?").run(filepath);
    db.prepare("DELETE FROM file_meta WHERE filepath = ?").run(filepath);
  });
  txn();
}

export function getFileMeta(
  db: Database,
  filepath: string,
): { mtime_ms: number; size_bytes: number } | undefined {
  return (db
    .prepare("SELECT mtime_ms, size_bytes FROM file_meta WHERE filepath = ?")
    .get(filepath) as { mtime_ms: number; size_bytes: number } | null) ?? undefined;
}
