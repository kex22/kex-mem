import { readdirSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { findProjectRoot, memoryDir, formatDate } from "../lib/paths.js";
import { readMarkdown, writeMarkdown } from "../lib/markdown.js";

export function compactCommand(opts: { auto?: boolean; days?: string }): void {
  const root = findProjectRoot();
  const memDir = memoryDir(root);
  const maxAge = parseInt(opts.days || "30", 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAge);

  const files = readdirSync(memDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort();

  const oldFiles = files.filter((f) => {
    const dateStr = f.replace(".md", "");
    return new Date(dateStr + "T00:00:00") < cutoff;
  });

  if (oldFiles.length === 0) {
    console.log("No logs older than " + maxAge + " days.");
    return;
  }

  if (opts.auto) {
    // Group by month and archive
    const byMonth = new Map<string, string[]>();
    for (const f of oldFiles) {
      const month = f.slice(0, 7); // YYYY-MM
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month)!.push(f);
    }

    const archiveDir = join(memDir, "archive");
    if (!existsSync(archiveDir)) {
      mkdirSync(archiveDir, { recursive: true });
    }

    for (const [month, monthFiles] of byMonth) {
      let combined = `# Archive: ${month}\n\n`;
      for (const f of monthFiles) {
        const content = readMarkdown(join(memDir, f));
        combined += content + "\n\n---\n\n";
      }
      writeMarkdown(join(archiveDir, `${month}.md`), combined);

      for (const f of monthFiles) {
        renameSync(join(memDir, f), join(archiveDir, `daily-${f}`));
      }
      console.log(`Archived ${monthFiles.length} files for ${month}`);
    }
  } else {
    // Just list what would be compacted
    console.log(`${oldFiles.length} logs older than ${maxAge} days:`);
    for (const f of oldFiles) {
      console.log(`  ${f}`);
    }
    console.log("\nRun with --auto to archive by month.");
  }
}
