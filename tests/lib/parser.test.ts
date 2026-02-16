import { describe, test, expect } from "bun:test";
import { parseLogEntries, filterByTag } from "../../src/lib/parser.js";

describe("parseLogEntries", () => {
  test("parses entry with tag", () => {
    const content = "# 2026-02-15\n\n- 14:30 [decision] Chose Bun as runtime\n";
    const entries = parseLogEntries(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].time).toBe("14:30");
    expect(entries[0].tag).toBe("decision");
    expect(entries[0].message).toBe("Chose Bun as runtime");
    expect(entries[0].lineNum).toBe(3);
    expect(entries[0].raw).toBe("- 14:30 [decision] Chose Bun as runtime");
  });

  test("parses entry without tag", () => {
    const content = "- 09:15 Plain note about architecture\n";
    const entries = parseLogEntries(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].tag).toBeNull();
    expect(entries[0].message).toBe("Plain note about architecture");
  });

  test("parses entry with [done] marker", () => {
    const content = "- 14:30 [todo] Need to add unit tests [done]\n";
    const entries = parseLogEntries(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].tag).toBe("todo");
    expect(entries[0].message).toBe("Need to add unit tests [done]");
  });

  test("empty content returns empty array", () => {
    expect(parseLogEntries("")).toHaveLength(0);
  });

  test("skips non-entry lines (headings, blank lines)", () => {
    const content = "# 2026-02-15\n\nSome random text\n\n- 10:00 [bug] Fix null pointer\n";
    const entries = parseLogEntries(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].tag).toBe("bug");
  });

  test("parses multiple entries", () => {
    const content = [
      "# 2026-02-15",
      "",
      "- 14:30 [decision] Chose Bun",
      "- 15:00 [bug] Fixed parser",
      "- 16:00 Plain note",
    ].join("\n");
    const entries = parseLogEntries(content);
    expect(entries).toHaveLength(3);
    expect(entries[0].tag).toBe("decision");
    expect(entries[1].tag).toBe("bug");
    expect(entries[2].tag).toBeNull();
  });
});

describe("filterByTag", () => {
  const entries = parseLogEntries(
    [
      "- 14:30 [decision] Chose Bun",
      "- 15:00 [bug] Fixed parser",
      "- 16:00 [decision] Use FTS5",
      "- 17:00 Plain note",
    ].join("\n"),
  );

  test("filters by matching tag", () => {
    const filtered = filterByTag(entries, "decision");
    expect(filtered).toHaveLength(2);
    expect(filtered[0].message).toBe("Chose Bun");
    expect(filtered[1].message).toBe("Use FTS5");
  });

  test("returns empty for non-matching tag", () => {
    expect(filterByTag(entries, "todo")).toHaveLength(0);
  });
});
