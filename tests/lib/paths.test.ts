import { describe, test, expect } from "bun:test";
import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  findProjectRoot,
  memoryDir,
  dbPath,
  durableMemoryPath,
  dailyLogPath,
  claudeMdPath,
  formatDate,
  parseDate,
} from "../../src/lib/paths.js";
import { makeTempProject, cleanTempProject } from "../helpers.js";

describe("paths", () => {
  describe("formatDate", () => {
    test("formats date as YYYY-MM-DD", () => {
      expect(formatDate(new Date(2025, 0, 5))).toBe("2025-01-05");
    });

    test("pads single-digit month and day", () => {
      expect(formatDate(new Date(2025, 2, 3))).toBe("2025-03-03");
    });

    test("handles December correctly", () => {
      expect(formatDate(new Date(2025, 11, 31))).toBe("2025-12-31");
    });

    test("defaults to current date", () => {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      expect(formatDate()).toBe(`${y}-${m}-${d}`);
    });
  });

  describe("parseDate", () => {
    test("parses YYYY-MM-DD string", () => {
      const d = parseDate("2025-03-15");
      expect(d.getFullYear()).toBe(2025);
      expect(d.getMonth()).toBe(2); // 0-indexed
      expect(d.getDate()).toBe(15);
    });

    test("roundtrips with formatDate", () => {
      const original = new Date(2025, 5, 20);
      const str = formatDate(original);
      const parsed = parseDate(str);
      expect(parsed.getFullYear()).toBe(2025);
      expect(parsed.getMonth()).toBe(5);
      expect(parsed.getDate()).toBe(20);
    });

    test("throws on invalid string 'abc'", () => {
      expect(() => parseDate("abc")).toThrow();
    });

    test("throws on invalid month/day '2025-13-45'", () => {
      expect(() => parseDate("2025-13-45")).toThrow();
    });

    test("throws on empty string", () => {
      expect(() => parseDate("")).toThrow();
    });
  });

  describe("path helpers", () => {
    test("memoryDir returns <root>/memory", () => {
      expect(memoryDir("/proj")).toBe(join("/proj", "memory"));
    });

    test("dbPath returns <root>/memory/.kex-mem.db", () => {
      expect(dbPath("/proj")).toBe(join("/proj", "memory", ".kex-mem.db"));
    });

    test("durableMemoryPath returns <root>/memory/MEMORY.md", () => {
      expect(durableMemoryPath("/proj")).toBe(join("/proj", "memory", "MEMORY.md"));
    });

    test("claudeMdPath returns <root>/CLAUDE.md", () => {
      expect(claudeMdPath("/proj")).toBe(join("/proj", "CLAUDE.md"));
    });

    test("dailyLogPath formats date into filename", () => {
      const d = new Date(2025, 0, 7);
      expect(dailyLogPath("/proj", d)).toBe(join("/proj", "memory", "2025-01-07.md"));
    });

    test("dailyLogPath defaults to today", () => {
      const result = dailyLogPath("/proj");
      const today = formatDate();
      expect(result).toBe(join("/proj", "memory", `${today}.md`));
    });
  });

  describe("findProjectRoot", () => {
    test("finds root with memory/ directory", () => {
      const tmp = makeTempProject();
      try {
        const found = findProjectRoot(tmp);
        expect(found).toBe(tmp);
      } finally {
        cleanTempProject(tmp);
      }
    });

    test("finds root with package.json", () => {
      const tmp = makeTempProject();
      // Remove memory, add package.json
      const { rmSync } = require("node:fs");
      rmSync(join(tmp, "memory"), { recursive: true });
      writeFileSync(join(tmp, "package.json"), "{}", "utf-8");
      try {
        const found = findProjectRoot(tmp);
        expect(found).toBe(tmp);
      } finally {
        cleanTempProject(tmp);
      }
    });

    test("finds root with .git directory", () => {
      const tmp = makeTempProject();
      const { rmSync } = require("node:fs");
      rmSync(join(tmp, "memory"), { recursive: true });
      mkdirSync(join(tmp, ".git"));
      try {
        const found = findProjectRoot(tmp);
        expect(found).toBe(tmp);
      } finally {
        cleanTempProject(tmp);
      }
    });

    test("walks up from subdirectory", () => {
      const tmp = makeTempProject();
      const sub = join(tmp, "a", "b", "c");
      mkdirSync(sub, { recursive: true });
      try {
        const found = findProjectRoot(sub);
        expect(found).toBe(tmp);
      } finally {
        cleanTempProject(tmp);
      }
    });
  });
});
