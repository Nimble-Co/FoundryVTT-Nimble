#!/usr/bin/env bash
# deploy-log.sh
# Runs a deploy command and appends a structured entry to logs/deploy.log.
#
# Usage (called by package.json scripts — do not invoke directly):
#   bash scripts/deploy-log.sh <command-label> <shell-command...>
#
# Log format (tab-separated):
#   TIMESTAMP  COMMAND  STATUS  DURATION_s

set -euo pipefail

LABEL="${1:?deploy-log.sh requires a command label as first argument}"
shift  # remaining args are the command to run

LOG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/logs"
LOG_FILE="$LOG_DIR/deploy.log"

mkdir -p "$LOG_DIR"

TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
START="$(date +%s)"

echo "[$TIMESTAMP] Starting deploy: $LABEL"

set +e
"$@"
EXIT_CODE=$?
set -e

END="$(date +%s)"
DURATION=$(( END - START ))

if [[ $EXIT_CODE -eq 0 ]]; then
  STATUS="SUCCESS"
else
  STATUS="FAILURE (exit $EXIT_CODE)"
fi

printf "%s\t%s\t%s\t%ds\n" "$TIMESTAMP" "$LABEL" "$STATUS" "$DURATION" >> "$LOG_FILE"

echo "[$TIMESTAMP] Deploy $STATUS in ${DURATION}s — logged to $LOG_FILE"

exit $EXIT_CODE
