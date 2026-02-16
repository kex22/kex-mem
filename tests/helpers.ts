import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Create an isolated temp directory for a test, optionally with markers
 * so findProjectRoot() can locate it.
 */
export function makeTempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "longmem-test-"));
  mkdirSync(join(dir, "memory"), { recursive: true });
  return dir;
}

export function cleanTempProject(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

/**
 * Capture console.log / console.error output during a function call.
 */
export function captureOutput(fn: () => void): { stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...args: unknown[]) => stdout.push(args.map(String).join(" "));
  console.error = (...args: unknown[]) => stderr.push(args.map(String).join(" "));
  try {
    fn();
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
  return { stdout, stderr };
}
