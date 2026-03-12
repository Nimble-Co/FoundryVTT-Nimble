#!/bin/bash
# Loop Ralph N times on the host (uses Claude.ai subscription via keychain)
set -e
cd "$(dirname "$0")/.."

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

unset CLAUDECODE

for ((i=1; i<=$1; i++)); do
  echo "=== Ralph iteration $i / $1 ==="

  result=$(timeout 25m claude --permission-mode acceptEdits -p "@PRD.md @progress.txt \
1. Read the PRD and progress file. \
2. Find the next incomplete task. \
3. Cut a new branch from stage for that task. \
4. Implement the task. \
5. Run /nimble-review on all changed files. \
6. Run /nimble-e2e-tester. Fix any issues. \
   If the e2e tester cannot complete due to environment limits (e.g. WebGL unavailable in headless browser), \
   note the specific blocker in progress.txt and do NOT retry — move on. \
7. DO NOT COMMIT. Leave changes staged/unstaged for user review. \
8. Update progress.txt with what you did and which files changed. \
ONLY WORK ON A SINGLE TASK. \
If all tasks are complete, output <promise>COMPLETE</promise>." 2>&1)

  echo "$result"

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo "PRD complete after $i iterations."
    exit 0
  fi
done
