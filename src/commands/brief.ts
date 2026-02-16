import { readdirSync } from "node:fs";
import { join } from "node:path";
import { findProjectRoot, memoryDir, durableMemoryPath } from "../lib/paths.js";
import { readMarkdown } from "../lib/markdown.js";
import { parseLogEntries, filterByTag } from "../lib/parser.js";

export function briefCommand(opts: { days?: string; lines?: string } = {}): void {
  const root = findProjectRoot();
  const memDir = memoryDir(root);
  const maxLines = parseInt(opts.lines || "20", 10);
  const maxDays = parseInt(opts.days || "3", 10);

  const sections: string[] = [];

  // === DURABLE ===
  const durableContent = readMarkdown(durableMemoryPath(root));
  if (durableContent) {
    const lines = durableContent.split("\n");
    const truncated = lines.slice(0, maxLines);
    sections.push("=== DURABLE ===");
    sections.push(truncated.join("\n"));
    if (lines.length > maxLines) {
      sections.push(`... (${lines.length - maxLines} more lines in MEMORY.md)`);
    }
  }

  // === RECENT + collect TODOs in one pass ===
  const dateRe = /^(\d{4}-\d{2}-\d{2})\.md$/;
  let logFiles: string[];
  try {
    logFiles = readdirSync(memDir).filter((f) => dateRe.test(f));
  } catch {
    logFiles = [];
  }
  logFiles.sort((a, b) => b.localeCompare(a));
  const recentFiles = logFiles.slice(0, maxDays);
  const olderFiles = logFiles.slice(maxDays);

  const allTodos: { date: string; time: string; message: string }[] = [];

  if (recentFiles.length > 0) {
    const recentParts: string[] = [];
    for (const file of recentFiles) {
      const content = readMarkdown(join(memDir, file));
      if (!content) continue;
      const date = file.match(dateRe)![1];
      recentParts.push(`# ${date}`);
      const entries = parseLogEntries(content);
      for (const e of entries) {
        recentParts.push(e.raw);
      }
      // Collect TODOs from recent files
      const todos = filterByTag(entries, "todo");
      for (const t of todos) {
        if (!t.raw.includes("[done]")) {
          allTodos.push({ date, time: t.time, message: t.message });
        }
      }
    }
    if (recentParts.length > 0) {
      sections.push("");
      sections.push(`=== RECENT (${maxDays}d) ===`);
      sections.push(recentParts.join("\n"));
    }
  }

  // Collect TODOs from older files (not already scanned)
  for (const file of olderFiles) {
    const content = readMarkdown(join(memDir, file));
    if (!content) continue;
    const date = file.match(dateRe)![1];
    const entries = parseLogEntries(content);
    const todos = filterByTag(entries, "todo");
    for (const t of todos) {
      if (!t.raw.includes("[done]")) {
        allTodos.push({ date, time: t.time, message: t.message });
      }
    }
  }

  if (allTodos.length > 0) {
    sections.push("");
    sections.push(`=== TODO (${allTodos.length} open) ===`);
    for (const t of allTodos) {
      sections.push(`${t.date} ${t.time}  ${t.message}`);
    }
  }

  if (sections.length === 0) {
    console.log("No memory data found.");
    return;
  }

  console.log(sections.join("\n"));
}
