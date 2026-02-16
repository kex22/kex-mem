import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { findProjectRoot, memoryDir, dbPath } from "../lib/paths.js";
import { readMarkdown, extractTitle, extractBody } from "../lib/markdown.js";
import { openDb, upsertDocument, clearVecEntries, getFileMeta, removeDocument, getAllIndexedFilepaths } from "../lib/db.js";
import { loadConfig } from "../lib/config-store.js";
import { createEmbedder } from "../lib/embedder.js";
import type { Embedder } from "../lib/embedder.js";

export async function indexCommand(filepath?: string, opts: { full?: boolean } = {}): Promise<void> {
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
  }

  // Single-file mode
  if (filepath) {
    const fullPath = join(memDir, filepath);
    if (!existsSync(fullPath)) {
      removeDocument(handle.db, filepath, handle.vecEnabled);
      handle.db.close();
      console.log(`Removed ${filepath} from index.`);
      return;
    }
    const content = readMarkdown(fullPath);
    if (!content) {
      removeDocument(handle.db, filepath, handle.vecEnabled);
      handle.db.close();
      console.log(`Removed ${filepath} from index.`);
      return;
    }
    const stat = statSync(fullPath);
    const title = extractTitle(content);
    const body = extractBody(content);
    let embedding: Float32Array | undefined;
    if (embedder) {
      try {
        const batch = await embedder.embedBatch([body]);
        embedding = batch[0];
      } catch (err: any) {
        console.error(`Embedding failed: ${err.message}`);
      }
    }
    upsertDocument(handle.db, filepath, title, body, stat.mtimeMs, stat.size, embedding);
    handle.db.close();
    console.log(`Indexed ${filepath}`);
    return;
  }

  // Full rebuild mode
  if (opts.full) {
    handle.db.run("DELETE FROM memory_fts");
    handle.db.run("DELETE FROM file_meta");
    if (useVec) clearVecEntries(handle.db);

    const files = readdirSync(memDir).filter((f) => f.endsWith(".md"));
    const entries: { relPath: string; title: string; body: string; mtimeMs: number; size: number }[] = [];
    for (const file of files) {
      const fullPath = join(memDir, file);
      const content = readMarkdown(fullPath);
      if (!content) continue;
      const stat = statSync(fullPath);
      entries.push({
        relPath: relative(memDir, fullPath),
        title: extractTitle(content),
        body: extractBody(content),
        mtimeMs: stat.mtimeMs,
        size: stat.size,
      });
    }

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
      upsertDocument(handle.db, e.relPath, e.title, e.body, e.mtimeMs, e.size, embeddings ? embeddings[i] : undefined);
    }

    handle.db.close();
    console.log(`Indexed ${entries.length} files (full rebuild).`);
    return;
  }

  // Incremental mode (default)
  const files = readdirSync(memDir).filter((f) => f.endsWith(".md"));
  const indexed = new Set(getAllIndexedFilepaths(handle.db));
  const diskFiles = new Set(files.map((f) => relative(memDir, join(memDir, f))));

  // Detect deleted files
  let removed = 0;
  for (const fp of indexed) {
    if (!diskFiles.has(fp)) {
      removeDocument(handle.db, fp, handle.vecEnabled);
      removed++;
    }
  }

  // Collect changed files (mtime comparison)
  const changed: { relPath: string; title: string; body: string; mtimeMs: number; size: number }[] = [];
  let skipped = 0;
  for (const file of files) {
    const fullPath = join(memDir, file);
    const relPath = relative(memDir, fullPath);
    const stat = statSync(fullPath);
    const meta = getFileMeta(handle.db, relPath);
    if (meta && meta.mtime_ms >= stat.mtimeMs) {
      skipped++;
      continue;
    }
    const content = readMarkdown(fullPath);
    if (!content) {
      skipped++;
      continue;
    }
    changed.push({
      relPath,
      title: extractTitle(content),
      body: extractBody(content),
      mtimeMs: stat.mtimeMs,
      size: stat.size,
    });
  }

  let embeddings: Float32Array[] | null = null;
  if (embedder && changed.length > 0) {
    try {
      embeddings = await embedder.embedBatch(changed.map((e) => e.body));
    } catch (err: any) {
      console.error(`Batch embedding failed: ${err.message}`);
    }
  }

  for (let i = 0; i < changed.length; i++) {
    const e = changed[i];
    upsertDocument(handle.db, e.relPath, e.title, e.body, e.mtimeMs, e.size, embeddings ? embeddings[i] : undefined);
  }

  handle.db.close();
  const parts: string[] = [`Indexed ${changed.length} files`];
  if (skipped > 0) parts.push(`${skipped} skipped`);
  if (removed > 0) parts.push(`${removed} removed`);
  console.log(parts.length === 1 ? `${parts[0]}.` : `${parts[0]} (${parts.slice(1).join(", ")}).`);
}
