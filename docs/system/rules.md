---
title: "Rules System"
outline: deep
---

# Rules System

Nimble's **Rules system** is a set of generic, data-driven modifiers attached to items. When an actor prepares its data, the rules on every embedded item run lifecycle hooks that mutate the actor's derived data. This is how class features, magic items, ancestry traits, and homebrew options affect a character without writing per-feature code.

## Design Philosophy

Rules are **intentionally generic building blocks**, not named after specific features. A rule like `abilityBonus` can be used by any item — a class feature, a magic item, a racial trait — to grant an ability score bonus. This generality enables **homebrewing**: game masters can compose any combination of rules on any item to create custom features without code changes.

When creating a new rule type, name it after *what it does* (`speedBonus`, `grantProficiency`), never after a specific feature that uses it.

## Architecture

- **Base class**: `NimbleBaseRule` (`src/models/rules/base.ts`) extends `foundry.abstract.DataModel`.
- **Registration**: `src/config/registerRulesConfig.ts` maps type strings to classes in `CONFIG.NIMBLE.ruleDataModels` and to i18n labels in `CONFIG.NIMBLE.ruleTypes`.
- **Storage**: Plain objects in `item.system.rules` (an `ArrayField` of `ObjectField`). Each entry has `id`, `type`, `disabled`, `priority`, `predicate`, plus type-specific fields.
- **Instantiation**: `RulesManager` (`src/managers/RulesManager.ts`) is created per item in `prepareBaseData()`. It looks up the class from `CONFIG.NIMBLE.ruleDataModels` and instantiates it with the item as parent.

## Lifecycle Hooks

The actor collects all enabled rules from all items, sorts by `priority` (lower runs first), then calls hooks in this order:

1. `prePrepareData()` — during `actor.prepareDerivedData()`. Modify actor system data (bonuses, stats).
2. `afterPrepareData()` — after `actor.prepareData()` completes. Final adjustments.
3. `preCreate(args)` — before item creation on actor. Can grant other items, modify pending items.
4. `preUpdate(changes)` / `afterUpdate(changes)` — around item updates.
5. `afterDelete()` — after item deletion, revert modifications.
6. `preUpdateActor(changes)` — before actor update; can create/delete embedded items.

Additional event hooks (combat, save, rest, item-used, etc.) are dispatched from the corresponding system events. See `NimbleBaseRule` for the full surface.

## Key Patterns

- **Guard with `isEmbedded`**: Always start `prePrepareData()` with `if (!this.item.isEmbedded) return;`. Rules on un-embedded items have no actor to mutate.
- **Predicate testing**: `this.test()` checks domain tags from the predicate. An empty predicate always passes.
- **Formula resolution**: `this.resolveFormula(formula)` evaluates against the actor's roll data and returns a number.
- **Forward declarations**: Use local interfaces for `NimbleBaseActor` / `NimbleBaseItem` to avoid circular imports — see the pattern in `base.ts`.
- **Mutate via `foundry.utils.setProperty()`**: e.g., `foundry.utils.setProperty(actor.system, 'abilities.str.bonus', newValue)`.

## Predicates & Domain Tags

Every rule has a `predicate` field (a `PredicateField`) that gates whether the rule applies. When `this.test()` is called, the predicate is evaluated against the actor's **domain** — a `Set<string>` of tags describing the actor's current state.

### Predicate syntax

Three forms are supported:

```jsonc
// Atomic — key:value must exist in domain
{ "armor": "unarmored" }           // domain.has("armor:unarmored")

// Array OR — at least one value must match
{ "armor": ["unarmored", "light"] } // domain.has("armor:unarmored") || domain.has("armor:light")

// Presence-check (AND composition) — full tag must exist in domain
{ "self:bloodied": true, "self:concentrating": true }  // both must be present
```

All entries in a predicate are AND'd together. The presence-check form (`true`) enables AND composition for tags under the same namespace (e.g. multiple `self:*` conditions). Only `true` is valid — `false` is rejected (there is no "not-present" semantics).

### Domain tags

Tags are populated during `_populateDerivedTags()` in actor data prep, before rules run.

#### Tags on all actors

