import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { findProjectRoot, memoryDir, dbPath } from "../lib/paths.js";
import { readMarkdown, extractTitle, extractBody } from "../lib/markdown.js";
import { openDb, upsertDocument } from "../lib/db.js";

export function reindexCommand(): void {
  const root = findProjectRoot();
  const memDir = memoryDir(root);
  const db = openDb(dbPath(root));

  let count = 0;
  const files = readdirSync(memDir).filter((f) => f.endsWith(".md"));

  for (const file of files) {
    const fullPath = join(memDir, file);
    const content = readMarkdown(fullPath);
    if (!content) continue;

    const stat = statSync(fullPath);
    const relPath = relative(memDir, fullPath);
    upsertDocument(db, relPath, extractTitle(content), extractBody(content), stat.mtimeMs, stat.size);
    count++;
  }

  db.close();
  console.log(`Indexed ${count} files.`);
}
