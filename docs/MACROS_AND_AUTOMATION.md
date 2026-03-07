# Macros and Automation

Reference for hooks, manager APIs, and writing automation in FoundryVTT-Nimble.

---

## Hooks Overview

All hooks are registered in `src/nimble.ts`. Each hook file lives in `src/hooks/`.

### Lifecycle Hooks (fired once)

| Hook event | File | What it does |
|---|---|---|
| `init` | `src/hooks/init.ts` | Registers document classes (`ActorProxy`, `NimbleCombat`, `NimbleCombatant`, `NimbleChatMessage`, `ItemProxy`, `NimbleTokenDocument`), data models, sheets, custom dice, canvas layer overrides, `CONFIG.NIMBLE` setup |
| `setup` | `src/hooks/setup.ts` | Registers keybindings, system settings, pack indexes, compendium spells filter, initializes `ConditionManager` (`game.nimble.conditions.initialize()`), makes core dialogs resizable |
| `ready` | `src/hooks/ready.ts` | Runs migrations, calls `conditions.configureStatusEffects()`, mounts `CombatTracker` and `CanvasConditionsPanel` Svelte components, registers `combatStateGuards`, registers `minionGroupTokenActions` |
| `i18nInit` | `src/hooks/i18nInit.ts` | Internationalization setup |

### Repeating Hooks

| Hook event | File | What it does |
|---|---|---|
| `canvasInit` | `src/hooks/canvasInit.ts` | Canvas initialization per scene load |
| `renderChatMessageHTML` | `src/hooks/renderChatMessage.ts` | Post-render logic for chat cards |
| `renderCompendium` | `src/hooks/renderCompendium.ts` | Compendium panel customization |
| `renderNimbleTokenHUD` | `src/hooks/renderNimbleTokenHUD.ts` | Mounts `NimbleTokenHUD` Svelte component, replacing the palette/status-effects section |
| `hotbarDrop` | `src/hooks/hotBarDrop.ts` | Intercepts item drops on the macro hotbar; calls `game.nimble.macros.createMacro(data, slot)` |
| `preCreateActiveEffect` | `src/hooks/automaticConditions.ts` | Before an ActiveEffect is created: checks for triggered automatic conditions |
| `createActiveEffect` | `src/hooks/automaticConditions.ts` | After an ActiveEffect is created: applies triggered automatic conditions |
| `preDeleteActiveEffect` | `src/hooks/automaticConditions.ts` | Before an ActiveEffect is deleted: checks which conditions should be removed |
| `deleteActiveEffect` | `src/hooks/automaticConditions.ts` | After an ActiveEffect is deleted: removes conditions that depended on the deleted one |
| `deleteCombat` | `src/nimble.ts` | Clears combat mana grants; refreshes all token turn markers |
| `updateCombat` | `src/nimble.ts` | Clears combat mana when combat ends without deletion |

### Registered via Helper Functions (not `Hooks.on` directly)

| Function | File | Hook events registered |
|---|---|---|
| `registerCombatantDefeatSync()` | `src/hooks/combatantDefeatSync.ts` | Syncs actor HP/wound state → combatant defeat flag |
| `registerMinionGroupTokenBadges()` | `src/hooks/minionGroupTokenBadges.ts` | Token badge display for minion groups |
| `registerMinionGroupTokenActions()` | `src/hooks/minionGroupTokenActions.ts` | Token HUD actions for minion group management |
| `registerCompendiumSpellsFilter()` | `src/hooks/compendiumSpellsFilter.ts` | Filters the spell compendium by school/tier |

---

## Adding a New Hook

1. Create `src/hooks/myHook.ts` and export a default function (or named function):

```typescript
export default function myHook(arg1, arg2) {
  // your logic
}
```

2. Import and register in `src/nimble.ts`:

```typescript
import myHook from './hooks/myHook.js';

// Use Hooks.on for repeating, Hooks.once for lifecycle
Hooks.on('someHookEvent', myHook);
```

Always use `.js` extensions in ESM imports even though the source files are `.ts`.

---