| Tag | Source | When |
|-----|--------|------|
| `size:<category>` | `sizeCategory` attribute | Always |
| `disposition:<type>` | Token disposition | Always |
| `enemiesAdjacent:<count>` | Adjacency sync | In combat |
| `enemiesAdjacent:most` | Adjacency sync | Has most adjacent enemies |
| `self:bloodied` | `actor.statuses` | Bloodied status active |
| `self:dying` | `actor.statuses` (dying) | PC/Hero at 0 HP with wounds remaining |
| `self:lastStand` | `actor.statuses` (lastStand) | Solo/Legendary monster phase change at 0 HP |
| `self:fullHp` | HP value/max | HP equals max |
| `self:concentrating` | `actor.statuses` | Concentration status active |
| `target:bloodied` | `actor.statuses` | Bloodied status active (for `targetCondition`) |
| `target:concentrating` | `actor.statuses` | Concentration status active (for `targetCondition`) |

#### Character-only tags

| Tag | Source | When |
|-----|--------|------|
| `level:<n>` | Class data | Always |
| `class:<identifier>` | Class items | Per class |
| `ancestry:<identifier>` | Ancestry item | If present |
| `background:<identifier>` | Background item | If present |
| `armor:equipped` / `armor:unarmored` | Equipment scan | Has armor with armorClass rules |
| `self:shield` / `self:noShield` | Equipment scan | Has shield item equipped |
| `proficiency:armor:<type>` | Proficiencies | Per armor proficiency |
| `proficiency:weapon:<type>` | Proficiencies | Per weapon proficiency |
| `proficiency:language:<type>` | Proficiencies | Per language |
| `<ability>:<mod>` | Ability scores | After ability mods computed |

#### Actor type tags

| Tag | Actor type |
|-----|-----------|
| `solo-monster` | Solo Monster |
| `minion` | Minion |

### `targetCondition` on `damageBonus`

The `damageBonus` rule has an optional `targetCondition` field — a predicate evaluated against the **target's** domain at activation time (not the rule owner's domain). This enables bonuses that gate on target state:

```jsonc
{
  "type": "damageBonus",
  "value": "@level",
  "delivery": "any",
  "source": "any",
  "targetCondition": { "target": "bloodied" }
}
```

`targetCondition` is evaluated via `getTargetDomain()`, which returns only `target:*` tags. This prevents `self:*` tags from the target actor leaking into the evaluation.

When no target is selected, bonuses with `targetCondition` are excluded. Bonuses without `targetCondition` (or with `targetCondition: {}`) always apply regardless of target.

::: tip
`targetCondition` is only available on `damageBonus`. Other rule types use the standard `predicate` field which evaluates against the rule owner's domain.
:::

## RulesManager API

`RulesManager` extends `Map<string, NimbleBaseRule>`:

- `addRule(data, options?)` / `updateRule(id, data)` / `deleteRule(id)` — CRUD.
- `hasRuleOfType(type)` / `getRuleOfType(type)` — query by type.
- `disableAllRules()` / `enableAllRules()` — bulk toggle.

## Creating a New Rule Type

