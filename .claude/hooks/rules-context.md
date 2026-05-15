# Rules System Context

You are working with Nimble's **Rules system** — generic, data-driven modifiers attached to items that automatically apply effects to actors during data preparation.

**Authoritative reference**: [`docs/system/rules.md`](../../docs/system/rules.md). Read it before adding or modifying a rule type — it covers the lifecycle hooks, RulesManager API, the Rules Builder integration requirements (widget hints, `withWidget()`, `showWhen`, the field-type-to-widget table), and the envelope-field list. The summary below is just enough to keep context-grounded for in-flight edits.

## Design Philosophy

Rules are **intentionally generic building blocks**, not named after specific features. A rule like `abilityBonus` can be used by any item — a class feature, a magic item, a racial trait — to grant an ability score bonus. This generality enables **homebrewing**. When creating new rule types, name them after *what they do* (`speedBonus`, `grantProficiency`), never after a specific feature.

## Architecture (one-liner each)

- **Base class**: `NimbleBaseRule` (`src/models/rules/base.ts`) extends `foundry.abstract.DataModel`.
- **Registration**: `src/config/registerRulesConfig.ts` maps type strings to classes in `CONFIG.NIMBLE.ruleDataModels` and i18n labels in `CONFIG.NIMBLE.ruleTypes`.
- **Storage**: `item.system.rules` is an `ArrayField` of plain objects with `id`, `type`, `disabled`, `priority`, `predicate`, plus type-specific fields.
- **Instantiation**: `RulesManager` (`src/managers/RulesManager.ts`) lives per-item; created in `prepareBaseData()`.

## Lifecycle Hooks (execution order)

1. `prePrepareData()` — during `actor.prepareDerivedData()`
2. `afterPrepareData()` — after `actor.prepareData()` completes
3. `preCreate(args)` — before item creation on actor
4. `preUpdate(changes)` / `afterUpdate(changes)` — around item updates
5. `afterDelete()` — after item deletion
6. `preUpdateActor(changes)` — before actor update

Rules are sorted by `priority` (lower runs first) before each hook fires.

## Key Patterns (gotchas)

- **Guard with `isEmbedded`**: `if (!this.item.isEmbedded) return;` at the top of `prePrepareData()`.
- **Predicate testing**: `this.test()` — empty predicate always passes.
- **Formula resolution**: `this.resolveFormula(formula)` returns a number against actor roll data.
- **Forward declarations**: Use local interfaces for `NimbleBaseActor`/`NimbleBaseItem` to avoid circular imports.
- **Mutate via `foundry.utils.setProperty()`**: e.g., `foundry.utils.setProperty(actor.system, 'abilities.str.bonus', newValue)`.

## Adding a new rule type — quick checklist

1. New file `src/models/rules/yourRule.ts` extending `NimbleBaseRule`
2. Local `schema()` + override `defineSchema()` merging base + local
3. Implement lifecycle hooks
4. Register in `src/config/registerRulesConfig.ts` (both `ruleTypes` and `ruleDataModels`)
5. Add `NIMBLE.ruleTypes.<key>` and `NIMBLE.ruleDescriptions.<key>` to `en.json`
6. Set `static group` (one of `bonuses` / `grants` / `triggers` / `resources` / `flavor`) and `static description`
7. Give every editable field a `label:` (and ideally a `hint:`) — without `label:`, the builder warns and ships English-only labels
8. Use `withWidget()` for fields needing widget hints (`formula` / `diceFormula` / `documentUuid` / `predicate` / `templateString` / `richText` / `hidden`)
9. Co-located test file `yourRule.test.ts`

For everything else (full widget catalog, the field-type-to-widget table, `showWhen` patterns, envelope-field rules, the `RuleCard.allRules` coverage test), see [`docs/system/rules.md`](../../docs/system/rules.md).
