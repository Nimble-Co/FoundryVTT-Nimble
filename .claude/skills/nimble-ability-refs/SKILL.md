# Nimble Ability References

## When to Use

Load this skill when you need to look up or reference:
- **Spell names** by school or tier (for macros, auto-animations, or content work)
- **Monster attacks** embedded in NPC packs (for auto-animations or balancing)
- **Hero class abilities** and their groups (for macros, feature implementation, or animations)

---

## Pack Directory Structure

```
packs/
├── spells/core/{school}/           # Spell items (type: "spell")
│   Schools: fire, ice, lightning, necrotic, radiant, secret, utility, wind
│
├── monsters/core/{group}/          # NPC actors; attacks are embedded items (type: "monsterFeature")
│   Groups: bandits, briarbanes, cultists, forest-denizens, gnolls, goblins,
│            hill-and-field, horrors, kobolds, mimics, oozes, snakemen,
│            stirges, undead, underground
│
└── classFeatures/core/{class}/{group}/  # Hero abilities (type: "feature")
    Classes (packs): berserker, commander, hunter, mage, oathsworn,
                     shadowmancer, shepherd, songweaver, stormshifter,
                     the-cheat, zephyr
    Classes (docs only): beastmaster, oathbreaker, reaver, spellblade
```

---

## Spell JSON Schema (key fields)

```json
{
  "name": "Flame Dart",
  "type": "spell",
  "system": {
    "school": "fire",          // spell school — matches pack subdirectory
    "tier": 0,                  // 0 = base, higher = upcast tier
    "activation": {
      "cost": { "type": "action", "quantity": 1 },
      "effects": [{ "type": "damage", "damageType": "fire", "formula": "1d10 + ..." }],
      "targets": { "count": 1 }
    },
    "description": { "baseEffect": "...", "higherLevelEffect": "..." },
    "properties": { "range": { "min": 2, "max": 8 } }
  }
}
```

---

## Monster Attack Schema (key fields)

Monster attacks are **embedded items** inside NPC actor JSON files, not standalone files.

```json
// Inside packs/monsters/core/{group}/{monster}.json
{
  "name": "Bandit Bruiser",
  "type": "npc",
  "items": [
    {
      "name": "Bash.",
      "type": "monsterFeature",
      "system": {
        "subtype": "action",    // "action" = attack, absent = passive feature
        "activation": {
          "cost": { "type": "action" },
          "effects": [{ "type": "damage", "damageType": "bludgeoning", "formula": "2d8+4" }]
        },
        "description": "<p>2d8+4</p>"
      }
    }
  ]
}
```

To list all monster attack names: run `scripts/list-monster-attacks.sh`

---

## Hero Ability Schema (key fields)

```json
{
  "name": "Rampage",
  "type": "feature",
  "system": {
    "group": "savage-arsenal",      // matches pack subdirectory name
    "featureType": "class",
    "gainedAtLevel": 4,
    "gainedAtLevels": [4, 6, 8, 12, 14, 16],
    "subclass": false,
    "description": "<p>(1/turn) After you land a hit...</p>"
  }
}
```

---

## Hero Class Reference Docs

Full ability lists (with descriptions) live in `docs/hero-classes/`:

| File | Classes Covered |
|------|----------------|
| `berserker.md` | Core abilities, Savage Arsenal choices, subclasses |
| `commander.md` | Core abilities, subclasses |
| `hunter.md` | Core abilities, subclasses |
| `mage.md` | Core abilities, subclasses |
| `oathsworn.md` | Core abilities, subclasses |
| `shadowmancer.md` | Core abilities, subclasses |
| `shepherd.md` | Core abilities, subclasses |
| `songweaver.md` | Core abilities, subclasses |
| `stormshifter.md` | Core abilities, subclasses |
| `the-cheat.md` | Core abilities, subclasses |
| `zephyr.md` | Core abilities, subclasses |
| `beastmaster.md` | Docs-only (no packs yet) |
| `oathbreaker.md` | Docs-only (no packs yet) |
| `reaver.md` | Docs-only (no packs yet) |
| `spellblade.md` | Docs-only (no packs yet) |

**When writing macros or animations:** Read the relevant `docs/hero-classes/{class}.md` to get exact ability names and descriptions before searching the JSON packs.

---

## Quick Search

Use `scripts/search-packs.sh "{query}"` to search all pack JSONs by name. Examples:

```bash
# Find a spell by name
bash .claude/skills/nimble-ability-refs/scripts/search-packs.sh "Flame Dart"

# List all spells in a school
bash .claude/skills/nimble-ability-refs/scripts/search-packs.sh --school fire

# List all abilities for a class
bash .claude/skills/nimble-ability-refs/scripts/search-packs.sh --class berserker

# List all monster attacks in a group
bash .claude/skills/nimble-ability-refs/scripts/search-packs.sh --monsters bandits
```
