#!/usr/bin/env bash
# search-packs.sh — Search Nimble pack JSON files by name, school, class, or monster group
# Run from the FoundryVTT-Nimble project root
#
# Usage:
#   bash .claude/skills/nimble-ability-refs/scripts/search-packs.sh "Flame Dart"
#   bash .claude/skills/nimble-ability-refs/scripts/search-packs.sh --school fire
#   bash .claude/skills/nimble-ability-refs/scripts/search-packs.sh --class berserker
#   bash .claude/skills/nimble-ability-refs/scripts/search-packs.sh --monsters bandits

PACKS_DIR="./packs"

case "$1" in
  --school)
    SCHOOL="${2:?Usage: --school <school>}"
    echo "=== Spells: $SCHOOL ==="
    find "$PACKS_DIR/spells/core/$SCHOOL" -name "*.json" 2>/dev/null \
      | xargs -I{} jq -r '.name' {} \
      | sort
    ;;

  --class)
    CLASS="${2:?Usage: --class <class>}"
    echo "=== Class features: $CLASS ==="
    find "$PACKS_DIR/classFeatures/core/$CLASS" -name "*.json" 2>/dev/null \
      | xargs -I{} jq -r '"\(.system.group // "core")/\(.name)"' {} \
      | sort
    ;;

  --monsters)
    GROUP="${2:?Usage: --monsters <group>}"
    echo "=== Monster attacks: $GROUP ==="
    find "$PACKS_DIR/monsters/core/$GROUP" -name "*.json" 2>/dev/null \
      | while read -r f; do
          MONSTER=$(jq -r '.name' "$f")
          jq -r --arg m "$MONSTER" \
            '.items[] | select(.type == "monsterFeature" and .system.subtype == "action") | "\($m) → \(.name)"' \
            "$f"
        done \
      | sort
    ;;

  "")
    echo "Usage:"
    echo "  $0 \"<name query>\"         — search all packs for items matching name"
    echo "  $0 --school <school>       — list spells in a school"
    echo "  $0 --class <class>         — list hero abilities for a class"
    echo "  $0 --monsters <group>      — list monster attacks in a group"
    ;;

  *)
    QUERY="$1"
    echo "=== Searching packs for: $QUERY ==="
    grep -rl "\"name\": \"$QUERY\"" "$PACKS_DIR" 2>/dev/null \
      | while read -r f; do
          TYPE=$(jq -r '.type // .items[]?.type // "unknown"' "$f" 2>/dev/null | head -1)
          echo "  [$TYPE] $f"
        done
    ;;
esac
