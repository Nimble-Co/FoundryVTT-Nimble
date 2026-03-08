#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

for ((i=1; i<=$1; i++)); do
  echo "=== Ralph iteration $i / $1 ==="

  result=$(docker run --rm \
    -e ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" \
    -v "$(pwd):/workspace" \
    -v "$HOME/.claude:/root/.claude" \
    nimble-sandbox \
    claude --permission-mode acceptEdits -p "@PRD.md @progress.txt \
  1. Find the highest-priority incomplete task and implement it. \
  2. Run pnpm check. \
  3. Update PRD.md marking the task done. \
  4. Append your progress to progress.txt. \
  5. Run tests to make sure nothing is broken. \
  6. Commit your changes. \
  ONLY WORK ON A SINGLE TASK. \
  If all tasks are complete, output <promise>COMPLETE</promise>." 2>&1)

  echo "$result"

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo "PRD complete after $i iterations."
    exit 0
  fi
done
