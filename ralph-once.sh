#!/bin/bash
claude --permission-mode acceptEdits "@PRD.md @progress.txt \
1. Read the PRD and progress file. \
2. Find the next incomplete task. \
3. Checkout feature branch for that task. \
4. Implement the task. \
5. Run /nimble-e2e-tester \
6. Fix any issues that arise. \
6. Run /nimble-local-git-ops. \
7. Update progress.txt with what you did. \
ONLY DO ONE TASK AT A TIME."
