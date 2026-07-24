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

#### Leaf forms

```jsonc
// Atomic — key:value must exist in domain
{ "armor": "unarmored" }           // domain.has("armor:unarmored")

// Array OR — at least one value must match
{ "armor": ["unarmored", "light"] } // domain.has("armor:unarmored") || domain.has("armor:light")

// Binary — min / max / equal against numeric tag suffixes
{ "level": { "min": 5 } }          // any "level:N" in domain where N >= 5
```

#### Composition with `$and` / `$or`

For tags whose value is already part of the key (e.g. `self:bloodied`, `target:concentrating`) or for combining tags across namespaces, use the `$and` / `$or` operators. Their value is an array — each element is either an **atom string** (presence-checked against the full tag) or a **sub-predicate object** for nesting.

```jsonc
// AND — every atom must be present
{ "$and": ["self:raging", "self:bloodied"] }

// OR — at least one atom must be present
{ "$or": ["self:bloodied", "self:dying"] }

// Berserker: raging AND (bloodied OR dying) — nest with a sub-predicate object
{
  "$and": [
    "self:raging",
    { "$or": ["self:bloodied", "self:dying"] }
  ]
}

// Mix atoms with other leaf forms inside the array
{
  "$and": [
    "self:bloodied",
    { "armor": "unarmored" },
    { "level": { "min": 5 } }
  ]
}
```

The top-level object is an implicit AND over its entries, so you can combine a `$or` with other leaf forms at the top level:

```jsonc
{
  "armor": "unarmored",
  "$or": ["self:bloodied", "self:concentrating"]
}
```

`$and: []` is vacuously true; `$or: []` is vacuously false.

### Domain tags

Tags are populated during `_populateDerivedTags()` in actor data prep, before rules run.

#### Lifecycle timing — which tags are available when

Not every tag exists at every lifecycle phase. Three populating points, in order:

1. **`prepareBaseData()` → `_populateBaseTags()`** — emits `size:*` and `disposition:*`. Available everywhere downstream.
2. **`prepareDerivedData()` start → `_populateDerivedTags()`** — emits the bulk of the vocabulary: `self:bloodied | dying | lastStand | concentrating`, `self:fullHp`, `target:bloodied | concentrating`, `enemiesAdjacent:*`, character `class:* / ancestry:* / background:* / level:* / armor:* / self:shield | noShield / proficiency:*`. The base actor runs `_prepareEarlyDerivedData()` first (characters compute `hp.max` there) so HP-derived tags are fresh, then populates tags *just before* `prePrepareData` hooks fire — so these tags are visible in **both** `prePrepareData` and `afterPrepareData`.
3. **Late in `prepareDerivedData()`** (after ability mods are finalized) — emits the character `<ability>:<mod>` tags. Ability mods can't exist earlier: `abilityBonus` rules contribute to them *during* `prePrepareData`, so these tags are visible **only in `afterPrepareData` and later hooks**.

A rule whose effect runs in `prePrepareData` therefore cannot gate on an `<ability>:<mod>` tag — the predicate would never match. This is enforced by guardrails rather than left silent: the Rules Builder's predicate editor shows a warning banner (instead of the match preview) when an early-phase rule references a key in `CONFIG.NIMBLE.LATE_PREDICATE_KEYS`, and rule construction emits a once-per-rule `console.warn` for the same condition. Whether a rule class is early-phase is introspected automatically via `NimbleBaseRule.appliesInPrePrepareData` (true when the class implements a `prePrepareData` method) — never add a no-op `prePrepareData` for documentation purposes, as it would falsely mark the rule early.

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
| `<ability>:<mod>` | Ability scores | After ability mods computed (visible in `afterPrepareData` only) |

#### Actor type tags

| Tag | Actor type |
|-----|-----------|
| `solo-monster` | Solo Monster |
| `minion` | Minion |

### `targetCondition` on `damageBonus`

The `damageBonus` rule has an optional `targetCondition` field — a predicate evaluated against the **target's** domain at activation time (not the rule owner's domain). This enables bonuses that gate on target state:

