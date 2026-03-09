#!/usr/bin/env bash
# check-branch.sh — Verify the current branch is NOT a protected branch before proceeding.
# Usage: source this script or run it as a pre-operation guard.

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
PROTECTED=("dev" "main-local" "stage")

for branch in "${PROTECTED[@]}"; do
  if [[ "$CURRENT_BRANCH" == "$branch" ]]; then
    echo "ERROR: You are on the protected branch '$branch'."
    echo "Feature work must be done on a feature/ branch created from 'stage'."
    echo "Run: git checkout stage && git pull origin stage && git checkout -b feature/<name>"
    exit 1
  fi
done

echo "OK: Current branch is '$CURRENT_BRANCH' — safe to proceed."
