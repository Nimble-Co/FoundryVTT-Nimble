# Character System

Reference for actor types, data models, Svelte sheets, and the rules engine.

---

## Actor Type Overview

| Type string | Data model | Document class | Used for |
|---|---|---|---|
| `character` | `NimbleCharacterData` | `NimbleCharacter` | Player characters |
| `npc` | `NimbleNPCData` | `NimbleNPC` | Monsters, NPCs |
| `minion` | `NimbleMinionData` | `NimbleMinion` | Minion enemies |
| `soloMonster` | `NimbleSoloMonsterData` | `NimbleSoloMonster` | Boss/legendary monsters |

All four types share a base class `NimbleBaseActor` (`src/documents/actor/base.svelte.ts`).

### Proxy Pattern

`CONFIG.Actor.documentClass` is set to `ActorProxy` (`src/documents/actor/actorProxy.ts`). When Foundry constructs an actor, the proxy reads `args[0].type` and dispatches to the correct subclass via `CONFIG.NIMBLE.Actor.documentClasses[type]`.

```typescript
// src/documents/actor/actorProxy.ts
export default new Proxy(NimbleBaseActor, {
  construct(_target, args) {
    const ActorClass = CONFIG.NIMBLE.Actor.documentClasses[args[0].type] ?? NimbleBaseActor;
    return new ActorClass(...args);
  },
});
```

The `documentClasses` map is populated in `src/config.ts` under `NIMBLE.Actor.documentClasses`.

---

## Adding a Field to an Existing Actor Type

### 1. Locate the data model

| Actor type | Data model file |
|---|---|
| `character` | `src/models/actor/CharacterDataModel.ts` |
| `npc` | `src/models/actor/NPCDataModel.ts` |
| `minion` | `src/models/actor/MinionDataModel.ts` |
| `soloMonster` | `src/models/actor/SoloMonsterDataModel.ts` |

### 2. Add the field using `foundry.data.fields`

```typescript
const { fields } = foundry.data;

// Inside the schema function:
myNewField: new fields.StringField({
  required: true,
  nullable: false,
  initial: 'default',
}),

numberField: new fields.NumberField({
  required: true,
  nullable: false,
  initial: 0,
  integer: true,
  min: 0,
}),

boolField: new fields.BooleanField({
  required: true,
  initial: false,
}),

arrayField: new fields.ArrayField(
  new fields.StringField({ required: true, nullable: false }),
  { required: true, nullable: false, initial: () => [] },
),

schemaField: new fields.SchemaField({
  subField: new fields.NumberField({ required: true, initial: 0, nullable: false }),
}),
```

### Field types reference

| Class | Purpose |
|---|---|
| `fields.StringField` | String value |
| `fields.NumberField` | Number; add `integer: true`, `min:`, `max:` as needed |
| `fields.BooleanField` | Boolean |
| `fields.ArrayField(inner, opts)` | Array; `initial` must be a factory `() => []` |
| `fields.SchemaField(schema)` | Nested object with typed sub-fields |
| `fields.ObjectField` | Freeform object (untyped) |
| `RecordField` | Custom field in `src/models/fields/RecordField.ts` — typed record/map |

### 3. Migrations

FoundryVTT automatically migrates existing actor documents by applying the `initial` value for any missing field. For complex migrations (renaming, transforming data), add a migration class to `src/migration/` and register it in `MigrationList.ts`.

---

## Adding a New Actor Type (Full Workflow)

### Step 1: Register in `dist/system.json`

Add to `documentTypes.Actor`:

```json
"documentTypes": {
  "Actor": {
    "myNewType": {
      "htmlFields": [],
      "filePathFields": {}
    }
  }
}
```

### Step 2: Create the data model

`src/models/actor/MyNewTypeDataModel.ts`:

