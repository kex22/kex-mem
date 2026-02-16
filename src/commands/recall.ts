import { existsSync } from "node:fs";
import { findProjectRoot, dailyLogPath, durableMemoryPath, formatDate } from "../lib/paths.js";
import { readMarkdown } from "../lib/markdown.js";

export function recallCommand(date?: string, opts: { durable?: boolean; week?: boolean } = {}): void {
  const root = findProjectRoot();

  if (opts.durable) {
    const content = readMarkdown(durableMemoryPath(root));
    if (!content) {
      console.log("No durable memory found. Run `kex-mem init` first.");
      return;
    }
    console.log(content);
    return;
  }

  if (date) {
    const logPath = dailyLogPath(root, new Date(date + "T00:00:00"));
    const content = readMarkdown(logPath);
    if (!content) {
      console.log(`No log for ${date}`);
      return;
    }
    console.log(content);
    return;
  }

  // Default: today + yesterday, or --week for 7 days
  const days = opts.week ? 7 : 2;
  const now = new Date();
  let found = false;

  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const logPath = dailyLogPath(root, d);
    if (existsSync(logPath)) {
      const content = readMarkdown(logPath);
      if (content) {
        if (found) console.log("---");
        console.log(content);
        found = true;
      }
    }
  }

  if (!found) {
    console.log("No recent logs.");
  }
}
