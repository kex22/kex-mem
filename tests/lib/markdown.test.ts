import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import {
  readMarkdown,
  writeMarkdown,
  appendMarkdown,
  extractTitle,
  extractBody,
} from "../../src/lib/markdown.js";
import { makeTempProject, cleanTempProject } from "../helpers.js";

describe("markdown", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = makeTempProject();
  });

  afterEach(() => {
    cleanTempProject(tmp);
  });

  describe("readMarkdown", () => {
    test("returns empty string for non-existent file", () => {
      expect(readMarkdown(join(tmp, "nope.md"))).toBe("");
    });

    test("reads existing file content", () => {
      const p = join(tmp, "test.md");
      const { writeFileSync } = require("node:fs");
      writeFileSync(p, "# Hello\n\nWorld", "utf-8");
      expect(readMarkdown(p)).toBe("# Hello\n\nWorld");
    });

    test("reads empty file as empty string", () => {
      const p = join(tmp, "empty.md");
      const { writeFileSync } = require("node:fs");
      writeFileSync(p, "", "utf-8");
      expect(readMarkdown(p)).toBe("");
    });
  });

  describe("writeMarkdown", () => {
    test("creates file with content", () => {
      const p = join(tmp, "out.md");
      writeMarkdown(p, "# Test\n");
      expect(readFileSync(p, "utf-8")).toBe("# Test\n");
    });

    test("overwrites existing file", () => {
      const p = join(tmp, "out.md");
      writeMarkdown(p, "v1");
      writeMarkdown(p, "v2");
      expect(readFileSync(p, "utf-8")).toBe("v2");
    });

    test("creates parent directories", () => {
      const p = join(tmp, "a", "b", "c", "deep.md");
      writeMarkdown(p, "deep content");
      expect(readFileSync(p, "utf-8")).toBe("deep content");
    });
  });

  describe("appendMarkdown", () => {
    test("creates new file if not exists", () => {
      const p = join(tmp, "new.md");
      appendMarkdown(p, "first line\n");
      expect(readFileSync(p, "utf-8")).toBe("first line\n");
    });

    test("appends to existing file", () => {
      const p = join(tmp, "log.md");
      writeMarkdown(p, "# Log\n\n");
      appendMarkdown(p, "- entry 1\n");
      expect(readFileSync(p, "utf-8")).toBe("# Log\n\n- entry 1\n");
    });

    test("adds newline separator if file doesn't end with newline", () => {
      const p = join(tmp, "log.md");
      writeMarkdown(p, "no trailing newline");
      appendMarkdown(p, "next");
      expect(readFileSync(p, "utf-8")).toBe("no trailing newline\nnext");
    });

    test("no extra newline if file already ends with newline", () => {
      const p = join(tmp, "log.md");
      writeMarkdown(p, "has newline\n");
      appendMarkdown(p, "next\n");
      expect(readFileSync(p, "utf-8")).toBe("has newline\nnext\n");
    });

    test("multiple appends accumulate", () => {
      const p = join(tmp, "log.md");
      appendMarkdown(p, "a\n");
      appendMarkdown(p, "b\n");
      appendMarkdown(p, "c\n");
      expect(readFileSync(p, "utf-8")).toBe("a\nb\nc\n");
    });
  });

  describe("extractTitle", () => {
    test("extracts h1 heading", () => {
      expect(extractTitle("# My Title\n\nBody")).toBe("My Title");
    });

    test("extracts first non-empty line if no heading", () => {
      expect(extractTitle("Just text\nMore text")).toBe("Just text");
    });

    test("skips empty lines before heading", () => {
      expect(extractTitle("\n\n# Title\n")).toBe("Title");
    });

    test("returns Untitled for empty content", () => {
      expect(extractTitle("")).toBe("Untitled");
    });

    test("returns Untitled for whitespace-only content", () => {
      expect(extractTitle("  \n  \n  ")).toBe("Untitled");
    });

    test("only matches h1, not h2+", () => {
      expect(extractTitle("## Subtitle\n# Title")).toBe("## Subtitle");
    });

    test("trims whitespace from title", () => {
      expect(extractTitle("#   Spaced Title   \n")).toBe("Spaced Title");
    });
  });

  describe("extractBody", () => {
    test("strips heading markers", () => {
      expect(extractBody("# Title\n## Sub\nBody")).toBe("Title\nSub\nBody");
    });

    test("strips h1 through h6", () => {
      const input = "# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6\nPlain";
      expect(extractBody(input)).toBe("H1\nH2\nH3\nH4\nH5\nH6\nPlain");
    });

    test("preserves non-heading lines", () => {
      expect(extractBody("- item 1\n- item 2")).toBe("- item 1\n- item 2");
    });

    test("trims result", () => {
      expect(extractBody("\n\n# Title\n\n")).toBe("Title");
    });

    test("handles empty content", () => {
      expect(extractBody("")).toBe("");
    });

    test("does not strip # inside text", () => {
      expect(extractBody("Issue #42 is fixed")).toBe("Issue #42 is fixed");
    });
  });
});
