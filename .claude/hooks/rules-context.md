# Rules System Context

You are working with Nimble's **Rules system** — generic, data-driven modifiers attached to items that automatically apply effects to actors during data preparation.

## Design Philosophy

Rules are **intentionally generic building blocks**, not named after specific features. A rule like `abilityBonus` can be used by any item — a class feature, a magic item, a racial trait — to grant an ability score bonus. This generality enables **homebrewing**: game masters can compose any combination of rules on any item to create custom features without code changes. When creating new rule types, keep them general-purpose. Name them after *what they do* (e.g., `speedBonus`, `grantProficiency`), never after a specific feature that uses them.

## Architecture

- **Base class**: `NimbleBaseRule` (`src/models/rules/base.ts`) extends `foundry.abstract.DataModel`
- **Registration**: `src/config/registerRulesConfig.ts` maps type strings to classes in `CONFIG.NIMBLE.ruleDataModels` and i18n labels in `CONFIG.NIMBLE.ruleTypes`
- **Storage**: Plain objects in `item.system.rules` (`ArrayField` of `ObjectField`). Each has `id`, `type`, `disabled`, `priority`, `predicate`, and type-specific fields
- **Instantiation**: `RulesManager` (`src/managers/RulesManager.ts`) is created per item in `prepareBaseData()`, looks up classes from `CONFIG.NIMBLE.ruleDataModels`, instantiates with item as parent

## Lifecycle Hooks (execution order)

1. `prePrepareData()` — called during `actor.prepareDerivedData()`. Modify actor system data (bonuses, stats)
2. `afterPrepareData()` — called after `actor.prepareData()` completes. Final adjustments
3. `preCreate(args)` — before item creation on actor. Can grant other items, modify pending items
4. `preUpdate(changes)` / `afterUpdate(changes)` — around item updates
5. `afterDelete()` — after item deletion, revert modifications
6. `preUpdateActor(changes)` — before actor update, can create/delete embedded items

The actor collects all enabled rules from all items, sorts by `priority`, then calls hooks in order.

## Creating a New Rule Type

1. Create `src/models/rules/yourRule.ts` extending `NimbleBaseRule`
2. Define a local `schema()` function returning type-specific Foundry data fields
3. Override `defineSchema()` merging `NimbleBaseRule.defineSchema()` with your schema
4. Implement lifecycle hooks (most commonly `prePrepareData()`)
5. Register in `src/config/registerRulesConfig.ts` — add to both `ruleTypes` and `ruleDataModels`
6. Add the i18n label key to `en.json`
7. Keep the rule **generic** — it should be reusable across any item type
8. Add a co-located test file `src/models/rules/yourRule.test.ts` — see existing tests (e.g., `speedBonus.test.ts`) for the pattern: mock actor/item, instantiate the rule directly, and verify lifecycle hooks modify actor data correctly

## Key Patterns

- **Guard with `isEmbedded`**: Always `if (!item.isEmbedded) return;` at start of `prePrepareData()`
- **Predicate testing**: `this.test()` checks domain tags. Empty predicate = always apply
- **Formula resolution**: `this.resolveFormula(formula)` evaluates against actor roll data
- **Forward declarations**: Use local interfaces for `NimbleBaseActor`/`NimbleBaseItem` to avoid circular imports (see base.ts pattern)
- **Modify actor via `foundry.utils.setProperty()`**: e.g., `foundry.utils.setProperty(actor.system, 'abilities.${ability}.bonus', newValue)`

## RulesManager API

`RulesManager` extends `Map<string, NimbleBaseRule>`:
- `addRule(data, options?)` / `updateRule(id, data)` / `deleteRule(id)` — CRUD
- `hasRuleOfType(type)` / `getRuleOfType(type)` — query by type
- `disableAllRules()` / `enableAllRules()` — bulk toggle

## Example: AbilityBonusRule pattern

```typescript
class AbilityBonusRule extends NimbleBaseRule<AbilityBonusRule.Schema> {
  static override defineSchema(): AbilityBonusRule.Schema {
    return { ...NimbleBaseRule.defineSchema(), ...schema() };
  }

  prePrepareData(): void {
    if (!this.item.isEmbedded) return;
    const actor = this.item.actor as NimbleCharacter;
    const value = this.resolveFormula(this.value);
    for (const ability of this.abilities) {
      const baseBonus = actor.system.abilities[ability]?.bonus ?? 0;
      foundry.utils.setProperty(actor.system, `abilities.${ability}.bonus`, baseBonus + value);
    }
  }
}
```
