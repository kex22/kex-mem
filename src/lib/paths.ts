import { resolve, join } from "node:path";
import { existsSync } from "node:fs";

/**
 * Find the project root by walking up from cwd looking for .git, package.json, or memory/.
 * Falls back to cwd if nothing found.
 */
export function findProjectRoot(from: string = process.cwd()): string {
  let dir = resolve(from);
  const root = resolve("/");
  while (dir !== root) {
    if (
      existsSync(join(dir, ".git")) ||
      existsSync(join(dir, "package.json")) ||
      existsSync(join(dir, "memory"))
    ) {
      return dir;
    }
    dir = resolve(dir, "..");
  }
  return process.cwd();
}

export function memoryDir(projectRoot: string): string {
  return join(projectRoot, "memory");
}

export function dbPath(projectRoot: string): string {
  return join(memoryDir(projectRoot), ".kex-mem.db");
}

export function durableMemoryPath(projectRoot: string): string {
  return join(memoryDir(projectRoot), "MEMORY.md");
}

export function dailyLogPath(projectRoot: string, date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return join(memoryDir(projectRoot), `${y}-${m}-${d}.md`);
}

export function claudeMdPath(projectRoot: string): string {
  return join(projectRoot, "CLAUDE.md");
}

export function formatDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDate(str: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    throw new Error(`Invalid date format: "${str}" (expected YYYY-MM-DD)`);
  }
  const [y, m, d] = str.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    throw new Error(`Invalid date: "${str}"`);
  }
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime()) || date.getMonth() !== m - 1 || date.getDate() !== d) {
    throw new Error(`Invalid date: "${str}"`);
  }
  return date;
}
