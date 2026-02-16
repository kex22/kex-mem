import { existsSync } from "node:fs";
import { findProjectRoot, dailyLogPath, durableMemoryPath, userMemoryPath, formatDate } from "../lib/paths.js";
import { readMarkdown } from "../lib/markdown.js";
import { parseLogEntries, filterByTag } from "../lib/parser.js";

export function recallCommand(
  date?: string,
  opts: { durable?: boolean; user?: boolean; week?: boolean; tag?: string; limit?: string } = {},
): void {
  const root = findProjectRoot();

  if (opts.durable) {
    const content = readMarkdown(durableMemoryPath(root));
    if (!content) {
      console.log("No durable memory found. Run `kex-mem init` first.");
      return;
    }
    printWithLimit(content, opts.limit);
    return;
  }

  if (opts.user) {
    const content = readMarkdown(userMemoryPath(root));
    if (!content) {
      console.log("No user preferences found. Run `kex-mem init` to create USER.md.");
      return;
    }
    printWithLimit(content, opts.limit);
    return;
  }

  if (date) {
    const logPath = dailyLogPath(root, new Date(date + "T00:00:00"));
    const content = readMarkdown(logPath);
    if (!content) {
      console.log(`No log for ${date}`);
      return;
    }
    if (opts.tag) {
      printTagFiltered(content, opts.tag, opts.limit);
    } else {
      printWithLimit(content, opts.limit);
    }
    return;
  }

  // Default: today + yesterday, or --week for 7 days
  const days = opts.week ? 7 : 2;
  const now = new Date();
  let found = false;

  if (opts.tag) {
    // Tag-filtered mode: collect matching entries, then output with limit
    const outputParts: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const logPath = dailyLogPath(root, d);
      if (existsSync(logPath)) {
        const content = readMarkdown(logPath);
        if (content) {
          const entries = parseLogEntries(content);
          const filtered = filterByTag(entries, opts.tag);
          if (filtered.length > 0) {
            if (found) outputParts.push("---");
            outputParts.push(`# ${formatDate(d)}`);
            for (const e of filtered) {
              outputParts.push(e.raw);
            }
            found = true;
          }
        }
      }
    }
    if (!found) {
      console.log(`No entries with tag: ${opts.tag}`);
      return;
    }
    printWithLimit(outputParts.join("\n"), opts.limit);
  } else {
    // Normal mode: preserve original per-day output
    const collected: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const logPath = dailyLogPath(root, d);
      if (existsSync(logPath)) {
        const content = readMarkdown(logPath);
        if (content) {
          collected.push(content);
          found = true;
        }
      }
    }
    if (!found) {
      console.log("No recent logs.");
      return;
    }
    if (opts.limit) {
      printWithLimit(collected.join("\n---\n"), opts.limit);
    } else {
      for (let i = 0; i < collected.length; i++) {
        if (i > 0) console.log("---");
        console.log(collected[i]);
      }
    }
  }
}

function printWithLimit(text: string, limit?: string): void {
  if (!limit) {
    console.log(text);
    return;
  }
  const n = parseInt(limit, 10);
  if (isNaN(n) || n <= 0) {
    console.log(text);
    return;
  }
  const lines = text.split("\n");
  if (lines.length <= n) {
    console.log(text);
    return;
  }
  console.log(lines.slice(0, n).join("\n"));
  console.log(`... (${lines.length - n} more lines)`);
}

function printTagFiltered(content: string, tag: string, limit?: string): void {
  const entries = parseLogEntries(content);
  const filtered = filterByTag(entries, tag);
  if (filtered.length === 0) {
    console.log(`No entries with tag: ${tag}`);
    return;
  }
  const output = filtered.map((e) => e.raw).join("\n");
  printWithLimit(output, limit);
}
