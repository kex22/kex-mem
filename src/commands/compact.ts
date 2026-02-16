import { readdirSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { findProjectRoot, memoryDir, durableMemoryPath, formatDate } from "../lib/paths.js";
import { readMarkdown, writeMarkdown } from "../lib/markdown.js";

export function compactCommand(opts: { auto?: boolean; smart?: boolean; days?: string }): void {
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

  if (opts.smart) {
    const memoryContent = readMarkdown(durableMemoryPath(root));
    let output = `## kex-mem compact --smart\n\n`;
    output += `### Instructions\n`;
    output += `Review the daily logs below and update memory/MEMORY.md:\n`;
    output += `1. Extract key decisions, conventions, architecture notes, and bug fixes\n`;
    output += `2. Merge into appropriate sections of MEMORY.md (do NOT duplicate)\n`;
    output += `3. Delete the processed daily log files listed below\n`;
    output += `4. Run \`kex-mem index\` after all changes\n\n`;
    output += `### Current MEMORY.md\n\`\`\`markdown\n${memoryContent}\n\`\`\`\n\n`;
    output += `### Daily Logs to Process\n\n`;
    for (const f of oldFiles) {
      const content = readMarkdown(join(memDir, f));
      output += `#### ${f}\n\`\`\`markdown\n${content}\n\`\`\`\n\n`;
    }
    output += `### Files to Delete After Processing\n`;
    for (const f of oldFiles) {
      output += `- memory/${f}\n`;
    }
    console.log(output);
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
        try {
          renameSync(join(memDir, f), join(archiveDir, `daily-${f}`));
        } catch (err: any) {
          console.log(`Warning: could not rename ${f}: ${err.message}`);
        }
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
