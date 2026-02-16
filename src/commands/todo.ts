import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { findProjectRoot, memoryDir } from "../lib/paths.js";
import { readMarkdown } from "../lib/markdown.js";
import { parseLogEntries, filterByTag } from "../lib/parser.js";
import { indexCommand } from "./index.js";

interface TodoItem {
  date: string;
  time: string;
  message: string;
  filePath: string;
  lineNum: number;
  done: boolean;
}

export async function todoCommand(opts: { resolve?: string; all?: boolean } = {}): Promise<void> {
  const root = findProjectRoot();
  const memDir = memoryDir(root);

  if (opts.resolve) {
    await resolveTask(memDir, opts.resolve);
    return;
  }

  const todos = collectTodos(memDir);

  if (todos.length === 0) {
    console.log("No open TODOs.");
    return;
  }

  const filtered = opts.all ? todos : todos.filter((t) => !t.done);

  if (filtered.length === 0) {
    console.log("No open TODOs.");
    return;
  }

  for (const t of filtered) {
    const doneMarker = t.done ? " [done]" : "";
    console.log(`${t.date} ${t.time}  ${t.message}${doneMarker}`);
  }
}

function collectTodos(memDir: string): TodoItem[] {
  const dateRe = /^(\d{4}-\d{2}-\d{2})\.md$/;
  let files: string[];
  try {
    files = readdirSync(memDir).filter((f) => dateRe.test(f));
  } catch {
    return [];
  }

  // Sort by date descending
  files.sort((a, b) => b.localeCompare(a));

  const todos: TodoItem[] = [];
  for (const file of files) {
    const dateMatch = file.match(dateRe)!;
    const date = dateMatch[1];
    const filePath = join(memDir, file);
    const content = readMarkdown(filePath);
    if (!content) continue;

    const entries = parseLogEntries(content);
    const todoEntries = filterByTag(entries, "todo");

    for (const entry of todoEntries) {
      const done = entry.raw.includes("[done]");
      // Strip [done] from display message
      const message = done ? entry.message.replace(/\s*\[done\]\s*$/, "") : entry.message;
      todos.push({ date, time: entry.time, message, filePath, lineNum: entry.lineNum, done });
    }
  }

  return todos;
}

async function resolveTask(memDir: string, substring: string): Promise<void> {
  const todos = collectTodos(memDir);
  const openTodos = todos.filter((t) => !t.done);

  // Find the most recent matching open TODO
  const match = openTodos.find((t) => t.message.includes(substring));

  if (!match) {
    console.log("No matching open TODO.");
    return;
  }

  // Read the file and append [done] to the matching line
  const content = readFileSync(match.filePath, "utf-8");
  const lines = content.split("\n");
  const lineIdx = match.lineNum - 1;

  if (lineIdx >= 0 && lineIdx < lines.length) {
    lines[lineIdx] = lines[lineIdx] + " [done]";
    writeFileSync(match.filePath, lines.join("\n"), "utf-8");
  }

  console.log(`Resolved: ${match.message}`);

  // Re-index the modified file
  const relPath = relative(memDir, match.filePath);
  await indexCommand(relPath);
}