```typescript
const { fields } = foundry.data;

const myNewTypeSchema = () => ({
  attributes: new fields.SchemaField({
    hp: new fields.SchemaField({
      value: new fields.NumberField({ required: true, nullable: false, initial: 10, integer: true }),
      max:   new fields.NumberField({ required: true, nullable: false, initial: 10, integer: true }),
      temp:  new fields.NumberField({ required: true, nullable: false, initial: 0,  integer: true }),
    }),
  }),
  // ... more fields
});

export class NimbleMyNewTypeData extends foundry.abstract.TypeDataModel {
  static override defineSchema() {
    return myNewTypeSchema();
  }
}
```

### Step 3: Register the data model

`src/models/actor/actorDataModels.ts`:

```typescript
import { NimbleMyNewTypeData } from './MyNewTypeDataModel.js';

const actorDataModels = {
  character: NimbleCharacterData,
  npc: NimbleNPCData,
  minion: NimbleMinionData,
  soloMonster: NimbleSoloMonsterData,
  myNewType: NimbleMyNewTypeData,  // add here
};
```

Also add the type declaration in the `declare global` block:

```typescript
declare global {
  interface DataModelConfig {
    Actor: {
      myNewType: NimbleMyNewTypeData;
    };
  }
}
```

### Step 4: Create the document class

`src/documents/actor/myNewType.ts`:

```typescript
import { NimbleBaseActor } from './base.svelte.js';

export class NimbleMyNewType extends NimbleBaseActor<'myNewType'> {
  // Type-specific methods here
  isType<T extends SystemActorTypes>(type: T): this is NimbleBaseActor<T> & { type: T } {
    return this.type === type;
  }
}
```

### Step 5: Register in `src/config.ts`

In `NIMBLE.Actor.documentClasses`:

```typescript
Actor: {
  documentClasses: {
    character: NimbleCharacter,
    npc: NimbleNPC,
    minion: NimbleMinion,
    soloMonster: NimbleSoloMonster,
    myNewType: NimbleMyNewType, // add here
  },
},
```

### Step 6: Create the sheet class

`src/documents/sheets/MyNewTypeSheet.svelte.ts`:

```typescript
import { mount, unmount } from 'svelte';
import MyNewTypeSheetComponent from '../../view/sheets/MyNewTypeSheet.svelte';

export default class MyNewTypeSheet extends foundry.appv1.sheets.ActorSheet {
  // Follow the pattern of PlayerCharacterSheet.svelte.ts or NPCSheet.svelte.ts
}
```

In practice, copy the nearest existing sheet class and adapt it.

### Step 7: Create the Svelte component

`src/view/sheets/MyNewTypeSheet.svelte`:

```svelte
<script lang="ts">
  import type { MyNewTypeSheetProps } from '#types/components/MyNewTypeSheet.d.ts';

  const { actor, ...props }: MyNewTypeSheetProps = $props();
</script>

<div class="my-new-type-sheet">
  <!-- Sheet UI here -->
</div>
```

Define prop types in `types/components/MyNewTypeSheet.d.ts`.

### Step 8: Register the sheet in `src/hooks/init.ts`

```typescript
import MyNewTypeSheet from '../documents/sheets/MyNewTypeSheet.svelte.js';

foundry.documents.collections.Actors.registerSheet(
  'nimble',
  MyNewTypeSheet as unknown as ActorSheetConstructor,
  {
    types: ['myNewType'],
    makeDefault: true,
    label: 'NIMBLE.sheets.myNewType',
  },
);
```

---

## Modifying an Actor Sheet (Svelte)

### Sheet class (`src/documents/sheets/`)

- Extends a FoundryVTT `ApplicationV2` base (or `ActorSheet` for v1 sheets)
- Responsible for: window lifecycle, data preparation, passing the actor as context/props to the Svelte component
- Look at `PlayerCharacterSheet.svelte.ts` or `NPCSheet.svelte.ts` for the current pattern

### Svelte component (`src/view/sheets/`)

