import { findProjectRoot, dbPath } from "../lib/paths.js";
import { openDb, searchFts, hybridSearch } from "../lib/db.js";
import { loadConfig } from "../lib/config-store.js";
import { createEmbedder } from "../lib/embedder.js";

export async function searchCommand(query: string, opts: { limit?: string }): Promise<void> {
  const root = findProjectRoot();
  const limit = parseInt(opts.limit || "10", 10);
  const config = loadConfig(root);
  const handle = openDb(dbPath(root), { vecDimension: config.vector.dimension });

  // If vector enabled, use hybrid search
  if (handle.vecEnabled && config.vector.enabled) {
    let queryEmbedding: Float32Array | null = null;
    try {
      const embedder = createEmbedder(config.vector.provider, config.vector.openaiKey);
      queryEmbedding = await embedder.embed(query);
    } catch (err: any) {
      console.error(`Embedding failed, falling back to FTS: ${err.message}`);
    }

    const { results, ftsError } = hybridSearch(handle, query, queryEmbedding, limit);
    handle.db.close();

    if (ftsError) {
      console.error(`FTS query error: ${ftsError}`);
    }
    if (results.length === 0) {
      console.log("No results.");
      return;
    }
    for (const r of results) {
      console.log(`[${r.filepath}] ${r.snippet}`);
    }
    return;
  }

  // FTS-only fallback
  let results;
  try {
    results = searchFts(handle.db, query, limit);
  } catch (err: any) {
    console.log(`Invalid query: ${err.message}`);
    handle.db.close();
    return;
  }
  handle.db.close();

  if (results.length === 0) {
    console.log("No results.");
    return;
  }

  for (const r of results) {
    console.log(`[${r.filepath}] ${r.snippet}`);
  }
}
