import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function readMarkdown(filepath: string): string {
  if (!existsSync(filepath)) return "";
  return readFileSync(filepath, "utf-8");
}

export function writeMarkdown(filepath: string, content: string): void {
  const dir = dirname(filepath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filepath, content, "utf-8");
}

export function appendMarkdown(filepath: string, content: string): void {
  const existing = readMarkdown(filepath);
  const separator = existing && !existing.endsWith("\n") ? "\n" : "";
  writeMarkdown(filepath, existing + separator + content);
}

/**
 * Extract title from markdown content (first # heading or first line).
 */
export function extractTitle(content: string): string {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      return trimmed.slice(2).trim();
    }
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return "Untitled";
}

/**
 * Extract body text from markdown (strip headings markers for indexing).
 */
export function extractBody(content: string): string {
  return content
    .split("\n")
    .map((line) => line.replace(/^#{1,6}\s+/, ""))
    .join("\n")
    .trim();
}
