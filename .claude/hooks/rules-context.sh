#!/bin/bash
# Injects rules system context when reading/editing files in src/models/rules/
set -e

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only inject for rules/ files
if [[ ! "$FILE_PATH" == *"src/models/rules/"* ]] && [[ ! "$FILE_PATH" == *"src\\models\\rules\\"* ]]; then
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTEXT=$(cat "$SCRIPT_DIR/rules-context.md")

jq -n \
  --arg context "$CONTEXT" \
  '{
    "hookSpecificOutput": {
      "hookEventName": "PreToolUse",
      "permissionDecision": "allow",
      "additionalContext": $context
    }
  }'

exit 0
