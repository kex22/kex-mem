import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { makeTempProject, cleanTempProject } from "../helpers.js";
import { loadConfig, saveConfig, configPath, dimensionForProvider } from "../../src/lib/config-store.js";
import type { KexMemConfig } from "../../src/lib/config-store.js";

describe("config-store", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = makeTempProject();
  });

  afterEach(() => {
    cleanTempProject(tmp);
  });

  describe("loadConfig", () => {
    test("returns defaults when no config file exists", () => {
      const config = loadConfig(tmp);
      expect(config.vector.enabled).toBe(false);
      expect(config.vector.provider).toBe("local");
      expect(config.vector.dimension).toBe(384);
    });

    test("reads existing config file", () => {
      const { writeFileSync, mkdirSync } = require("node:fs");
      const { dirname } = require("node:path");
      const p = configPath(tmp);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, JSON.stringify({
        vector: { enabled: true, provider: "openai", dimension: 1536, openaiKey: "sk-test" },
      }), "utf-8");

      const config = loadConfig(tmp);
      expect(config.vector.enabled).toBe(true);
      expect(config.vector.provider).toBe("openai");
      expect(config.vector.dimension).toBe(1536);
      expect(config.vector.openaiKey).toBe("sk-test");
    });

    test("returns defaults for malformed JSON", () => {
      const { writeFileSync, mkdirSync } = require("node:fs");
      const { dirname } = require("node:path");
      const p = configPath(tmp);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, "not json{{{", "utf-8");

      const config = loadConfig(tmp);
      expect(config.vector.enabled).toBe(false);
      expect(config.vector.provider).toBe("local");
    });

    test("fills missing fields with defaults", () => {
      const { writeFileSync, mkdirSync } = require("node:fs");
      const { dirname } = require("node:path");
      const p = configPath(tmp);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, JSON.stringify({ vector: { enabled: true } }), "utf-8");

      const config = loadConfig(tmp);
      expect(config.vector.enabled).toBe(true);
      expect(config.vector.provider).toBe("local");
      expect(config.vector.dimension).toBe(384);
    });
  });

  describe("saveConfig", () => {
    test("writes config file", () => {
      const config: KexMemConfig = {
        vector: { enabled: true, provider: "local", dimension: 384 },
      };
      saveConfig(tmp, config);
      expect(existsSync(configPath(tmp))).toBe(true);
      const raw = JSON.parse(readFileSync(configPath(tmp), "utf-8"));
      expect(raw.vector.enabled).toBe(true);
    });

    test("creates parent directories", () => {
      const { rmSync } = require("node:fs");
      rmSync(join(tmp, "memory"), { recursive: true, force: true });
      const config: KexMemConfig = {
        vector: { enabled: false, provider: "local", dimension: 384 },
      };
      saveConfig(tmp, config);
      expect(existsSync(configPath(tmp))).toBe(true);
    });

    test("roundtrips correctly", () => {
      const config: KexMemConfig = {
        vector: { enabled: true, provider: "openai", dimension: 1536, openaiKey: "sk-abc" },
      };
      saveConfig(tmp, config);
      const loaded = loadConfig(tmp);
      expect(loaded.vector.enabled).toBe(true);
      expect(loaded.vector.provider).toBe("openai");
      expect(loaded.vector.dimension).toBe(1536);
      expect(loaded.vector.openaiKey).toBe("sk-abc");
    });
  });

  describe("dimensionForProvider", () => {
    test("returns 384 for local", () => {
      expect(dimensionForProvider("local")).toBe(384);
    });

    test("returns 1536 for openai", () => {
      expect(dimensionForProvider("openai")).toBe(1536);
    });
  });

  describe("configPath", () => {
    test("returns path inside memory dir", () => {
      const p = configPath(tmp);
      expect(p).toContain("memory");
      expect(p).toEndWith(".kex-mem.json");
    });
  });
});