```jsonc
// +@level damage when the target is bloodied
{
  "type": "damageBonus",
  "value": "@level",
  "delivery": "any",
  "source": "any",
  "targetCondition": { "$and": ["target:bloodied"] }
}

// +1d6 damage when the target is bloodied OR concentrating
{
  "type": "damageBonus",
  "value": "1d6",
  "delivery": "any",
  "source": "any",
  "targetCondition": { "$or": ["target:bloodied", "target:concentrating"] }
}
```

`targetCondition` is evaluated via `getTargetDomain()`, which returns only `target:*` tags. This prevents `self:*` tags from the target actor leaking into the evaluation.

When no target is selected, bonuses with `targetCondition` are excluded. Bonuses without `targetCondition` (or with `targetCondition: {}`) always apply regardless of target.

::: tip
`targetCondition` is only available on `damageBonus`. Other rule types use the standard `predicate` field which evaluates against the rule owner's domain.
:::

## `toggleEffect` (player-controlled tag pushes)

`toggleEffect` is a foundation rule that pushes one or more domain tags into the actor's domain while a backing Foundry `ActiveEffect` is enabled. The rule itself doesn't carry nested rules or express any modifiers; its only job is the tag push. Sibling rules elsewhere predicate on those tags via the standard `predicate` field.

```jsonc
{
  "type": "toggleEffect",
  "label": "Rage",
  "tags": ["self:raging"],
  "turnOff": ["onActorKilled", "onEncounterEnd", "onRest"]
}
```

### Lifecycle

- **Toggle on**: the player activates the item. The rule's `onItemActivated` hook creates a Foundry `ActiveEffect` on the actor (or re-enables a disabled one), flagged with `nimble.toggleEffectRuleId` and `nimble.toggleEffectItemId`. The AE shows up in the Foundry effects panel. Re-activating the item while the AE is already enabled is a no-op. Item use is "ensure on," never "flip off," so re-rolling resources mid-rage can't accidentally drop the effect.
- **Toggle off (manual)**: the player disables (or deletes) the AE via the effects panel.
- **Toggle off (event)**: any event listed in `turnOff` deletes the AE when it fires for the rule's owning actor.
- **Tag push**: during `prePrepareData()` the rule scans the actor's effects; if a matching AE exists and is not disabled, every entry in `tags` is added to `actor.tags`. Tags drop on the next prep when the AE is gone or disabled.

### `turnOff` triggers

