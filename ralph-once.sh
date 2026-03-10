#!/bin/bash
claude --permission-mode acceptEdits "@PRD.md @progress.txt \
1. Read the PRD and progress file. \
2. Find the next incomplete task. \
3. Cut a new branch from stage for that task. \
4. Implement the task. \
5. Run /nimble-review on all changed files. \
6. Run /nimble-e2e-tester. Fix any issues. \
7. DO NOT COMMIT. Leave changes staged/unstaged for user review. \
8. Update progress.txt with what you did and which files changed. \
ONLY DO ONE TASK AT A TIME."
