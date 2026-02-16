import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { readFileSync } from "node:fs";
import { makeTempProject, cleanTempProject, captureOutput } from "../helpers.js";
import { initCommand } from "../../src/commands/init.js";
import { configCommand } from "../../src/commands/config.js";
import { configPath, loadConfig } from "../../src/lib/config-store.js";

describe("configCommand", () => {
  let tmp: string;
  let origCwd: string;

  beforeEach(() => {
    tmp = makeTempProject();
    origCwd = process.cwd();
    process.chdir(tmp);
    captureOutput(() => initCommand({}));
  });

  afterEach(() => {
    process.chdir(origCwd);
    cleanTempProject(tmp);
  });

  test("shows current config with no args", () => {
    const { stdout } = captureOutput(() => configCommand([]));
    const output = stdout.join("\n");
    expect(output).toContain("vector");
    expect(output).toContain("provider");
  });

  test("sets embedding provider to openai", () => {
    const origExit = process.exit;
    process.exit = (() => {}) as any;
    try {
      captureOutput(() => configCommand(["set", "embedding", "openai"]));
      const config = loadConfig(tmp);
      expect(config.vector.provider).toBe("openai");
      expect(config.vector.dimension).toBe(1536);
      expect(config.vector.enabled).toBe(true);
    } finally {
      process.exit = origExit;
    }
  });

  test("sets embedding provider to local", () => {
    captureOutput(() => configCommand(["set", "embedding", "local"]));
    const config = loadConfig(tmp);
    expect(config.vector.provider).toBe("local");
    expect(config.vector.dimension).toBe(384);
  });

  test("sets openai key", () => {
    captureOutput(() => configCommand(["set", "openai-key", "sk-test123"]));
    const config = loadConfig(tmp);
    expect(config.vector.openaiKey).toBe("sk-test123");
  });

  test("prints dimension change warning", () => {
    // First set to local (384)
    captureOutput(() => configCommand(["set", "embedding", "local"]));
    // Then switch to openai (1536) — dimension changes
    const { stdout } = captureOutput(() => configCommand(["set", "embedding", "openai"]));
    const output = stdout.join("\n");
    expect(output).toContain("Dimension changed");
  });

  test("rejects invalid provider", () => {
    const origExit = process.exit;
    let exitCode: number | undefined;
    process.exit = ((code?: number) => { exitCode = code; }) as any;
    try {
      captureOutput(() => configCommand(["set", "embedding", "invalid"]));
      expect(exitCode).toBe(1);
    } finally {
      process.exit = origExit;
    }
  });

  test("rejects unknown config key", () => {
    const origExit = process.exit;
    let exitCode: number | undefined;
    process.exit = ((code?: number) => { exitCode = code; }) as any;
    try {
      captureOutput(() => configCommand(["set", "unknown", "value"]));
      expect(exitCode).toBe(1);
    } finally {
      process.exit = origExit;
    }
  });

  test("rejects set without enough args", () => {
    const origExit = process.exit;
    let exitCode: number | undefined;
    process.exit = ((code?: number) => { exitCode = code; }) as any;
    try {
      captureOutput(() => configCommand(["set"]));
      expect(exitCode).toBe(1);
    } finally {
      process.exit = origExit;
    }
  });
});
