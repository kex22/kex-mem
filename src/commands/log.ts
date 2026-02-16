import { statSync } from "node:fs";
import { relative } from "node:path";
import { findProjectRoot, dailyLogPath, dbPath, memoryDir, formatDate } from "../lib/paths.js";
import { readMarkdown, appendMarkdown, extractTitle, extractBody } from "../lib/markdown.js";
import { openDb, upsertDocument } from "../lib/db.js";
import { loadConfig } from "../lib/config-store.js";
import { createEmbedder } from "../lib/embedder.js";

const VALID_TAGS = ["decision", "bug", "convention", "todo"] as const;

export async function logCommand(message: string, opts: { tag?: string }): Promise<void> {
  const root = findProjectRoot();
  const now = new Date();
  const logPath = dailyLogPath(root, now);

  // Validate tag
  if (opts.tag && !VALID_TAGS.includes(opts.tag as any)) {
    console.error(`Invalid tag: ${opts.tag}. Valid: ${VALID_TAGS.join(", ")}`);
    process.exit(1);
  }

  // Build entry
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const tagStr = opts.tag ? ` [${opts.tag}]` : "";
  const entry = `- ${time}${tagStr} ${message}\n`;

  // Create daily log with header if new
  const existing = readMarkdown(logPath);
  if (!existing) {
    const header = `# ${formatDate(now)}\n\n`;
    appendMarkdown(logPath, header + entry);
  } else {
    appendMarkdown(logPath, entry);
  }

  // Update FTS index + optional vector
  const content = readMarkdown(logPath);
  const stat = statSync(logPath);
  const relPath = relative(memoryDir(root), logPath);
  const config = loadConfig(root);
  const handle = openDb(dbPath(root), { vecDimension: config.vector.dimension });

  let embedding: Float32Array | undefined;
  if (handle.vecEnabled && config.vector.enabled) {
    try {
      const embedder = createEmbedder(config.vector.provider, config.vector.openaiKey);
      embedding = await embedder.embed(extractBody(content));
    } catch (err: any) {
      console.error(`Embedding failed: ${err.message}`);
    }
  }

  upsertDocument(handle.db, relPath, extractTitle(content), extractBody(content), stat.mtimeMs, stat.size, embedding);
  handle.db.close();

  console.log(`Logged to ${formatDate(now)}`);
}
