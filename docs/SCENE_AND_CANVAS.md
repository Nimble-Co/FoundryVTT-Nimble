# Scene and Canvas

Reference for token control, combat/initiative, canvas layers, measured templates, and the token HUD.

---

## Token Control via Macros

```javascript
// Get all currently selected tokens on the canvas
const tokens = canvas.tokens.controlled;
const token = tokens[0];

// Get the token's linked actor
const actor = token.actor;

// Get token document (for updates)
const tokenDoc = token.document;

// Move token to new position
await tokenDoc.update({ x: 100, y: 200 });

// Update actor HP via token
await token.actor.update({ 'system.attributes.hp.value': 20 });

// Target a token (your user targets it)
token.setTarget(true, { releaseOthers: false });
token.setTarget(false); // un-target

// Get all tokens in the current scene
canvas.tokens.placeables;

// Find a token by name
const found = canvas.tokens.placeables.find(t => t.name === 'Bandit');
```

---

## Combat and Initiative

### Accessing Combat

```javascript
// Current active combat (null if none)
const combat = game.combat;

// All combats in the world
game.combats.contents;

// Current combatant (whose turn it is)
const current = combat?.combatant;

// All combatants
const combatants = combat?.combatants.contents;
```

### Document Classes

| Class | File | Notes |
|---|---|---|
| `NimbleCombat` | `src/documents/combat/combat.svelte.ts` | Extends `Combat`; handles minion group attacks, combat mana |
| `NimbleCombatant` | `src/documents/combatant/combatant.svelte.ts` | Extends `Combatant`; non-character combatants auto-get `initiative: 0` |

Both use Svelte's `createSubscriber` for reactivity — access `.reactive` to trigger a reactive read.

### Initiative

`NimbleCombatant.getInitiativeRoll()` is overridden to call `actor._getInitiativeFormula(rollOptions)` if it exists, otherwise defaults to `'0'`.

```javascript
// Roll initiative for a combatant
await combatant.rollInitiative();

// Roll initiative for all combatants in the current combat
await combat.rollAll();
await combat.rollNPC();
```

### Adding Combatants

```javascript
// Add a token's actor to the current combat
await combat.createEmbeddedDocuments('Combatant', [
  {
    tokenId: token.id,
    actorId: token.actor.id,
    sceneId: canvas.scene.id,
  },
]);
```

### Combat Hooks Used by Nimble

| Hook | File | Purpose |
|---|---|---|
| `combatantDefeatSync` | `src/hooks/combatantDefeatSync.ts` | Watches actor HP/wounds updates; marks combatant as defeated when conditions are met |
| `combatStateGuards` | `src/hooks/combatStateGuards.ts` | Prevents illegal combat state transitions |
| `deleteCombat` | `src/nimble.ts` | Clears combat mana grants; refreshes token turn markers |
| `updateCombat` | `src/nimble.ts` | Clears combat mana when combat ends without deletion |

---

## Custom Canvas Layers

### Existing Customization: `NimbleTemplateLayer`

**File**: `src/canvas/layers/templateLayer.ts`

```typescript
class NimbleTemplateLayer extends foundry.canvas.layers.TemplateLayer {
  async createPreview(data: Record<string, unknown>): Promise<MeasuredTemplate> {
    // Creates a template preview at mouse position with custom listeners
    // Supports grid snapping (shift key bypasses snapping)
    // Supports auto pan when dragging near canvas edges
  }
}
```

**Registration** (in `src/hooks/init.ts`):

```typescript
CONFIG.Canvas.layers.templates.layerClass = NimbleTemplateLayer;
```

### Adding a New Canvas Layer

1. Create `src/canvas/layers/myLayer.ts`:

```typescript
export class NimbleMyLayer extends foundry.canvas.layers.CanvasLayer {
  static override get layerOptions() {
    return foundry.utils.mergeObject(super.layerOptions, {
      name: 'myLayer',
      zIndex: 400,
    });
  }

  override async _draw(options: object): Promise<void> {
    await super._draw(options);
    // Initialize PIXI objects here
  }

  override async _tearDown(options: object): Promise<void> {
    // Clean up
    await super._tearDown(options);
  }
}
```

2. Register in `src/hooks/init.ts`:

```typescript
import { NimbleMyLayer } from '../canvas/layers/myLayer.js';

// Use an existing key to override a core layer, or a new key for an additional layer
CONFIG.Canvas.layers.myLayer = {
  layerClass: NimbleMyLayer,
  group: 'interface', // 'primary' | 'effects' | 'interface'
};
```

3. Access in code:

```javascript
const myLayer = canvas.myLayer; // TS: (canvas as any).myLayer
```

---

## Measured Templates

### Creating a Template

```javascript
// Basic template creation on the current scene
const [template] = await canvas.scene.createEmbeddedDocuments('MeasuredTemplate', [
  {
    t: 'circle',    // 'circle' | 'cone' | 'ray' | 'rect'
    x: 500,
    y: 500,
    distance: 3,    // radius/length in grid units
    width: 1,       // width (for 'ray' and 'rect')
    angle: 53.13,   // angle (for 'cone')
    fillColor: '#ff0000',
    fillAlpha: 0.25,
    borderColor: '#ff0000',
  },
]);
```

### Using NimbleTemplateLayer for Interactive Placement

```javascript
// Create an interactive preview that follows the mouse
const preview = await canvas.templates.createPreview({
  t: 'circle',
  distance: 3,
  fillColor: '#ff0000',
});
// User clicks to place; the preview resolves to the placed template
```

`NimbleTemplateLayer.createPreview()` handles:
- Mouse tracking and position updates
- Grid snapping (Shift key bypasses snapping)
- Canvas edge auto-panning
- Click to confirm, right-click/Escape to cancel

### Querying Templates

```javascript
// All templates on current scene
canvas.templates.placeables;

// Templates overlapping a point
canvas.templates.placeables.filter(t => t.object?.shape?.contains(x, y));
```

---

## Token HUD Customization

**File**: `src/hooks/renderNimbleTokenHUD.ts`

The `renderNimbleTokenHUD` hook fires when the token HUD opens. Nimble replaces the palette/status-effects section entirely with a Svelte component:

```typescript
export default function renderNimbleTokenHUD(HUD, html, token) {
  const target = html.querySelector('.palette, .status-effects');
  if (!target) return;

  target.innerHTML = '';
  HUD._svelteComponent = mount(NimbleTokenHUD, {
    target,
    props: { HUD, token },
  });
}
```

**Svelte component**: `src/view/pixi/NimbleTokenHUD.svelte`

To add buttons or controls to the token HUD, edit the `NimbleTokenHUD` Svelte component. The `HUD` prop is the `TokenHUD` application instance; `token` is the token's data object.

### Minion Group Token Buttons

Additional token HUD actions for minion groups are registered in `src/hooks/minionGroupTokenActions.ts` (via a separate hook, not part of `renderNimbleTokenHUD`).

---

## Canvas Initialization

**File**: `src/hooks/canvasInit.ts`

Registered on the repeating `canvasInit` hook (fires each time a scene is loaded). Use this for per-scene canvas setup that cannot live in `init`.

```typescript
// src/hooks/canvasInit.ts
export default function canvasInit() {
  // Runs every time the canvas loads a new scene
}
```

To add per-scene setup, import and call from this file, or add a new `Hooks.on('canvasInit', ...)` registration in `src/nimble.ts`.
