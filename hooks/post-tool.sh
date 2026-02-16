#!/usr/bin/env bash
# PostToolUse hook: auto-index memory files after Write/Edit
# Called by Claude Code plugin when files in memory/ are modified

TOOL_NAME="$1"
FILE_PATH="$2"

case "$FILE_PATH" in
  */memory/*.md)
    REL_PATH="${FILE_PATH##*/memory/}"
    kex-mem index "$REL_PATH" 2>/dev/null
    ;;
esac
