import { statSync } from "node:fs";
import { relative } from "node:path";
import { findProjectRoot, dailyLogPath, dbPath, memoryDir, formatDate } from "../lib/paths.js";
import { readMarkdown, appendMarkdown, extractTitle, extractBody } from "../lib/markdown.js";
import { openDb, upsertDocument } from "../lib/db.js";

const VALID_TAGS = ["decision", "bug", "convention", "todo"] as const;

export function logCommand(message: string, opts: { tag?: string }): void {
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

  // Update FTS index
  const content = readMarkdown(logPath);
  const stat = statSync(logPath);
  const relPath = relative(memoryDir(root), logPath);
  const db = openDb(dbPath(root));
  upsertDocument(db, relPath, extractTitle(content), extractBody(content), stat.mtimeMs, stat.size);
  db.close();

  console.log(`Logged to ${formatDate(now)}`);
}