## Manager APIs

All managers live in `src/managers/`. They are instantiated per use — they are not singletons on the actor (except `ConditionManager`, which lives on `game.nimble.conditions`).

---

### ConditionManager

**Location**: `src/managers/ConditionManager.ts`
**Singleton**: `game.nimble.conditions`

```typescript
// Called in setup hook — reads CONFIG.NIMBLE.conditions
game.nimble.conditions.initialize();

// Called in ready hook — populates CONFIG.statusEffects
game.nimble.conditions.configureStatusEffects();

// Look up a condition by ID
const condition = game.nimble.conditions.get('dazed');
// Returns: { id, name, img, stackable, enriched, aliases?, statuses?, _id? }

// Get active conditions on an actor
const { active, overlay } = game.nimble.conditions.getMetadata(actor);
// active: Set<string> of condition IDs
// overlay: Set<string> of condition IDs shown as overlay

// Get data for a tag group UI
const tagData = game.nimble.conditions.getTagGroupData();
// Returns: Array<{ label: string, value: string }>

// Check what conditions are auto-triggered by applying a set of conditions
const triggered = game.nimble.conditions.getTriggeredConditions(['slowed'], actor);

// Check what auto-conditions should be removed when conditions are removed
const toRemove = game.nimble.conditions.getConditionsToRemove(['slowed'], actor);
```

Condition data comes from `CONFIG.NIMBLE.conditions` (set in `src/config.ts`).

---

### RestManager

**Location**: `src/managers/RestManager.ts`
**Usage**: Instantiate per rest operation on a character actor.

```typescript
import { RestManager } from '#managers/RestManager.ts';

const manager = new RestManager(actor, {
  restType: 'field',      // 'field' | 'safe'
  makeCamp: false,        // boolean — maximizes hit dice rolls
  skipChatCard: false,    // boolean — suppress chat output
  selectedHitDice: {      // optional: { [dieSize]: quantity }
    8: 2,                 // spend 2d8
  },
  activeAdvantageRuleIds: [],  // optional: rule IDs granting advantage on hit dice
});

await manager.rest();
```

`RestManager.rest()` internally:
- On `'safe'` rest: restores all hit dice, HP, wounds (-1), and mana (if class allows)
- On `'field'` rest: restores mana (if class allows), then rolls the selected hit dice
- Posts a styled chat card unless `skipChatCard: true`
- Calls `actor.HitDiceManager.rollHitDice(...)` for each die size

---

### HitDiceManager

**Location**: `src/managers/HitDiceManager.ts`
**Usage**: Instantiate per use from a character actor.

```typescript
import { HitDiceManager } from '#managers/HitDiceManager.ts';

const hdm = new HitDiceManager(actor);

hdm.max        // number — total hit dice across all classes + bonuses
hdm.value      // number — currently available hit dice
hdm.smallest   // number — smallest die size the actor has
hdm.largest    // number — largest die size the actor has
hdm.dieSizes   // Set<number> — all die sizes this actor uses
hdm.bySize     // Record<string, { current: number; total: number }>

// Roll hit dice (applies healing to actor, posts chat message unless skipped)
const result = await hdm.rollHitDice(
  8,     // dieSize (default: largest)
  2,     // quantity
  false, // maximize (Make Camp)
  false, // advantage
  false, // skipChatMessage
);
// result: { roll: Roll, healing: number } | null

// Get update data for restoring hit dice (e.g., on safe rest)
const { updates, recoveredData } = hdm.getUpdateData({
  upperLimit: hdm.max,    // how many to recover (default: half max)
  restoreLargest: true,   // largest first vs smallest first
});
await actor.update(updates);
```

---

### ItemActivationManager

**Location**: `src/managers/ItemActivationManager.ts`
**Usage**: Instantiate to handle an item's use flow (targeting, template placement, roll resolution, effect application).

```typescript
import { ItemActivationManager } from '#managers/ItemActivationManager.ts';

const manager = new ItemActivationManager(item, {
  // options vary by item type — see ActivationOptions type
});

// The primary entry point is called via item.activate() which instantiates this internally.
// Direct usage is rare — prefer item.activate() from the actor or item document.
```