- Receives the actor via `$props()`
- Use Svelte 5 runes: `$state`, `$derived`, `$effect`, `$props()`
- Page-level subcomponents live in `src/view/sheets/pages/`
- Shared UI components live in `src/view/components/`

### Svelte 5 runes cheat-sheet

```svelte
<script lang="ts">
  // Props (replaces export let)
  const { actor, sheet } = $props();

  // Reactive state
  let count = $state(0);

  // Derived values (replaces $: derived)
  const hp = $derived(actor.system.attributes.hp);

  // Side effects (replaces onMount / $: statements with side effects)
  $effect(() => {
    console.log('actor changed:', actor.name);
  });
</script>
```

### Script section order (project convention)

1. Type imports
2. Component imports
3. Utility imports
4. Store imports
5. Context (`getContext`)
6. Props (`$props()`)
7. Local state (`$state`)
8. Derived values (`$derived`)
9. Effects (`$effect`)
10. Functions

---

## Rules Engine

### Rules array

Items (spells, features, boons, class features, etc.) have a `system.rules[]` array. Each element is a typed rule object processed by `RulesManager` when the item is embedded in an actor.

```json
{
  "system": {
    "rules": [
      {
        "id": "abc123",
        "type": "speedBonus",
        "value": 1
      }
    ]
  }
}
```

### Rule types (in `src/models/rules/`)

| Type key | File | Effect |
|---|---|---|
| `abilityBonus` | `abilityBonus.ts` | Bonus to an ability modifier |
| `armorClass` | `armorClass.ts` | Modify armor class calculation |
| `combatMana` | `combatMana.ts` | Grant mana at combat start |
| `grantItem` | `grantItem.ts` | Grant an item to the actor |
| `grantProficiencies` | `grantProficiencies.ts` | Grant skill/tool proficiencies |
| `healingPotionBonus` | `healingPotionBonus.ts` | Bonus to healing potion healing |
| `hitDiceAdvantage` | `hitDiceAdvantage.ts` | Advantage on hit dice rolls |
| `incrementHitDice` | `incrementHitDice.ts` | Increase hit die size by steps |
| `initiativeBonus` | `initiativeBonus.ts` | Bonus to initiative |
| `initiativeRollMode` | `initiativeRollMode.ts` | Set initiative roll mode (adv/dis) |
| `maxHitDice` | `maxHitDice.ts` | Bonus to max hit dice count |
| `maxHpBonus` | `maxHpBonus.ts` | Flat bonus to max HP |
| `maxWounds` | `maxWounds.ts` | Modify max wound count |
| `maximizeHitDice` | `maximizeHitDice.ts` | Always maximize hit dice rolls |
| `note` | `note.ts` | Display a note on the actor sheet |
| `savingThrowBonus` | `savingThrowBonus.ts` | Bonus to a saving throw |
| `savingThrowRollMode` | `savingThrowRollMode.ts` | Set saving throw roll mode |
| `skillBonus` | `skillBonus.ts` | Bonus to a skill check |
| `speedBonus` | `speedBonus.ts` | Bonus to movement speed |

### Adding a New Rule Type

1. Create `src/models/rules/myRule.ts` extending `NimbleBaseRule` (`src/models/rules/base.ts`):

```typescript
import { NimbleBaseRule } from './base.js';

export class MyRule extends NimbleBaseRule {
  static override defineSchema() {
    const { fields } = foundry.data;
    return {
      ...super.defineSchema(),
      value: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
    };
  }

  // Called during actor data preparation
  apply(actor: NimbleBaseActor): void {
    // Modify actor data
  }
}
```

2. Register in `CONFIG.NIMBLE.ruleDataModels` in `src/config.ts`:

```typescript
ruleDataModels: {
  myRule: MyRule,
  // ...existing rules
},
```

3. Handle the rule in the relevant `prepareDerivedData()` or `prepareActorData()` flow if it needs to run at preparation time, or in `RulesManager` if it runs on demand.
