# FoundryVTT v13 API Quick Reference

Cheat-sheet for the FoundryVTT v13 APIs most commonly used in Nimble development.

---

## Global Singletons

| Global | Type | Purpose |
|---|---|---|
| `game` | `Game` | Main entry point — world, actors, items, combats, settings, i18n, user, socket |
| `canvas` | `Canvas` | Active scene canvas — tokens, layers, scene, mouse position |
| `ui` | `UI` | UI components — notifications, sidebar, chat, combat tracker |
| `CONFIG` | `CONFIG` | System configuration registry — document classes, data models, dice, canvas layers |
| `Hooks` | `Hooks` | Event bus — `on`, `once`, `off`, `call`, `callAll` |

---

## Document CRUD

### Top-Level Documents

```javascript
// Create
const actor = await Actor.create({ name: 'Hero', type: 'character' });

// Read (from world collections)
const actor = game.actors.get(id);
const actor = game.actors.getName('Hero');

// Update
await actor.update({ 'system.attributes.hp.value': 20 });
await actor.update({ name: 'New Name' });

// Delete
await actor.delete();
```

Same pattern for `Item`, `Scene`, `Combat`, `ChatMessage`, etc.

### Embedded Documents

```javascript
// Create embedded items on an actor
const [item] = await actor.createEmbeddedDocuments('Item', [
  { name: 'Flame Dart', type: 'spell', system: { ... } },
]);

// Update embedded items
await actor.updateEmbeddedDocuments('Item', [
  { _id: item.id, 'system.school': 'fire' },
  { _id: otherItem.id, 'system.tier': 1 },
]);

// Delete embedded items
await actor.deleteEmbeddedDocuments('Item', [item.id, otherItem.id]);

// Access embedded collection
const spells = actor.items.filter(i => i.type === 'spell');
const named = actor.items.getName('Flame Dart');
const byId = actor.items.get(itemId);
```

The same `createEmbeddedDocuments` / `updateEmbeddedDocuments` / `deleteEmbeddedDocuments` pattern applies to any embedded document type: `'Item'`, `'ActiveEffect'`, `'Combatant'`, `'MeasuredTemplate'`, etc.

---

## Hooks

```javascript
// Register a persistent listener — returns a numeric ID
const hookId = Hooks.on('updateActor', (actor, changes, options, userId) => {
  console.log('Actor updated:', actor.name);
});

// Register a one-time listener
Hooks.once('ready', () => {
  console.log('System ready');
});

// Unregister a listener
Hooks.off('updateActor', hookId);

// Call a hook (stops at false return)
Hooks.call('myCustomHook', arg1, arg2);

// Call all listeners regardless of return value
Hooks.callAll('myCustomHook', arg1, arg2);
```

### Common Hook Names

| Hook | When |
|---|---|
| `init` | System/module init (once per page load) |
| `setup` | Post-init, pre-ready |
| `ready` | World fully loaded and ready |
| `i18nInit` | After i18n strings are loaded |
| `canvasInit` | Canvas is initialized (each scene load) |
| `canvasReady` | Canvas is fully drawn |
| `updateActor` | Actor document updated |
| `createActor` | Actor document created |
| `deleteActor` | Actor document deleted |
| `updateItem` | Item document updated |
| `preCreateActiveEffect` | Before ActiveEffect is created (return `false` to cancel) |
| `createActiveEffect` | After ActiveEffect is created |
| `deleteActiveEffect` | After ActiveEffect is deleted |
| `renderChatMessageHTML` | After a chat message's HTML is rendered |
| `renderNimbleTokenHUD` | When the token HUD opens |
| `hotbarDrop` | Item dragged to the macro hotbar |
| `deleteCombat` | Combat is deleted |
| `updateCombat` | Combat is updated (round, turn, started changes) |

---

## DataModel and Fields

### Defining a Schema

```typescript
export class MyDataModel extends foundry.abstract.TypeDataModel {
  static override defineSchema() {
    const { fields } = foundry.data;
    return {
      name: new fields.StringField({ required: true, nullable: false, initial: '' }),
      value: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true }),
      enabled: new fields.BooleanField({ required: true, initial: false }),
      tags: new fields.ArrayField(
        new fields.StringField({ required: true, nullable: false }),
        { required: true, nullable: false, initial: () => [] },
      ),
      nested: new fields.SchemaField({
        sub: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
      }),
    };
  }

  // Runs during actor/item data preparation
  override prepareDerivedData(): void {
    // Compute derived values from raw data
    // this.value is the raw schema value
    // this.someComputed = this.value * 2; (add to TS interface separately)
  }
}
```

### Common Field Options

| Option | Type | Effect |
|---|---|---|
| `required` | `boolean` | Field must be present |
| `nullable` | `boolean` | Whether `null` is a valid value |
| `initial` | value or `() => value` | Default value; use factory for objects/arrays |
| `integer` | `boolean` | (NumberField) Coerce to integer |
| `min` / `max` | `number` | (NumberField) Clamp value |
| `choices` | `string[]` | (StringField) Restrict to enumerated values |

---

## CONFIG Object

Key CONFIG paths used in Nimble:

