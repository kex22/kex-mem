import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { findProjectRoot, memoryDir, dbPath } from "../lib/paths.js";
import { readMarkdown, extractTitle, extractBody } from "../lib/markdown.js";
import { openDb, upsertDocument, clearVecEntries } from "../lib/db.js";
import { loadConfig } from "../lib/config-store.js";
import { createEmbedder } from "../lib/embedder.js";
import type { Embedder } from "../lib/embedder.js";

export async function reindexCommand(): Promise<void> {
  const root = findProjectRoot();
  const memDir = memoryDir(root);
  const config = loadConfig(root);
  const handle = openDb(dbPath(root), { vecDimension: config.vector.dimension });

  const useVec = handle.vecEnabled && config.vector.enabled;
  let embedder: Embedder | null = null;

  if (useVec) {
    try {
      embedder = createEmbedder(config.vector.provider, config.vector.openaiKey);
    } catch (err: any) {
      console.error(`Embedder init failed: ${err.message}`);
    }
    // Clear existing vec entries for full rebuild
    clearVecEntries(handle.db);
  }

  let count = 0;
  const files = readdirSync(memDir).filter((f) => f.endsWith(".md"));

  // Collect texts for batch embedding
  const entries: { relPath: string; title: string; body: string; mtimeMs: number; size: number }[] = [];
  for (const file of files) {
    const fullPath = join(memDir, file);
    const content = readMarkdown(fullPath);
    if (!content) continue;

    const stat = statSync(fullPath);
    const relPath = relative(memDir, fullPath);
    entries.push({
      relPath,
      title: extractTitle(content),
      body: extractBody(content),
      mtimeMs: stat.mtimeMs,
      size: stat.size,
    });
  }

  // Batch embed if available
  let embeddings: Float32Array[] | null = null;
  if (embedder && entries.length > 0) {
    try {
      embeddings = await embedder.embedBatch(entries.map((e) => e.body));
    } catch (err: any) {
      console.error(`Batch embedding failed: ${err.message}`);
    }
  }

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const embedding = embeddings ? embeddings[i] : undefined;
    upsertDocument(handle.db, e.relPath, e.title, e.body, e.mtimeMs, e.size, embedding);
    count++;
  }

  handle.db.close();
  console.log(`Indexed ${count} files.`);
}
