import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { findProjectRoot, memoryDir, dbPath, durableMemoryPath, userMemoryPath, claudeMdPath } from "../lib/paths.js";
import { openDb } from "../lib/db.js";
import { CLAUDE_MD_INJECTION, CLAUDE_MD_MARKER_START, CLAUDE_MD_MARKER_END, MEMORY_MD_TEMPLATE, USER_MD_TEMPLATE, PLUGIN_JSON_TEMPLATE, POST_TOOL_HOOK_TEMPLATE } from "../lib/config.js";
import { loadConfig, saveConfig } from "../lib/config-store.js";

export function initCommand(opts: { hooks?: boolean }): void {
  const root = findProjectRoot();
  const memDir = memoryDir(root);

  // Create memory directory
  if (!existsSync(memDir)) {
    mkdirSync(memDir, { recursive: true });
    console.log(`Created ${memDir}`);
  }

  // Create MEMORY.md
  const durablePath = durableMemoryPath(root);
  if (!existsSync(durablePath)) {
    writeFileSync(durablePath, MEMORY_MD_TEMPLATE, "utf-8");
    console.log(`Created ${durablePath}`);
  }

  // Create USER.md
  const userPath = userMemoryPath(root);
  if (!existsSync(userPath)) {
    writeFileSync(userPath, USER_MD_TEMPLATE, "utf-8");
    console.log(`Created ${userPath}`);
  }

  // Initialize SQLite DB + detect sqlite-vec
  const config = loadConfig(root);
  const handle = openDb(dbPath(root), { vecDimension: config.vector.dimension });
  if (handle.vecEnabled) {
    console.log("sqlite-vec detected. Enable vector search: kex-mem config set embedding local");
  }
  if (!handle.vecEnabled && config.vector.enabled) {
    config.vector.enabled = false;
    saveConfig(root, config);
    console.log("sqlite-vec not available, vector search disabled.");
  }
  handle.db.close();
  console.log(`Initialized ${dbPath(root)}`);

  // Inject into CLAUDE.md
  const claudePath = claudeMdPath(root);
  let claudeContent = "";
  if (existsSync(claudePath)) {
    claudeContent = readFileSync(claudePath, "utf-8");
  }

  if (claudeContent.includes(CLAUDE_MD_MARKER_START)) {
    const startIdx = claudeContent.indexOf(CLAUDE_MD_MARKER_START);
    const endIdx = claudeContent.indexOf(CLAUDE_MD_MARKER_END);
    if (endIdx !== -1) {
      claudeContent = claudeContent.slice(0, startIdx) + CLAUDE_MD_INJECTION + claudeContent.slice(endIdx + CLAUDE_MD_MARKER_END.length);
    } else {
      claudeContent = claudeContent.slice(0, startIdx);
    }
  }

  if (!claudeContent.includes(CLAUDE_MD_MARKER_START)) {
    let separator: string;
    if (!claudeContent || claudeContent.endsWith("\n\n")) {
      separator = "";
    } else if (claudeContent.endsWith("\n")) {
      separator = "\n";
    } else {
      separator = "\n\n";
    }
    claudeContent = claudeContent + separator + CLAUDE_MD_INJECTION + "\n";
  }
  writeFileSync(claudePath, claudeContent, "utf-8");
  console.log(`Updated ${claudePath}`);

  // Install hooks if requested
  if (opts.hooks) {
    const pluginDir = `${root}/.claude-plugin`;
    if (!existsSync(pluginDir)) {
      mkdirSync(pluginDir, { recursive: true });
    }
    writeFileSync(`${pluginDir}/plugin.json`, PLUGIN_JSON_TEMPLATE, "utf-8");
    console.log(`Created ${pluginDir}/plugin.json`);

    const hooksDir = `${root}/hooks`;
    if (!existsSync(hooksDir)) {
      mkdirSync(hooksDir, { recursive: true });
    }
    const hookPath = `${hooksDir}/post-tool.sh`;
    writeFileSync(hookPath, POST_TOOL_HOOK_TEMPLATE, "utf-8");
    chmodSync(hookPath, 0o755);
    console.log(`Created ${hookPath}`);
  }

  console.log("kex-mem initialized.");
}
