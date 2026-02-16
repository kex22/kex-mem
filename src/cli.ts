import { Command } from "commander";

const program = new Command();

program
  .name("kex-mem")
  .description("Local long-term memory for AI coding assistants")
  .version("0.3.0");

program
  .command("init")
  .description("Initialize kex-mem in current project")
  .option("--hooks", "Install Claude Code hooks")
  .action(async (opts) => {
    const { initCommand } = await import("./commands/init.js");
    initCommand(opts);
  });

program
  .command("log")
  .description("Record a memory entry")
  .argument("<message>", "Content to log")
  .option("-t, --tag <tag>", "Tag: decision, bug, convention, todo")
  .action(async (message, opts) => {
    const { logCommand } = await import("./commands/log.js");
    await logCommand(message, opts);
  });

program
  .command("search")
  .description("Full-text search across all memories")
  .argument("<query>", "Search query")
  .option("-l, --limit <n>", "Max results", "10")
  .action(async (query, opts) => {
    const { searchCommand } = await import("./commands/search.js");
    await searchCommand(query, opts);
  });

program
  .command("recall")
  .description("View recent memory logs")
  .argument("[date]", "Specific date (YYYY-MM-DD)")
  .option("-d, --durable", "Show durable memory (MEMORY.md)")
  .option("-u, --user", "Show user preferences (USER.md)")
  .option("-w, --week", "Show past 7 days")
  .action(async (date, opts) => {
    const { recallCommand } = await import("./commands/recall.js");
    recallCommand(date, opts);
  });

program
  .command("compact")
  .description("Archive old daily logs")
  .option("-a, --auto", "Auto-archive by month")
  .option("-s, --smart", "Output structured prompt for LLM-driven compaction")
  .option("--days <n>", "Archive logs older than N days", "30")
  .action(async (opts) => {
    const { compactCommand } = await import("./commands/compact.js");
    compactCommand(opts);
  });

program
  .command("index")
  .description("Index markdown files (incremental by default)")
  .argument("[filepath]", "Single file to index (relative to memory/)")
  .option("-f, --full", "Full rebuild (clear and re-index all)")
  .action(async (filepath, opts) => {
    const { indexCommand } = await import("./commands/index.js");
    await indexCommand(filepath, opts);
  });

program
  .command("config")
  .description("View or update kex-mem configuration")
  .argument("[args...]", "set <key> <value>")
  .action(async (args) => {
    const { configCommand } = await import("./commands/config.js");
    configCommand(args);
  });

program.parse();
