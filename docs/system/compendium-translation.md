# Compendium Translation (Babele)

Nimble integrates with the [Babele](https://gitlab.com/riccisi/foundryvtt-babele) module to provide runtime translations of compendium content (item names, descriptions, monster features, etc.). The system ships translation **skeletons** so users can install Babele and immediately see partial translations, while community translators progressively fill the remaining entries.

Babele is an optional dependency. With Babele uninstalled, compendiums display English as today.

## How it wires together

- **`public/lang/babele/mappings.json`** — system-wide field mapping. Nimble stores descriptions as `system.description` (a plain string), not `system.description.value` like dnd5e, so Babele needs this override.
- **`public/lang/babele/<lang>/<system-id>.<pack-name>.json`** — one file per compendium per language (e.g. `es/nimble.nimble-ancestries.json`). Keyed by document `name`, with `name`, `description`, and (for actors) embedded `items`.
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

## Known limitations

- Rule labels inside `system.rules[].label` are not surfaced in the skeletons. They are mostly mechanical tags (e.g. "Stout") rather than user-facing prose; translators can add custom converters per file if needed.
- `prototypeToken.name` is not surfaced; Foundry typically mirrors it from `name` and Babele's default token-name converter picks it up.