```typescript
// Document classes
CONFIG.Actor.documentClass = ActorProxy;
CONFIG.Item.documentClass = ItemProxy;
CONFIG.Combat.documentClass = NimbleCombat;
CONFIG.Combatant.documentClass = NimbleCombatant;
CONFIG.ChatMessage.documentClass = NimbleChatMessage;
CONFIG.Token.documentClass = NimbleTokenDocument;

// Data models (type string → class)
CONFIG.Actor.dataModels = { character: NimbleCharacterData, npc: NimbleNPCData, ... };
CONFIG.Item.dataModels = { spell: NimbleSpellData, boon: NimbleBoonData, ... };
CONFIG.ActiveEffect.dataModels = { condition: NimbleConditionData };
CONFIG.Combatant.dataModels = { character: ..., npc: ... };
CONFIG.ChatMessage.dataModels = { fieldRest: ..., safeRest: ..., ... };

// Canvas layers
CONFIG.Canvas.layers.templates.layerClass = NimbleTemplateLayer;
// CONFIG.Canvas.layers.<key> = { layerClass, group }

// Nimble system namespace (all system constants)
CONFIG.NIMBLE = NIMBLE;
// CONFIG.NIMBLE.conditions — condition ID → name
// CONFIG.NIMBLE.conditionDefaultImages — condition ID → image path
// CONFIG.NIMBLE.conditionStackableConditions — Set<string>
// CONFIG.NIMBLE.conditionTriggerRelationships — auto-trigger config
// CONFIG.NIMBLE.ruleDataModels — rule type → class
// CONFIG.NIMBLE.Actor.documentClasses — actor type → class

// Dice
CONFIG.Dice.rolls.push(MyCustomRoll);
CONFIG.Dice.types.push(MyDieTerm);

// Status effects (set during ready hook)
CONFIG.statusEffects = [...conditionManager values];
```

---

## Socket

`"socket": true` is set in `dist/system.json`, enabling system socket messages.

```javascript
// Send a message to all clients
game.socket.emit('system.nimble', { type: 'myEvent', data: { foo: 'bar' } });

// Listen for messages
game.socket.on('system.nimble', (payload) => {
  if (payload.type === 'myEvent') {
    console.log(payload.data);
  }
});
```

Only the GM can perform certain operations (e.g., updating unowned documents). A common pattern: non-GM clients emit a socket message, the GM client receives and performs the operation.

---

## Localization

```typescript
// Nimble wrapper (preferred — handles missing keys gracefully)
import localize from '#utils/localize.ts';

localize('NIMBLE.myKey');                           // game.i18n.localize
localize('NIMBLE.myKey', { name: 'Flame Dart' });  // game.i18n.format (for templates)

// Direct Foundry API
game.i18n.localize('NIMBLE.myKey');
game.i18n.format('NIMBLE.myKey', { name: 'Flame Dart' });
```

Strings are defined in `dist/lang/en.json`. Keys follow the pattern `NIMBLE.<Category>.<key>`.

---

## Settings

```javascript
// Register a setting (do this in the 'init' or 'setup' hook)
game.settings.register('nimble', 'mySettingKey', {
  name: 'My Setting',
  hint: 'Description of the setting.',
  scope: 'world',    // 'world' (GM-only) | 'client' (per user)
  config: true,      // show in settings UI
  type: Boolean,     // Boolean | Number | String
  default: false,
  onChange: (value) => { /* react to change */ },
});

// Read a setting
const value = game.settings.get('nimble', 'mySettingKey');

// Write a setting
await game.settings.set('nimble', 'mySettingKey', true);
```

System settings are registered in `src/settings/index.ts` and called from the `setup` hook.

---

## Notifications

```javascript
ui.notifications.info('Operation successful.');
ui.notifications.warn('Something may be wrong.');
ui.notifications.error('An error occurred.');

// Permanent notification (won't auto-dismiss)
ui.notifications.info('Permanent message', { permanent: true });
```

---

## Dialogs (ApplicationV2)

```javascript
// Simple yes/no confirmation
const confirmed = await foundry.applications.api.DialogV2.confirm({
  window: { title: 'Confirm Action' },
  content: '<p>Are you sure?</p>',
});
// confirmed: true | false | null (if closed)

// Prompt for a value
const result = await foundry.applications.api.DialogV2.prompt({
  window: { title: 'Enter Value' },
  content: '<label>Name: <input type="text" name="name" /></label>',
  ok: {
    label: 'Submit',
    callback: (event, button, dialog) => {
      return new FormDataExtended(button.form).object;
    },
  },
});
```

Nimble custom dialogs (e.g., `ItemActivationConfigDialog`, `SpellUpcastDialog`) live in `src/documents/dialogs/` and are Svelte-based `ApplicationV2` subclasses.

---

## Key v13 Changes vs v11/v12

| Area | v11/v12 | v13 |
|---|---|---|
| **Application base** | `Application` (Handlebars) | `ApplicationV2` (no Handlebars; use Svelte or plain HTML) |
| **Sheet registration** | `Actors.registerSheet(...)` | Same API, but `foundry.documents.collections.Actors.registerSheet(...)` |
| **Unregister sheet** | `Actors.unregisterSheet('core', ActorSheet)` | `foundry.documents.collections.Actors.unregisterSheet('core', foundry.appv1.sheets.ActorSheet)` |
| **Document namespace** | `game.actors`, `game.items` | Same, plus `foundry.documents.*` for class references |
| **DataModel** | `template.json` file | `system.json` `documentTypes` + TypeScript data model classes |
| **template.json** | Required for actor/item schemas | **Removed** — replaced entirely by data model classes |
| **Canvas layers** | `CONFIG.Canvas.layers` with `layerClass` | Same |
| **Dice** | `Roll` | Same + `CONFIG.Dice.rolls` for custom roll classes |
| **Combatant initiative** | Override `_getInitiativeFormula` on Actor | Override `getInitiativeRoll` on Combatant |
| **TextEditor** | `TextEditor.enrichHTML` | `foundry.applications.ux.TextEditor.implementation.enrichHTML` |
| **appv1 sheets** | Core sheet classes at top level | `foundry.appv1.sheets.ActorSheet`, `foundry.appv1.sheets.ItemSheet` |
