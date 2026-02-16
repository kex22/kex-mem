import { describe, test, expect } from "bun:test";
import {
  CLAUDE_MD_MARKER_START,
  CLAUDE_MD_MARKER_END,
  CLAUDE_MD_INJECTION,
  MEMORY_MD_TEMPLATE,
} from "../../src/lib/config.js";

describe("config", () => {
  describe("markers", () => {
    test("start marker is an HTML comment", () => {
      expect(CLAUDE_MD_MARKER_START).toBe("<!-- longmem:start -->");
    });

    test("end marker is an HTML comment", () => {
      expect(CLAUDE_MD_MARKER_END).toBe("<!-- longmem:end -->");
    });
  });

  describe("CLAUDE_MD_INJECTION", () => {
    test("starts with start marker", () => {
      expect(CLAUDE_MD_INJECTION.startsWith(CLAUDE_MD_MARKER_START)).toBe(true);
    });

    test("ends with end marker", () => {
      expect(CLAUDE_MD_INJECTION.endsWith(CLAUDE_MD_MARKER_END)).toBe(true);
    });

    test("contains command references", () => {
      expect(CLAUDE_MD_INJECTION).toContain("kex-mem recall");
      expect(CLAUDE_MD_INJECTION).toContain("kex-mem log");
      expect(CLAUDE_MD_INJECTION).toContain("kex-mem search");
    });

    test("contains tag list", () => {
      expect(CLAUDE_MD_INJECTION).toContain("decision");
      expect(CLAUDE_MD_INJECTION).toContain("bug");
      expect(CLAUDE_MD_INJECTION).toContain("convention");
      expect(CLAUDE_MD_INJECTION).toContain("todo");
    });

    test("contains workflow instructions", () => {
      expect(CLAUDE_MD_INJECTION).toContain("session start");
      expect(CLAUDE_MD_INJECTION).toContain("session end");
    });
  });

  describe("MEMORY_MD_TEMPLATE", () => {
    test("has Durable Memory heading", () => {
      expect(MEMORY_MD_TEMPLATE).toContain("# Durable Memory");
    });

    test("has section headings", () => {
      expect(MEMORY_MD_TEMPLATE).toContain("## Decisions");
      expect(MEMORY_MD_TEMPLATE).toContain("## Conventions");
      expect(MEMORY_MD_TEMPLATE).toContain("## Architecture");
    });
  });
});
