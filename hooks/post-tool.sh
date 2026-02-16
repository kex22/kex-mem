#!/usr/bin/env bash
# PostToolUse hook: auto-index memory files after Write/Edit
# Called by Claude Code plugin when files in memory/ are modified

TOOL_NAME="$1"
FILE_PATH="$2"

# Only act on memory directory files
case "$FILE_PATH" in
  */memory/*.md)
    longmem index 2>/dev/null
    ;;
esac