| Value | Fires from |
|---|---|
| `onActorKilled` | `updateActor` when HP drops to 0 with a full wound track (or no wound track, e.g. monsters) |
| `onActorWounded` | `updateActor` on bloodied / lastStand transition |
| `onRest` | `nimble.rest` hook |
| `onTurnStart` | `combatTurn` start of owner's turn |
| `onTurnEnd` | `combatTurn` end of owner's turn |
| `onEncounterEnd` | `updateCombat(started:false)` or `deleteCombat` (dedup'd) |
| `onActorDying` | `updateActor` when HP drops to 0 with the wound track below max, or `nimble.conditionApplied` with `condition: 'dying'` |

### Worked example: Rage

The Rage item carries the `toggleEffect` plus its sibling modifiers. Other "while raging" features (Intensifying Fury, etc.) live on their own items and just predicate on `self:raging`:

```jsonc
[
  {
    "type": "toggleEffect",
    "tags": ["self:raging"],
    "turnOff": ["onActorKilled", "onEncounterEnd", "onRest"]
  },
  {
    "type": "damageBonus",
    "value": "@level",
    "delivery": "melee",
    "source": "weapon",
    "predicate": { "self": "raging" }
  }
]
```

### Priority note

`toggleEffect.prePrepareData()` pushes tags during the `prePrepareData` pass. The default priority is `1` (the base default). Bonus-style rules that consume the tag in `afterPrepareData` (the common case: `damageBonus`, `damageReduction`, etc.) always see the tags because `afterPrepareData` runs after every rule's `prePrepareData`. If a sibling rule also runs in `prePrepareData` and predicates on the pushed tag, set the `toggleEffect` rule's priority **lower** than the sibling's (e.g. `0`) so it runs first and the tag is in place when the sibling tests its predicate.

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
11. The user documentation's rule reference is generated automatically from your schema (`pnpm docs:generate`), so labels, hints, and choices must be user-comprehensible. Optionally add a hand-written worked example at `docs/documentation/reference/_partials/<key>.md` (no headings; start with `**Example — <item name>:**`) — it is inlined under your rule's entry.

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

## Pool storage vs. pool consumption

Both pool kinds (`dicePool`, `chargePool`) are **pure storage rules** — they declare the pool (max, dieSize, initial state, refill/recovery triggers) but say nothing about how the pool is *spent*. Spending is the job of a paired consumer rule on the same item.

| Pool type | Storage rule | Consumer rule | Consumption modes |
|---|---|---|---|
| Charges (scalar count) | `chargePool` | `chargeConsumer` | spend on activation (cost formula) |
| Rolled dice (face array) | `dicePool` | `diceConsumer` | `manual` (dialog spend) / `autoBonus` (auto-add to qualifying attacks, no consume) |

A `dicePool` rule with no paired `diceConsumer` defaults to `manual` spending — the dialog prompts the player at activation time. To make a pool snowball as a damage bonus (Berserker Fury Dice), add a sibling `diceConsumer` with `mode: 'autoBonus'` and the desired `bonusOnAttackDelivery` filter (`'melee'`, `'ranged'`, `'any'`, or `null`).

Multiple `diceConsumer` rules can target the same pool — e.g. an `autoBonus` consumer for outgoing damage and a `manual` consumer that a reaction effect spends from. This is how features like Berserker's "That all you got?!" reaction share the Fury Dice pool with the auto-bonus damage path.

Activating an item with a manual consumer opens the pool's spend panel, opening the character sheet first if it is closed. Because the spend flow posts its own chat card, the item's default activation card is suppressed — but only while the rule automation setting ("Auto-Apply Conditions from Rules") is enabled, since that setting gates the activation dispatch that opens the panel. With automation off, activation posts the normal card instead.

A manual consumer's `effectType` controls what its effect roll produces. The default, `generic`, posts the rolled total to chat. `damageReduction` additionally banks the total on the actor as a one-shot incoming-damage reduction: the next time damage is applied to the actor, the banked amount is subtracted (after armor, alongside any `damageReduction` rule entries) and then cleared, even when it absorbs the damage entirely. This is how "That all you got?!" applies its reduction automatically: the player spends Fury Dice when attacked, and the GM's Apply Damage click consumes the banked amount.

The bank is stored as an Active Effect on the actor named for the pending amount ("Damage Reduction (8)"). Repeated spends accumulate onto the same effect. Deleting the effect drops the banked reduction; disabling it suspends it (a disabled bank neither applies nor gets consumed). Banks expire when the combat ends (`src/hooks/bankedDamageReductionExpiry.ts`, active-GM-gated, same end-of-combat dedup as the encounter-end dice trigger); banks created outside combat persist until consumed or removed. A bank is only consumed when the hit would otherwise deal damage — immunity or armor zeroing the hit leaves it in place.

## Damage reduction: flat, half (resistance), and immunity

`damageReduction` rules have a `mode`: `flat` (default) subtracts the resolved `value`; `half` halves the damage instead and ignores `value`. Monster actors additionally carry `attributes.damageResistances` and `attributes.damageImmunities` (damage-type keys, editable in the NPC meta config dialog); a matching resistance is equivalent to an untyped-scope `half` entry, and a matching immunity zeroes the hit outright.

Application order in `calculateAdjustedDamage` (`src/documents/chatMessage.ts`): outcome/armor halving → immunity (zero) → resistance halving (applies **once**, no matter how many sources match — no quartering) → flat rule reductions + banked reduction → clamp at zero → temp HP (inside `actor.applyDamage`). Halving rounds up, matching the heavy-armor convention. The books don't specify resistance-vs-reduction ordering; halving first keeps flat reductions fully effective. `attributes.damageVulnerabilities` is stored and editable but **not yet automated** (the vulnerability rule interacts with armor and needs its own pass).

The system never hides Active Effects: every enabled AE on an actor renders on the token, on the canvas conditions panel, and in the sheet's effects lists, regardless of what created it. New rules that back their state with an AE get this visibility for free.
