# Compendium Translation (Babele)

Nimble integrates with the [Babele](https://gitlab.com/riccisi/foundryvtt-babele) module to provide runtime translations of compendium content (item names, descriptions, monster features, etc.). The system ships translation **skeletons** so users can install Babele and immediately see partial translations, while community translators progressively fill the remaining entries.

Babele is an optional dependency. With Babele uninstalled, compendiums display English as today.

## How it wires together

- **`public/lang/babele/mappings.json`** — system-wide field mapping. Nimble stores descriptions as `system.description` (a plain string), not `system.description.value` like dnd5e, so Babele needs this override.
- **`public/lang/babele/<lang>/<system-id>.<pack-name>.json`** — one file per compendium per language (e.g. `es/nimble.nimble-ancestries.json`). Keyed by document `name`. Each entry carries the user-visible fields the generator extracts from the English source:
  - `name` and `description` for every document.
  - Actor-only: `creatureType` (`system.details.creatureType`), `tokenName` (`prototypeToken.name`, only when it differs from `name`), and embedded `items` keyed by item name.
  - Item-only: `costDetails`, `durationDetails`, `targetsRestrictions` (flattened from `system.activation.*.details` / `targets.restrictions`), and `rules` keyed by `rule.id` (falling back to `index:N`) capturing each rule's `label`. The `nimbleRules` converter overlays these back onto `system.rules[]` at runtime.
  - RollTable-only: `results` keyed by `_id`, capturing `name` and `description`. The `nimbleTableResults` converter overlays these back onto `results[]` at runtime.
- **`src/hooks/babeleInit.ts`** — registers `lang/babele` as the system translations directory via the `babele.init` hook. Lowest precedence; community translation modules can override.

The skeleton files are committed source. They are not generated at build time; they are regenerated on demand.

## Regenerating skeletons

After modifying English compendium sources (`packs/**/*.json`), regenerate the skeletons to add new entries and detect stale ones:

```sh
pnpm lang:build-compendium-skeletons          # all configured languages
pnpm lang:build-compendium-skeletons es fr    # specific languages
```

The script:

- Adds new entries with English source as the placeholder value.
- Preserves any existing translated value (does not overwrite manual translations).
- Reports — but **keeps** — entries that no longer match an English source name. Stale entries are flagged in the build log so a translator can review (a rename may need its translation copied to the new key).

## Adding a new language

1. Create the directory `public/lang/babele/<lang>/`.
2. Run `pnpm lang:build-compendium-skeletons <lang>` to populate it.
3. (Optional) Add the language to `public/system.json` `languages` array if it isn't already declared for UI strings.

## Translating

Editors translate each `name` / `description` value in place. Field paths can be extended per file by adding a `mapping` block; see Babele's docs for the converter vocabulary. For pack-level folder name translations, add a `folders` block to the relevant file (folder names in Nimble are deterministic — derived in `build/lib/Pack.mjs`).

## Caveats

- **Embedded items on actors are keyed by `name`** (Babele convention for `cardinality: many`). If an actor has two embedded items that share a `name` (e.g., a monster with two "Bite" features), they collapse to one translation entry and the same translated text will apply to both at runtime. The skeleton builder logs `embedded-name collisions` per actor so they're easy to spot; the fix is to rename one of them in the source pack before regenerating.
