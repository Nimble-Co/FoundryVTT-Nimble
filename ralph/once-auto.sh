#!/bin/bash
# Run one Ralph iteration on the host with auto-commit (uses Claude.ai subscription via keychain)
cd "$(dirname "$0")/.."

unset CLAUDECODE
timeout 25m claude --dangerously-skip-permissions -p "@PRD.md @progress.txt \
1. Read the PRD and progress file. \
2. Find the next incomplete task. \
3. Cut a new branch from stage for that task. \
4. Implement the task. \
5. Run /nimble-review on all changed files. \
6. Run /nimble-e2e-tester. Fix any issues. \
   If the e2e tester cannot complete due to environment limits (e.g. WebGL unavailable in headless browser), \
   note the specific blocker in progress.txt and do NOT retry — move on. \
7. Run /nimble-commit-push to commit and push all changes. \
8. Update progress.txt with what you did and which files changed. \
ONLY DO ONE TASK AT A TIME."
