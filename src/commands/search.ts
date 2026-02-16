import { findProjectRoot, dbPath } from "../lib/paths.js";
import { openDb, searchFts } from "../lib/db.js";

export function searchCommand(query: string, opts: { limit?: string }): void {
  const root = findProjectRoot();
  const limit = parseInt(opts.limit || "10", 10);

  const db = openDb(dbPath(root));
  const results = searchFts(db, query, limit);
  db.close();

  if (results.length === 0) {
    console.log("No results.");
    return;
  }

  for (const r of results) {
    console.log(`[${r.filepath}] ${r.snippet}`);
  }
}