1. Create `src/models/rules/yourRule.ts` extending `NimbleBaseRule`.
2. Define a local `schema()` function returning type-specific Foundry data fields.
3. Override `defineSchema()` merging `NimbleBaseRule.defineSchema()` with your schema.
4. Implement lifecycle hooks (most commonly `prePrepareData()`).
5. Register in `src/config/registerRulesConfig.ts` — add to both `ruleTypes` and `ruleDataModels`.
6. Add the i18n label key to `en.json` (under `NIMBLE.ruleTypes.<key>`).
7. Add a description i18n key under `NIMBLE.ruleDescriptions.<key>` for the builder UI.
8. Make the rule renderable in the **Rules Builder** — see [below](#rules-builder-integration).
9. Keep the rule **generic** — it should be reusable across any item type.
10. Add a co-located test (`src/models/rules/yourRule.test.ts`). Mock actor/item, instantiate the rule directly, and verify the lifecycle hook mutates actor data correctly. See `speedBonus.test.ts` for the pattern.

### Minimal class skeleton

```typescript
class AbilityBonusRule extends NimbleBaseRule<AbilityBonusRule.Schema> {
  static override group = 'bonuses';
  static override description = 'NIMBLE.ruleDescriptions.abilityBonus';

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

## Rules Builder Integration

The rules-builder UI (`src/view/rulesBuilder/`) auto-generates a card per rule from `defineSchema()`. There is **no per-rule UI code** — every rule is rendered by `SchemaFieldRenderer.svelte` reading the schema metadata. To make your rule first-class in the builder:

### Class-level metadata (required)

```typescript
class YourRule extends NimbleBaseRule<YourRule.Schema> {
  static override group = 'bonuses';
  static override description = 'NIMBLE.ruleDescriptions.yourRule';
  // ...
}
```

- `static group` — bucket in the rule-type picker. Existing groups: `'bonuses'`, `'grants'`, `'triggers'`, `'resources'`, `'flavor'`. Defaulting to `'unsorted'` triggers a dev-mode warning.
- `static description` — i18n key shown in the card's help tooltip and the picker's grid. Add the string to `en.json` under `NIMBLE.ruleDescriptions.<key>`.

### Per-field metadata (required)

Every field a user edits **must** carry:

- **`label:`** — display label. Without it, `RuleCard` auto-generates an English-only label from the camelCase property name and warns once per `(rule.type, field)` in dev. Localized labels are required for shipping.
- **`hint:`** — short help text shown below the input. Optional but strongly recommended for any non-obvious field.

### Widget hints (when type alone isn't enough)

Foundry's data-field types map automatically to widgets, but some fields need a hint via the `withWidget()` helper:

```typescript
import { withWidget } from './_widgetOption.js';

value: new fields.StringField(
  withWidget({
    required: true,
    nullable: false,
    initial: '@level',
    label: 'Bonus',
    hint: 'Flat (5), formula (@level), or dice (1d6+2).',
    widget: 'formula',
  }),
),
```

The closed widget catalog is **`formula | diceFormula | documentUuid | predicate | templateString | richText | hidden`**. `withWidget()` validates the hint in dev and warns on typos.

For `widget: 'documentUuid'`, set `documentTypes: ['Item.spell']` (or `['Item']`, `['Actor']`) to gate accepted drops.

### Conditional fields with `showWhen`

Hide a field based on the current rule's data:

```typescript
count: new fields.NumberField({
  required: false,
  nullable: true,
  label: 'How many to choose',
  showWhen: (data) => data.mode !== 'auto',
} as unknown as never),
```

::: tip Type cast quirk
SchemaField/ArrayField options don't accept `showWhen` through `withWidget()`'s leaf-only generic, so use a raw `as unknown as never` cast at the option-object site. See `applyCondition.ts` and `grantSpells.ts` for live examples.
:::

### Default field-type rendering

| Schema construct | UI |
|---|---|
| `BooleanField` | checkbox |
| `NumberField` | number input (respects `min`/`max`/`step`/`integer`) |
| `StringField` (no `choices`) | text input |
| `StringField` (with `choices`) | `<select>` (string[] or `Record<key, label>`; functions evaluated each render) |
| `HTMLField` | rich-text editor |
| `PredicateField` | predicate builder |
| `ArrayField<StringField>` (with `choices`) | tag group |
| `ArrayField<StringField>` (no `choices`) | add/remove string list |
| `ArrayField<NumberField>` | add/remove number list |
| `ArrayField<SchemaField>` | fieldset list (recursive render) |
| `SchemaField` | nested fieldset |
| anything else | inline-error block + console warn |

Adding a new `ArrayField<X>` element type requires extending `SchemaFieldRenderer.svelte` — the dispatch is intentionally closed.

### Envelope fields (rendered by RuleCard, not as schema fields)

`id`, `type`, `disabled`, `identifier`, `label`, `priority`, `predicate` are surfaced by the rule card itself (header, advanced section). Don't add `label:` / `hint:` / `widget:` to them — they're filtered out of the per-field render.

### Coverage test

`src/view/rulesBuilder/components/RuleCard.allRules.test.ts` instantiates every registered rule type with default values and fails on any inline-error block or "no widget" warning. It runs automatically — your new rule is covered as soon as it's registered.
