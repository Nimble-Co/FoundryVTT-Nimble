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
  1. Read the PRD and progress file. \
  2. Find the next incomplete task. \
  3. Checkout feature branch for that task. \
  4. Implement the task. \
  5. Run /nimble-e2e-tester \
  6. Fix any issues that arise. \
  6. Run /nimble-local-git-ops. \
  7. Update progress.txt with what you did. \
  ONLY WORK ON A SINGLE TASK. \
  If all tasks are complete, output <promise>COMPLETE</promise>." 2>&1)

  echo "$result"

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo "PRD complete after $i iterations."
    exit 0
  fi
done
