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

A `min`/`max` binary op requires the keyed tag to be **present** in the domain: if no `key:N` tag matches, the op fails (it does not vacuously pass). This is what makes `{ "alliesAdjacent": { "min": 1 } }` correctly fail when no allies are adjacent. Note this applies to `max` too — a count-style tag that is simply absent at zero (e.g. `enemiesAdjacent`, which is only emitted for counts above zero in combat) makes `{ "enemiesAdjacent": { "max": 2 } }` fail rather than treating the absent tag as "0 enemies". Gate such rules on presence explicitly (e.g. combine with an in-combat atom) if you need the zero case to pass.

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
2. **`prepareDerivedData()` start → `_populateDerivedTags()`** — emits the bulk of the vocabulary: `self:bloodied | dying | lastStand | concentrating`, `self:fullHp`, `target:bloodied | concentrating`, `enemiesAdjacent:*`, character `class:* / ancestry:* / background:* / level:* / armor:* / self:shield | noShield / proficiency:*`, and pool state (`self:*ChargePool:*` and the dice equivalents, see [Charge pool state tags](#charge-pool-state-tags)). The base actor runs `_prepareEarlyDerivedData()` first (characters compute `hp.max` there, folding in their `maxHpBonus` rules — see [Rules read outside the hook sweep](#rules-read-outside-the-hook-sweep)) so HP-derived tags are fresh, then populates tags *just before* `prePrepareData` hooks fire — so these tags are visible in **both** `prePrepareData` and `afterPrepareData`.
3. **Late in `prepareDerivedData()`** (after ability mods are finalized) — emits the character `<ability>:<mod>` tags. Ability mods can't exist earlier: `abilityBonus` rules contribute to them *during* `prePrepareData`, so these tags are visible **only in `afterPrepareData` and later hooks**.

A rule whose effect runs in `prePrepareData` therefore cannot gate on an `<ability>:<mod>` tag — the predicate would never match. This is enforced by guardrails rather than left silent: the Rules Builder's predicate editor shows a warning banner (instead of the match preview) when an early-phase rule references a key in `CONFIG.NIMBLE.LATE_PREDICATE_KEYS`, and rule construction emits a once-per-rule `console.warn` for the same condition. Whether a rule class is early-phase is introspected automatically via `NimbleBaseRule.appliesInPrePrepareData` (true when the class implements a `prePrepareData` method) — never add a no-op `prePrepareData` for documentation purposes, as it would falsely mark the rule early. A rule read outside the hook sweep overrides the getter instead (see below).

#### Rules read outside the hook sweep

A few values are needed before the `prePrepareData` sweep runs, so the actor reads those rules directly instead of letting them push. `maxHpBonus` is the case to copy: it exposes `resolvedBonus()`, and `character.ts#_prepareHitPoints` sums every `maxHpBonus` rule on the actor straight into `hp.max`. It has to work this way because `hp.max` feeds `_populateDerivedTags()`, which runs ahead of the sweep — a `prePrepareData` hook would land too late.

Two consequences for a rule in this position:

- It must override `static get appliesInPrePrepareData()` to `true`. The automatic introspection looks for a `prePrepareData` method and would otherwise miss it, silently dropping the late-predicate guardrails for a rule that evaluates its predicate *earlier* than any early-phase rule.
- Those shared guardrails are not enough on their own. `CONFIG.NIMBLE.LATE_PREDICATE_KEYS` holds the ability-score keys alone, so a predicate on `class:*`, `level:*` or `self:bloodied` draws no warning from them, even though a rule read this early cannot see those tags either. `maxHpBonus` closes the gap with an `afterPrepareData` hook that re-tests its predicate once the domain is complete and warns when the answer flipped: a predicate that passes then but failed during the early pass is one that contributed nothing. Comparing the two answers is more accurate than warning on a list of tag prefixes, which cannot tell the actor's `class:` tag apart from the identical one a feature item carries.
- The value must stay derived. Writing it into a stored field is what caused issue #499: the banked total never caught up with a level-up, and a blind add-on-create/subtract-on-delete pair cannot be reconciled afterwards. Note that `attributes.hp.bonus` is *not* that field — it is the player's manually-entered bonus, round-tripped through the Edit Hit Points dialog, so folding a rule total into it would be written back to source on the next save.

#### Tags on all actors

| Tag | Source | When |
|-----|--------|------|
| `size:<category>` | `sizeCategory` attribute | Always |
| `disposition:<type>` | Token disposition | Always |
| `enemiesAdjacent:<count>` | Adjacency sync | In combat |
| `enemiesAdjacent:most` | Adjacency sync | Has most adjacent enemies |
| `alliesAdjacent:<count>` | Adjacency sync | In combat |
| `alliesAdjacent:most` | Adjacency sync | Has most adjacent allies |
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
| `subclass:<identifier>` | Subclass items | Per subclass |
| `ancestry:<identifier>` | Ancestry item | If present |
| `background:<identifier>` | Background item | If present |
| `armor:equipped` / `armor:unarmored` | Equipment scan | Has armor with armorClass rules |
| `self:shield` / `self:noShield` | Equipment scan | Has shield item equipped |
| `proficiency:armor:<type>` | Proficiencies | Per armor proficiency |
| `proficiency:weapon:<type>` | Proficiencies | Per weapon proficiency |
| `proficiency:language:<type>` | Proficiencies | Per language |
| `self:<id>ChargePool:<n>` | Charge pool flags | Per charge pool; `<n>` is the current count |
| `self:no<Id>Charges` | Charge pool flags | Charge pool is empty |
| `self:<id>ChargesMax` | Charge pool flags | Charge pool is at its max |
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

### Modifying a toggle from another feature: `modifyToggle`

A `modifyToggle` rule (matched to the target toggle by `toggleIdentifier`, falling back to the toggle rule's `id`) can adjust the toggle's lifecycle from any of the actor's items:

- `suppressTurnOff`: turn-off events the target toggle should ignore while the modifier's predicate passes.
- `turnOn` (`onTurnStart` | `onActorDying` | `onCritReceived`): events on which the target toggle switches **on** automatically. The modifier's own predicate gates the turn-on, so the granting feature carries its condition (e.g. `{ "self": "dying" }` for a while-Dying auto-activation). Auto-turn-on restores the toggle's state only — it creates or re-enables the backing AE (GM-side, with a chat announcement) but does not run the owning item's activation effects. `onCritReceived` is driven by the defender-side `onAttackReceived` dispatch, which fires when damage from a critical hit is applied to the actor.

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

## Roll modes: default vs. situational

Two different kinds of rule adjust a d20 roll mode, and the difference is *when the adjustment is decided*.

**Default roll modes** are baked into the actor's stored roll mode and apply to every roll of that kind:

| Rule | Where the value lands | Resolved by |
| --- | --- | --- |
| `skillRollMode` | `system.skills.<key>.defaultRollMode` | `afterPrepareData`, every data-prep cycle |
| `initiativeRollMode` | `system.attributes.initiative.defaultRollMode` | `afterPrepareData`, every data-prep cycle |
| `savingThrowRollMode` | `system.savingThrows.<key>.defaultRollMode` | Character creation and the "Reset to Class Defaults" button only |

`savingThrowRollMode` is the odd one out: saving throw roll modes are user-configurable and persisted, so the rule has **no data-prep hook**. A pack edit alone therefore never reaches an existing character, which is why changes to it ship with a migration (see `Migration022CelestialSavingThrow`).

**Situational roll modes** (`situationalRollMode`) are offered rather than applied. The rule stores nothing on the actor; `CheckRollDialog` calls `getSituationalRollModeOptions` (`src/view/dialogs/CheckRollDialog.utils.ts`) to list the rules whose predicate passes and whose `checkType` and target key match the roll being configured, renders one checkbox each, and folds the checked values into that roll's roll mode only. Because nothing is persisted, the rule needs no lifecycle hook at all, and adding one would defeat its purpose.

Which to reach for:

- The condition is something the system can see (bloodied, unarmored, a toggle being on, a pool being empty): use a default roll mode rule with a `predicate`. It re-resolves every data-prep cycle, so it turns itself on and off.
- The condition is something only the table knows (what a save is against, what a skill check is being used for): use `situationalRollMode` and put the description in the rule's `label`, which is what the checkbox shows. The `predicate` still gates whether the option is offered, so the two compose.
- The roll is an attack: neither applies. Attacks are configured in the item activation dialog, where `conditionalBonus` offers a per-attack choice of advantage or bonus damage.

Each option renders with the granting item's own image, so no icon has to be authored on the rule or kept in sync with the item. Checking an option moves the roll mode slider itself, so the slider always shows the roll that will be made; the dialog records the adjustment it actually applied, since clamping at the slider's ends can swallow part of it and unchecking has to give back exactly what checking took. The GM's "hide roll" toggle sits beside the roll formula at the bottom of the dialog, well away from the situational options.

A rule offering a zero adjustment is skipped, since its checkbox would do nothing. Option keys are `${itemUuid}:${ruleId}`, because rule ids are only unique within an item and two copies of the same item would otherwise collapse into one checkbox.

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

The closed widget catalog is **`formula | diceFormula | documentUuid | predicate | templateString | richText | dicePoolPicker | chargePoolPicker | hidden`**. `withWidget()` validates the hint in dev and warns on typos.

For `widget: 'documentUuid'`, set `documentTypes: ['Item.spell']` (or `['Item']`, `['Actor']`) to gate accepted drops.

### Conditional widgets

When the right input depends on a sibling field, pass a function instead of a hint. It receives the same data object as `showWhen`:

```typescript
poolIdentifier: new fields.StringField(
  withWidget({
    required: true,
    label: 'Pool',
    widget: (data) => (data.poolType === 'charge' ? 'chargePoolPicker' : 'dicePoolPicker'),
  }),
),
```

The resolved value must still be in the catalog — `withWidget()` cannot check a resolver's return value, so `<SchemaFieldRenderer>` warns at render time if it isn't. `'hidden'` works here too, giving conditional visibility that depends on which widget applies.

Write the fallback branch to match the sibling field's `initial` value: the generated reference docs resolve the function against schema initials, so that branch is what gets documented (the field's description then notes that the input varies).

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

`id`, `type`, `disabled`, `identifier`, `label`, `priority`, `predicate`, `suppressActivationCard` are surfaced by the rule card itself (header, advanced section). Don't add `label:` / `hint:` / `widget:` to them — they're filtered out of the per-field render. The list lives in three places that must stay in sync: this section, `FIXED_FIELDS` in `RuleCardState.svelte.ts`, and `BASE_RULE_FIELDS` in `scripts/docs/generateReference.gen.ts`.

`suppressActivationCard` is a tri-state (`auto` / `always` / `never`) select in the advanced section. `always` and `never` force the resolution of `suppressesActivationCard()`; `auto` (the default) defers to the rule class's `_autoSuppressesActivationCard()` — `false` on the base class, overridden by `diceConsumer` for manual spend flows. Subclasses override the protected `_auto` hook, never the public method. Each rule resolves independently and the item suppresses the card when any enabled rule resolves `true`; a rule set to `never` only stops that rule from suppressing, it does not veto others. The item-side guard is unchanged: a card that carries rolls or effect nodes is never suppressed.

The `auto` branch only fires when its replacement flow is guaranteed to run: either the rule automation setting ("Apply Conditions and Effects from Rules") is enabled, or the rule class declares `onItemActivated` in its static `alwaysDispatchedEvents` list, which marks lifecycle methods the dispatcher must deliver even with rule automation off because they are core plumbing with no manual fallback. The item passes the setting state to `suppressesActivationCard({ automationEnabled })`. `always` has no replacement flow to wait on, so it suppresses regardless of the setting.

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

### Charge pool state tags

`_populateDerivedTags()` publishes the live state of every charge pool as domain tags (`src/utils/chargePool/chargePoolTags.ts`), the charge counterpart of the dice pool tags emitted alongside them. For a pool with identifier `<id>`:

| Tag | When |
|---|---|
| `self:<id>ChargePool:<n>` | Always; `<n>` is the current count |
| `self:no<Id>Charges` | Current count is zero (`<Id>` is the identifier with its first character upper-cased, so a hyphenated identifier keeps its hyphens) |
| `self:<id>ChargesMax` | Current count equals the pool max (max above zero) |

State is read straight out of flag storage, so actor-scoped and item-scoped pools are both covered; the `actor:` prefix on an actor-scoped storage key is stripped from the tag name. A predicate tests the count with a binary op on the full tag key, e.g. `{ "self:<id>ChargePool": { "min": 1 } }` for "the pool still holds a charge".

**Namespace pool identifiers per feature.** The tag key is built from the identifier alone, not from the item, so two item-scoped pools on the same actor sharing an identifier publish two values under one key. A binary op like `min` requires *every* matched value to pass, so an unrelated empty `uses` pool on another item falsifies a predicate meant for this item's `uses` pool. Give each pool an identifier that names its feature (`ember-uses`, not `uses`) and the collision cannot arise.

Because the tags are produced at data preparation, they are a snapshot of the state *before* the activation currently being dispatched spends anything: the charge write happens in an awaited continuation after the use resolves, while rules are filtered synchronously during the dispatch. A rule gated on "the pool still holds a charge" therefore fires on the very use that empties the pool, and not on the next one. That is deliberate, and it is what makes the pattern below express "the first time each encounter".

### Optional riders gated on a charge pool

A `chargeConsumer` whose pool cannot pay the cost blocks the whole activation: validation runs on `preUseItem` and vetoes the use. That is correct for an ability that cannot be used at all without the resource, and wrong for "the first time each encounter you do X, also do Y", where X has to keep working once Y is spent.

Consumers therefore honour their own predicate. A consumer that does not apply is skipped during enumeration, before validation, so it neither blocks the activation nor spends anything. The rider is then three pieces on the same item:

1. a `chargePool` with `max: 1` and a `recoveries` entry on the `encounterStart` trigger,
2. a `chargeConsumer` for that pool, predicated on the pool holding a charge, so it stops gating the activation once the charge is gone,
3. each rider rule (the "also do Y" part) carrying that same predicate.

```jsonc
// On the pool's own consumer and on every rider rule:
{ "self:emberChargePool": { "min": 1 } }
```

All three predicates read the same pre-spend snapshot during the triggering activation, so the rider resolves and the charge is consumed on that same use. On every later use in the encounter the pool reads zero, the consumer drops out instead of blocking, and the riders do not apply.

::: warning A pool predicate that can go false again discards the pool's charges
A `chargePool` rule also honours its own predicate, and a pool whose predicate does not hold is not merely hidden: it drops out of the pool definitions, and the next persist removes its stored state. Flipping the predicate back creates the pool afresh at its initial value.

That is harmless for a one-way gate such as a level threshold, which is what the pattern above uses. It silently refunds the pool on every flip if you gate one on something reversible (a toggle, a worn item, a condition). Predicate the pool's *consumer* and its rider rules instead, and leave the pool itself ungated, unless you actually want the reset.
:::

### Pool modifiers and refill gating

- **Refill predicates**: each `dicePool.refills` entry accepts an optional `predicate`, evaluated against the actor's live domain when the trigger fires (e.g. `{ "self": "raging" }` to gate a turn-start refill on an active toggle). Entries without a predicate always apply.
- **`modifyPool.addRefills`**: a modifier can contribute refill entries to the target pool without editing the base pool rule — the granting feature carries its own trigger. The modifier's rule-level predicate gates whether the entries are included at all; entry-level predicates are evaluated at trigger time (prefer these for state that flips mid-combat, since rule-level gating churns the stored pool definition).

  This works for **both pool types**: contributed entries become refills on a `dicePool` and recoveries on a `chargePool`, appended after the pool's own in each case, and their entry-level predicates are honoured on both. It is the only way to give a charge pool a new way to recover from another item, since a `chargePool.recoveries` entry takes no predicate of its own and cannot be declared cross-item.

  The field's **trigger choices are the union of both vocabularies**, because one rule type serves both pools, and the two do not match: `onAttacked` and `onCritReceived` exist only for dice pools, `onInitiativeRolled` only for charge pools. Modes need no union (the charge modes are a subset), which leaves `setIfEmpty` and `clear` offered on a charge pool that cannot perform them. Both subsystems **discard** a contributed entry whose trigger or mode they do not implement, so a mismatched pick contributes nothing rather than doing something else — but nothing warns you either, so check the target pool's type when a contributed entry appears to do nothing.
- **`modifyPool.minFace`**: a minimum face value for dice rolled into the target pool. Rolls below the floor are raised to it at every roll point (refills, activation rolls, initial seeding); manual face edits stay unclamped. The highest floor among contributing modifiers wins.

- **`modifyConsumer`**: augments the effect formula of `diceConsumer` rules targeting a pool. Matching consumers' `effectFormula` gains `+ (appendFormula)`, with an optional `effectTypeFilter` to restrict the change to e.g. `damageReduction` spends. Applied at consumer enumeration time, so both the spend panel and its preview reflect the change.
- **`poolGainMessage`**: posts a chat reminder whenever the targeted dice pool gains dice. `formula` is resolved against actor data and interpolated into `message` via `{value}`.
- **Dice refill triggers wired to dispatchers**: `onAttacked` and `onCritReceived` (damage-application pipeline), `onTurnStart` / `onTurnEnd` (turn-boundary custom hooks, GM-side), and `encounterEnd`. Other declared triggers have no dispatcher yet.
- **`maximizeDie` pool node action**: an activation effect node that raises the lowest N faces of a dice pool to the die's maximum.

Activating an item with a manual consumer opens the pool's spend panel, opening the character sheet first if it is closed. Because the spend flow posts its own chat card, the item's default activation card is suppressed. The consumer rule lists `onItemActivated` in its static `alwaysDispatchedEvents`, so the spend flow runs and the card stays suppressed even when the rule automation toggle ("Apply Conditions and Effects from Rules") is off; the spend panel is the only way to spend pool dice, so it is core plumbing rather than optional automation. This automatic suppression is the consumer rule's `auto` behavior for the `suppressActivationCard` envelope field (see the envelope-fields section); set the field to `never` on the consumer to keep the card, or to `always` on any rule to silence a card-less activation outright.

A manual consumer's `effectType` controls what its effect roll produces. The default, `generic`, posts the rolled total to chat. `damageReduction` additionally banks the total on the actor as a one-shot incoming-damage reduction: the next time damage is applied to the actor, the banked amount is subtracted (after armor, alongside any `damageReduction` rule entries) and then cleared, even when it absorbs the damage entirely. This is how "That all you got?!" applies its reduction automatically: the player spends Fury Dice when attacked, and the GM's Apply Damage click consumes the banked amount.

The bank is stored as an Active Effect on the actor named for the pending amount ("Damage Reduction (8)"). Repeated spends accumulate onto the same effect. Deleting the effect drops the banked reduction; disabling it suspends it (a disabled bank neither applies nor gets consumed). Banks expire when the combat ends (`src/hooks/bankedDamageReductionExpiry.ts`, active-GM-gated, same end-of-combat dedup as the encounter-end dice trigger); banks created outside combat persist until consumed or removed. A bank is only consumed when the hit would otherwise deal damage — immunity or armor zeroing the hit leaves it in place.

### Card-side pool spends

A `diceConsumer` can set `cardOffer` (`hit` or `criticalHit`) to be offered on the attacker's own attack card instead of through the sheet's spend panel — for a spend that the rules tie to how the attack landed, such as Berserker's Death Blow ("after you deal damage from a crit"). The panel cannot see the attack's outcome, so a consumer that opts in has no sheet flow at all: `#providesSpendFlow()` returns false, and `getDicePoolConsumers` hides it unless asked with `{ includeCardOffers: true }`.

Opting in additionally requires a manual spend that consumes dice for a `generic` effect on a character actor (`providesCardOffer()`), because the result lands on that card as damage.

The consumer's `damageType` picks how. Blank (the default) means the bonus deals whatever the attack deals, so `foldBonusIntoPrimaryDamage` adds it to the primary `DamageRoll` as a flavored numeric term, and `getDiceDamageTotal` counts it as dice. A set type cannot fold, because a `DamageNode` carries exactly one type, so `appendTypedBonusDamage` adds a second damage node beside the one it derives from, with its own plain `Roll`. Consequences worth knowing:

- Flat reduction and the banked one-shot reduction resolve once for the attack (see [Damage reduction](#damage-reduction-flat-half-resistance-and-immunity)), and the card applies as a whole, so a typed packet costs the GM no extra click. Resistance resolves per packet, which is the reasonable reading: the glossary says only "take half as much damage" and never addresses a mixed-type attack. Monster heavy armor also still halves per packet, which the books do contradict ("half the sum of the dice", GM Guide), so dice 7 plus bonus 3 rounds up twice to 6 rather than 5. Untouched here because halving runs before the per-type immunity and resistance steps, and the books say nothing about how a single halved dice pool would then split by type.
- The bonus roll is stamped with the card's `isCritical`, because `calculateArmorAdjustedDamage` returns a crit's total unhalved but sends a non-crit through heavy-armor halving. Without the stamp the same feature would deal two different amounts against heavy armor purely because of its damage type.
- It stays a plain `Roll`, never a `DamageRoll`: both `resolveForceRerollReaction` and `foldBonusIntoPrimaryDamage` find their target by `class === 'DamageRoll'`.
- The packet is placed beside the damage it derives from, not always at the root, so `createBonusDamageNode` mirrors `createDamageNode`'s outcome scaffolding: a root node gets an `on.hit` child (without one `findNodesByContexts` never surfaces it, since it collects a bare root damage node only for disposition-targeted damage or on a miss), a node under `sharedRolls` gets both save outcomes, and a node hung directly under `on.failedSave` needs neither. Getting this wrong is how a spend on a saving-throw card would apply in full regardless of the save.
- `canCrit` / `canMiss` are set false to record that the amount already accounts for the outcome, but they are descriptive: only `ItemActivationManager` reads them, and only off the first damage node while building its `DamageRoll`.
- An interactive `forceReroll` resolved after the spend rewrites the card's outcome but leaves the packet's stamped `isCritical` alone, so against heavy armor it keeps ignoring armor on a card that no longer crits. Same unenforced ordering as the spend-versus-Apply-Damage case above.

The GM-side executor validates the type against `CONFIG.NIMBLE.damageTypes` and warns and aborts on anything else rather than falling back to the fold path, since an unvalidated string would flow into `matchesDamageType`, `actorIsImmuneToDamage`, `actorResistsDamage` and the rendered label. The empty sentinel is listed among the field's `choices` as well as being its `initial`, because the Rules Builder only renders a blank `<option>` for optional fields and an author who picked a type would otherwise have no way back.

`bonusOnAttackDelivery` narrows the offer to melee or ranged attacks, the same field and the same meaning it already carries for an `autoBonus` pool. The attack's delivery reaches the rule as an optional context threaded through `computeIncomingAttackPlan` into `collectPoolSpendCardOffers`; eligibility stays the rule's own call, and a filtered consumer asked without a context fails closed. An activation with no attack type has no delivery at all, so any filter excludes it.

The unarmed-strike handlers (`AttackActionPanel`, `OpportunityAttackPanel`, `activateHeroicActionMacro`) are a known gap in that symmetry. They post a card declaring `attackType: 'reach'`, so a card offer and the GM-side re-validation both read them as melee, but they build the synthetic item they hand `ItemActivationConfigDialog` without `activation.targets` and then read back only `rollMode` and the primary-die fields from the dialog's result. Auto-bonus pools, manual pool spends, charge spends, situational modifiers and conditional-bonus damage are all dropped there, filtered or not. Giving the synthetic item an attack type without first honouring `result.rollFormula` and consuming `result.consumedPoolDice` / `result.consumedChargePools` would make the dialog preview bonuses the posted roll does not contain, so the two have to move together.

The dice are picked on the spending player's client (`PoolSpendOfferDialog`), which reports the faces it displayed so the GM-side executor can reject a selection whose pool moved mid-dialog. Nothing enforces that the spend happens before the GM applies damage — the card keeps no applied-damage record — so a spend confirmed afterwards raises the total without adjusting HP already removed.

The GM-side executor re-derives its gates rather than trusting the stamped entry, since a crafted socket payload can replay an offer the client would have suppressed. Only `messageId`, `entryId` and the dice selection cross the socket; everything else is re-read. Three gates come from world rule data the attacker does not author (the `cardOffer` opt-in, the `generic` effect type, the `consume` outcome) and are therefore genuine checks. Two are read off the message (the outcome trigger from `isCritical` / `isMiss`, and the delivery from `activation.targets.attackType`), which the attacking client authored and can update as the message author, so those catch a stale card rather than a hostile one. `entry.actorUuid` is likewise attacker-authored and is not cross-checked against the card's own actor, so a patched client could stamp an entry naming another character the same user owns and spend that character's pool into this card. Every refusal reports back to the requesting player over the reaction socket rather than notifying the GM who happened to execute it.

The outcome gate is a correctness fix, not only hardening. `offerSurvives` filters pending offers against the outcome at card creation, and `applyPostRollIncomingBehavior` runs it after any *automatic* reroll has already fired, so those are covered. An *interactive* `forceReroll` resolved later on the card is not: `resolveForceRerollReaction` rewrites `isCritical` / `isMiss` afterwards, which can strand a `criticalHit` offer on a card that no longer crits. That resolver now re-runs `offerSurvives` over the card's remaining offers and drops the ones the new outcome fails, and the executor re-checks the trigger as a backstop.

Two consequences of that clean-up are worth knowing:

- It drops *every* kind of outcome-gated offer, not only spends. A second defender's unused `criticalHit`-gated `forceReroll` offer goes with them.
- It only ever drops. An offer that `applyPostRollIncomingBehavior` filtered out at card creation is discarded, not retained, so a reroll that turns a hit *into* a crit cannot bring a `criticalHit` offer back.

An already-spent entry is handled separately, because a reroll rebuilds the damage from `originalFormula`, which never contained a folded spend. `#carryFoldedSpendsAcrossReroll` re-applies the bonus when the new outcome still earns it, and otherwise refunds the dice and reverts the entry to unused so the stale-outcome filter takes it off the card. Only when the dice cannot be returned — the pool or its item is gone — does the bonus ride on unearned, which still beats charging the player for damage the card does not show. All of this runs one write at a time per card (`queueReactionWrite`), so two offers resolving together cannot overwrite each other's entry state.

## Damage reduction: flat, half (resistance), and immunity

`damageReduction` rules have a `mode`: `flat` (default) subtracts the resolved `value`; `half` halves the damage instead and ignores `value`. Monster actors additionally carry `attributes.damageResistances` and `attributes.damageImmunities` (damage-type keys, editable in the NPC meta config dialog); a matching resistance is equivalent to an untyped-scope `half` entry, and a matching immunity zeroes the hit outright.

A card is applied as a whole, through `resolveDamageForActor` (`src/documents/chatMessage.ts`), which splits the work by what each step is a property of.

Per damage packet, in `calculateDefenseAdjustedDamage`: outcome/armor halving → immunity (zero) → resistance halving (applies **once** per packet, no matter how many sources match — no quartering). These stay per packet because each is scoped to a damage type, and a target resistant to fire but not radiant must take the radiant in full.

Once per attack, over the packets together: flat rule reductions, then the banked one-shot reduction, then clamp at zero, then temp HP (inside `actor.applyDamage`). The rulebooks word every flat reduction as reducing an attack — Defend ("reduce damage from any single attack by your Armor"), Deflect, the Berserker's "That all you got?!" — and the minion-swarm rule calls out combining damage into "a single attack" as the thing that lets one Defend cover it. Both subtractions walk the packets in order, so an amount larger than the first packet carries into the next rather than being wasted on it. A *typed* flat reduction still only spends against packets of a type it is scoped to, so a fire ward never soaks the slashing half of a mixed attack, and a reduction is named in the Targets row only on the packets it actually spent against. The bank stays one-shot: spending any of it clears the effect and forfeits the rest.

Halving rounds up, matching the heavy-armor convention. The books do not settle halving-vs-subtraction ordering; halving first keeps flat reductions fully effective, and the one adjacent data point agrees with it (Fey Touched halves or doubles "before armor is applied", though that parenthetical is about armor rather than about rule reductions). `attributes.damageVulnerabilities` is stored and editable but **not yet automated** (the vulnerability rule interacts with armor and needs its own pass).

`getDamageBreakdownForTarget` (the Targets row preview) and `applyAllDamage` (the button) run the same resolver over the same packet set, so for a single target the previewed number is the number removed. One thing the preview does not model: `buildDamageApplicationPlan` gives an actor targeted through two tokens its bank only once, while each token's preview row shows it. `applyDamage(value, options)` survives for callers that own a single node's damage — the minion group attack card, and the per-packet control on save-gated damage — and is a one-packet call into the same path.

The system never hides Active Effects: every enabled AE on an actor renders on the token, on the canvas conditions panel, and in the sheet's effects lists, regardless of what created it. New rules that back their state with an AE get this visibility for free.

## Modifying incoming attacks (`modifyIncomingAttack`)

`modifyIncomingAttack` rules modify attacks made against an actor. The `modifier` field picks the effect:

| Modifier | Applies | Effect |
| --- | --- | --- |
| `disadvantage` | Automatic, pre-roll | One disadvantage level per matching rule, pushed into the attack roll's `rollModeSources` (cancels 1-for-1 with advantage) |
| `autoMiss` | Automatic, pre-roll | The attack roll is forced to a miss (`forceMiss` on `DamageRoll`), even against attacker-side "cannot miss" effects |
| `forceReroll` | Interactive or automatic | Discard the roll and roll once more; the second result stands. See the reroll options below |
| `redirectToSelf` | Interactive | An Interpose offer: when an ally within `range` spaces is targeted, the rule's owner may swap in as the target |

`disadvantage`, `forceReroll`, and `autoMiss` fire when the rule's owner is the attack's target; the predicate is tested against the owner's own domain at attack time (positional tags such as `alliesAdjacent` are fresh). `redirectToSelf` is protector-side: it fires when an ally within `range` spaces (default 2) is targeted, with the predicate tested against the protector's own domain.

These rules are not consulted during data preparation. The attacker's activation flow (`ItemActivationManager`, and the Zephyr unarmed strike path) reads the first target's rules through `computeIncomingAttackPlan` (`src/utils/incomingAttackModifiers.ts`) when the attack roll is built. Scope limits: only the first target is consulted (matching the `targetCondition` precedent), AoE attacks are exempt because their single shared roll must not absorb one target's defensive rules, and minion group attack cards are not covered.

### Interactive reactions

Interactive offers are stamped onto the attack card at creation (`incomingReactions` in `src/models/chat/common.ts`) and rendered as buttons visible to the acting actor's owner and the GM. Clicks route through a GM proxy socket (`src/utils/incomingAttackReactions.ts`, same pattern as `combatTurnActions.ts`); the primary active GM's client mutates the message. That routing is not optional for any kind: a chat message is updatable only by its author or a GM, and a single writer is what stops two concurrent reactions from clobbering the `incomingReactions` array.

Most kinds are defender-side reactions to the attack (`forceReroll`, `redirectToSelf`), sourced from the *target's* `modifyIncomingAttack` rules. `spendPoolForDamage` is attacker-side: it comes from the attacker's own `diceConsumer` rules (see [Card-side pool spends](#card-side-pool-spends)). A forced miss makes the defender's offers moot, so none are stamped alongside it; attacker-side offers are filtered against the resolved outcome, so an outcome-gated one drops out on a miss regardless.

Interpose offers come from two sources. Every living allied character within 2 spaces of the target gets the baseline heroic Interpose offer without needing any rule; using it spends the standard combined reaction through the combat tracker (with the usual already-spent confirmation). A `redirectToSelf` rule adds feature-granted offers that can bend the baseline rules (longer range, non-character protectors such as a Beastmaster companion); those do not auto-spend a reaction, since the granting feature governs the cost. When the same token qualifies both ways, the rule-granted offer wins.

Using an Interpose offer swaps the attack card's target for the protector and posts the standard Interpose reaction announcement. Damage, armor, and reductions then resolve against the new target when the GM applies damage. Token movement (the protector entering the ally's space) stays manual. A forced reroll rebuilds the damage roll from its serialized options on the GM client (dice animation happens there) and records the discarded roll on the damage node; rerolling after damage was already applied is not blocked, so apply damage last. Only the primary damage node (the first `DamageRoll` in the effect tree) is rerolled, and the card's hit/crit outcome mirrors that node — attacks that fan out into multiple independent damage rolls are outside this scope.

### Reroll options

`forceReroll` rules carry three extra fields:

- `automatic`: when true, the reroll fires at roll time with no button (for mandatory rerolls such as Mountain's Endurance rerolling an incoming crit). When false, an interactive button is offered instead.
- `rerollTrigger`: `always` (any attack), `hit` (only when the attack is not a miss), or `criticalHit` (only on a crit). This gates when an automatic reroll fires and, for interactive offers, whether the button is shown for the rolled outcome. Other kinds use the entry's shared `outcomeTrigger` field for the same gate; `rerollTrigger` is kept separate because it also drives automatic execution, not just visibility.
- `rerollWithDisadvantage`: when true, the reroll is made at disadvantage rather than a straight reroll (for example Pocket Sand, whose blinded attacker rerolls at disadvantage, or FAST). One disadvantage level is appended to the reroll's roll-mode sources.
