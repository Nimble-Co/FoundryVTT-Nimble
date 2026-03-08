#!/bin/bash
claude --permission-mode acceptEdits "@PRD.md @progress.txt \
1. Read the PRD and progress file. \
2. Find the next incomplete task, if on stage cut a feature/ branch to implement it. \
3. Run tests to make sure nothing is broken. \
4. Commit your changes. \
5. Update progress.txt with what you did. \
ONLY DO ONE TASK AT A TIME."