In practice, you trigger item activation via:

```typescript
// From an in-game macro or hook:
const item = actor.items.getName('Flame Dart');
await item.activate();
```

---

### ModifierManager

**Location**: `src/managers/ModifierManager.ts`
**Usage**: Get modifiers for a roll (ability check, saving throw, skill check).

```typescript
import { ModifierManager } from '#managers/ModifierManager.ts';

const manager = new ModifierManager(actor, {
  type: 'skillCheck',      // 'abilityCheck' | 'savingThrow' | 'skillCheck'
  skillKey: 'perception',  // required for skillCheck
  abilityKey: 'strength',  // required for abilityCheck
  saveKey: 'dexterity',    // required for savingThrow
  situationalMods: '',     // optional bonus formula string
  rollMode: 0,             // base roll mode
  minRoll: undefined,
  item: undefined,
});

const modifiers = manager.getModifiers();
// Returns: Array<{ label?: string, value: number | string }>
```

---

### RulesManager

**Location**: `src/managers/RulesManager.ts`
**Usage**: Processes the `system.rules[]` array on an item. Extends `Map<string, NimbleBaseRule>`.

```typescript
// Instantiated automatically when an item is prepared — accessible as item.rules
// Direct instantiation:
import { RulesManager } from '#managers/RulesManager.ts';

const rulesManager = new RulesManager(item);

// Iterate all rules
for (const [id, rule] of rulesManager) {
  rule.apply(actor); // each rule type has its own apply logic
}

// Get a specific rule type (first match)
const speedRule = rulesManager.rulesTypeMap.get('speedBonus');
```

Rule classes are registered in `CONFIG.NIMBLE.ruleDataModels`. Unknown rule types log a warning and are skipped.

---

### ClassResourceManager

**Location**: `src/managers/ClassResourceManager.ts`
**Usage**: Manages per-class resource pools defined in a class item's `system.resources` array. Extends `Map<string, ResourceInstance>`.

```typescript
// Typically accessed via the class item:
const classItem = actor.items.find(i => i.type === 'class');
// ClassResourceManager is constructed when the class item prepares its data.

// In practice, interact with resources through the class item's sheet
// or by updating system.resources directly on the item document.
```

---

## Writing a New Manager

Pattern all managers follow:

```typescript
class MyManager {
  #actor: NimbleCharacterInterface; // or NimbleBaseActor

  constructor(actor: NimbleCharacterInterface) {
    this.#actor = actor;
    // read actor data and set up internal state
  }

  // Public API methods
  async doSomething(): Promise<void> {
    const updates = {};
    // ... build updates ...
    await this.#actor.update(updates);
  }
}

export { MyManager };
```

Conventions:
- Private fields use `#` prefix (ES private class fields, not TypeScript `private`)
- Constructor receives the actor (or item) as its first argument; options as second
- Async operations live in methods, not the constructor
- The manager does not register itself on the actor — callers instantiate it when needed

To make a manager available globally, export it from `src/managers/` and add it to `NIMBLE_GAME.managers` in `src/game.ts`.

---

## In-Game Script Macros

Access the Nimble API from the Foundry macro editor:

```javascript
// Global game object
game.nimble.conditions.get('dazed');
game.nimble.config;              // same as CONFIG.NIMBLE
game.nimble.managers.ConditionManager;
game.nimble.managers.ModifierManager;

// Get the selected token's actor
const token = canvas.tokens.controlled[0];
const actor = token?.actor;

// Roll an ability check
actor.rollAbility('strength');

// Activate an item
const item = actor.items.getName('Flame Dart');
await item?.activate();

// Use RestManager from a macro
const { RestManager } = game.nimble.managers;
// Note: RestManager is not exported on game.nimble.managers by default.
// Import patterns only work in system code, not macros.
// Use actor sheet UI for rests, or call actor methods if exposed.

// Apply a condition via active effects
await actor.toggleStatusEffect('dazed');
```
