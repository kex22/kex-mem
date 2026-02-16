import { describe, test, expect } from "bun:test";
import { createEmbedder, LocalEmbedder, OpenAIEmbedder } from "../../src/lib/embedder.js";

describe("embedder", () => {
  describe("createEmbedder", () => {
    test("returns LocalEmbedder for 'local' provider", () => {
      const embedder = createEmbedder("local");
      expect(embedder).toBeInstanceOf(LocalEmbedder);
      expect(embedder.dimension).toBe(384);
    });

    test("returns OpenAIEmbedder for 'openai' provider with key", () => {
      const embedder = createEmbedder("openai", "sk-test-key");
      expect(embedder).toBeInstanceOf(OpenAIEmbedder);
      expect(embedder.dimension).toBe(1536);
    });

    test("throws when openai provider has no key", () => {
      expect(() => createEmbedder("openai")).toThrow("API key required");
    });

    test("throws when openai provider has empty key", () => {
      expect(() => createEmbedder("openai", "")).toThrow();
    });
  });

  describe("LocalEmbedder", () => {
    test("has dimension 384", () => {
      const embedder = new LocalEmbedder();
      expect(embedder.dimension).toBe(384);
    });
  });

  describe("OpenAIEmbedder", () => {
    test("has dimension 1536", () => {
      const embedder = new OpenAIEmbedder("sk-test");
      expect(embedder.dimension).toBe(1536);
    });

    test("throws on empty API key", () => {
      expect(() => new OpenAIEmbedder("")).toThrow("API key is required");
    });
  });
});
