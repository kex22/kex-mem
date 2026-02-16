export interface LogEntry {
  time: string;
  tag: string | null;
  message: string;
  lineNum: number;
  raw: string;
}

const ENTRY_RE = /^- (\d{2}:\d{2})\s*(?:\[(\w+)\])?\s*(.+)$/;

export function parseLogEntries(content: string): LogEntry[] {
  const entries: LogEntry[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(ENTRY_RE);
    if (match) {
      entries.push({
        time: match[1],
        tag: match[2] || null,
        message: match[3],
        lineNum: i + 1,
        raw: lines[i],
      });
    }
  }
  return entries;
}

export function filterByTag(entries: LogEntry[], tag: string): LogEntry[] {
  return entries.filter((e) => e.tag === tag);
}
