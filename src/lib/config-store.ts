import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { join } from "node:path";
import { memoryDir } from "./paths.js";

export interface VectorConfig {
  enabled: boolean;
  provider: "local" | "openai";
  dimension: number;
  openaiKey?: string;
}

export interface KexMemConfig {
  vector: VectorConfig;
}

const DEFAULT_CONFIG: KexMemConfig = {
  vector: { enabled: false, provider: "local", dimension: 384 },
};

export function configPath(projectRoot: string): string {
  return join(memoryDir(projectRoot), ".kex-mem.json");
}

export function loadConfig(projectRoot: string): KexMemConfig {
  const p = configPath(projectRoot);
  if (!existsSync(p)) return structuredClone(DEFAULT_CONFIG);
  try {
    const raw = JSON.parse(readFileSync(p, "utf-8"));
    return {
      vector: {
        enabled: raw?.vector?.enabled ?? DEFAULT_CONFIG.vector.enabled,
        provider: raw?.vector?.provider ?? DEFAULT_CONFIG.vector.provider,
        dimension: raw?.vector?.dimension ?? DEFAULT_CONFIG.vector.dimension,
        ...(raw?.vector?.openaiKey ? { openaiKey: raw.vector.openaiKey } : {}),
      },
    };
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

export function saveConfig(projectRoot: string, config: KexMemConfig): void {
  const p = configPath(projectRoot);
  const dir = dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(p, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function dimensionForProvider(provider: "local" | "openai"): number {
  return provider === "openai" ? 1536 : 384;
}
