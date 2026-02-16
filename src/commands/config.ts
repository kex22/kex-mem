import { findProjectRoot } from "../lib/paths.js";
import { loadConfig, saveConfig, dimensionForProvider } from "../lib/config-store.js";
import type { VectorConfig } from "../lib/config-store.js";

export function configCommand(args: string[]): void {
  const root = findProjectRoot();
  const config = loadConfig(root);

  // No args: show current config
  if (args.length === 0) {
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  if (args[0] !== "set" || args.length < 3) {
    console.error("Usage: kex-mem config set <key> <value>");
    console.error("Keys: embedding (local|openai), openai-key <key>");
    process.exit(1);
  }

  const key = args[1];
  const value = args[2];

  if (key === "embedding") {
    if (value !== "local" && value !== "openai") {
      console.error("Invalid provider. Use: local, openai");
      process.exit(1);
    }
    const oldDim = config.vector.dimension;
    config.vector.provider = value;
    config.vector.dimension = dimensionForProvider(value);
    config.vector.enabled = true;
    saveConfig(root, config);
    console.log(`Embedding provider: ${value} (dimension: ${config.vector.dimension})`);
    if (oldDim !== config.vector.dimension) {
      console.log("Dimension changed. Run `kex-mem index` to rebuild vector index.");
    }
  } else if (key === "openai-key") {
    config.vector.openaiKey = value;
    saveConfig(root, config);
    console.log("OpenAI API key saved.");
    console.log("Tip: ensure memory/.kex-mem.json is in .gitignore to avoid committing your key.");
  } else {
    console.error(`Unknown config key: ${key}`);
    console.error("Keys: embedding (local|openai), openai-key <key>");
    process.exit(1);
  }
}
