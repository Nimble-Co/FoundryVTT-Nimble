# Code Style Guide

This guide documents the coding conventions and patterns for the Nimble FoundryVTT system. It adapts Svelte best practices for the unique requirements of a FoundryVTT system module.

## Table of Contents

- [Directory Structure](#directory-structure)
- [File Naming Conventions](#file-naming-conventions)
- [Svelte Components](#svelte-components)
- [TypeScript Patterns](#typescript-patterns)
- [State Management](#state-management)
- [Imports and Exports](#imports-and-exports)
- [Styling](#styling)
- [Testing](#testing)
- [FoundryVTT Integration](#foundryvtt-integration)

---

## Directory Structure

### Overview

Our structure adapts Svelte conventions for FoundryVTT's module architecture. Unlike SvelteKit applications that use file-based routing, we organize by **feature and document type**.

```
src/
├── nimble.ts              # Main entry point
├── config.ts              # System configuration constants
├── game.ts                # Game instance setup
│
├── actions/               # User-triggered action handlers
├── canvas/                # Canvas rendering and layers
├── dice/                  # Custom dice implementations
│   └── terms/             # Dice term classes
├── documents/             # FoundryVTT document classes
│   ├── actor/             # Actor implementations
│   ├── item/              # Item implementations
│   ├── dialogs/           # Document-specific dialogs
│   └── sheets/            # Sheet class definitions
├── enrichers/             # Text enricher implementations
├── hooks/                 # FoundryVTT lifecycle hooks
├── managers/              # Game logic managers
├── migration/             # Data migration scripts
├── models/                # Data model definitions
│   ├── actor/             # Actor data models
│   ├── item/              # Item data models
│   ├── fields/            # Custom field types
│   ├── chat/              # Chat message models
│   └── combatant/         # Combat models
├── pixi/                  # PIXI.js integrations
├── settings/              # Game settings registration
├── stores/                # Svelte stores
├── utils/                 # Utility functions
│   └── [feature]/         # Feature-specific utilities
│
├── view/                  # Svelte UI components
│   ├── components/        # Shared, reusable components
│   ├── sheets/            # Character/item sheet components
│   │   ├── components/    # Sheet-specific sub-components
│   │   └── pages/         # Tab page components
│   ├── dialogs/           # Dialog components
│   │   └── components/    # Dialog-specific sub-components
│   ├── chat/              # Chat message components
│   │   └── components/    # Chat-specific sub-components
│   ├── ui/                # UI overlay components
│   │   └── components/    # UI-specific sub-components
│   ├── handlers/          # Event handlers for views
│   └── dataPreparationHelpers/  # View data transformation
│
└── scss/                  # Stylesheets
    ├── base/              # Reset, variables, mixins
    ├── components/        # Component-specific styles
    ├── utils/             # SCSS utilities
    └── vendor/            # Third-party style overrides
```

### Key Principles

1. **Co-location**: Keep related code close together. Sheet components and their sub-components live in the same directory tree.

2. **Feature-based organization**: Group by what the code does (sheets, dialogs, chat) rather than by file type.

3. **Shared code in `components/`**: Only truly reusable components belong in top-level `components/` directories. Feature-specific components stay with their feature.

4. **Flat within features**: Avoid deeply nested directories. Two levels is usually sufficient (e.g., `view/sheets/components/`).

### Where to Put New Code

| Code Type | Location |
|-----------|----------|
| New Svelte component used by one sheet | `src/view/sheets/components/` |
| New Svelte component used across multiple features | `src/view/components/` |
| New dialog | `src/view/dialogs/` |
| Dialog sub-component | `src/view/dialogs/components/` |
| New actor/item type | `src/documents/actor/` or `src/documents/item/` |
| New data model | `src/models/actor/` or `src/models/item/` |
| Utility function | `src/utils/` or `src/utils/[feature]/` |
| Svelte store | `src/stores/` |
| FoundryVTT hook | `src/hooks/` |
| System configuration | `src/config.ts` |

---

## File Naming Conventions

### Summary Table

| Type | Convention | Example |
|------|------------|---------|
| Svelte components | PascalCase | `PlayerCharacterSheet.svelte` |
| TypeScript classes | PascalCase | `NimbleCharacter.ts` |
| TypeScript functions/utilities | camelCase | `localize.ts` |
| Data models | PascalCase with suffix | `CharacterDataModel.ts` |
| Directories | camelCase | `dataPreparationHelpers/` |
| Test files | `.test.ts` suffix | `isCombatantDead.test.ts` |
| SCSS files | kebab-case with `_` prefix for partials | `_variables.scss` |

### Svelte Component Naming

Use descriptive PascalCase names that indicate the component's purpose:

```
# Good
PlayerCharacterSheet.svelte    # Sheet for player characters
AbilityScores.svelte           # Displays ability scores
HitPointBar.svelte             # Visual HP representation
CharacterLevelUpDialog.svelte  # Dialog for leveling up

# Avoid
Sheet.svelte                   # Too generic
PC.svelte                      # Unclear abbreviation
ability.svelte                 # Should be PascalCase
```

### Naming Suffixes

Use consistent suffixes to indicate component type:

| Suffix | Usage | Example |
|--------|-------|---------|
| `Sheet` | Top-level sheet components | `PlayerCharacterSheet.svelte` |
| `Dialog` | Dialog components | `ActorCreationDialog.svelte` |
| `Tab` | Tab page components | `PlayerCharacterBioTab.svelte` |
| `Card` | Card-style display components | `SpellCard.svelte` |
| `List` | List display components | `InventoryList.svelte` |
| `Form` | Form components | `AttributeForm.svelte` |
| `Button` | Button components | `RollButton.svelte` |
| `Modal` | Modal overlays | `ConfirmationModal.svelte` |

---

## Svelte Components

### Component Structure

Order sections consistently within `.svelte` files:

```svelte
<script lang="ts">
  // 1. Type imports
  import type { NimbleCharacterData } from '#types/actor';

  // 2. Component imports
  import AbilityScores from './AbilityScores.svelte';

  // 3. Utility imports
  import localize from '#utils/localize.js';

  // 4. Store imports
  import { keyPressStore } from '#stores/keyPressStore.js';

  // 5. Context
  const actor = getContext('actor');

  // 6. Props definition
  interface Props {
    currentHP: number;
    maxHP: number;
    onUpdate?: (value: number) => void;
  }

  let { currentHP, maxHP, onUpdate }: Props = $props();

  // 7. Local state
  let isEditing = $state(false);

  // 8. Derived values
  const hpPercentage = $derived((currentHP / maxHP) * 100);

  // 9. Effects
  $effect(() => {
    // Side effects here
  });

  // 10. Functions
  function handleClick() {
    // ...
  }
</script>

<!-- Template -->
<div class="component-name">
  <!-- ... -->
</div>

<style lang="scss">
  /* Scoped styles */
</style>
```

### Props Definition

Use TypeScript interfaces for props with Svelte 5 runes:

```svelte
<script lang="ts">
  // Simple props
  interface Props {
    title: string;
    count: number;
    disabled?: boolean;  // Optional props
  }

  let { title, count, disabled = false }: Props = $props();
</script>
```

For complex optional patterns, use union types:

```svelte
<script lang="ts">
  interface BaseProps {
    value: number;
    onChange?: (value: number) => void;
  }

  interface Editable extends BaseProps {
    onChange: NonNullable<BaseProps['onChange']>;
  }

  interface ReadOnly extends BaseProps {
    readonly: true;
  }

  type Props = Editable | ReadOnly;

  let props: Props = $props();
</script>
```

### Context Usage

Use Svelte context for data that needs to flow through many component layers:

```svelte
<script lang="ts">
  import { getContext, setContext } from 'svelte';

  // Getting context (in child components)
  const actor = getContext<NimbleCharacter>('actor');
  const editingEnabled = getContext<boolean>('editingEnabled');

  // Setting context (in parent components)
  setContext('actor', actor);
  setContext('editingEnabled', true);
</script>
```

**When to use context vs props:**

| Use Context | Use Props |
|-------------|-----------|
| Data needed by many nested children | Direct parent-child communication |
| Global state (actor, sheet mode) | Component-specific configuration |
| Avoiding prop drilling | Values that change frequently |

### Event Handling

Use callback props for child-to-parent communication:

```svelte
<!-- Parent -->
<ChildComponent onSave={handleSave} onCancel={handleCancel} />

<!-- Child -->
<script lang="ts">
  interface Props {
    onSave: (data: FormData) => void;
    onCancel: () => void;
  }

  let { onSave, onCancel }: Props = $props();
</script>

<button onclick={() => onSave(formData)}>Save</button>
```

### Component Size Guidelines

- **Small components (< 100 lines)**: Keep in single file
- **Medium components (100-300 lines)**: Consider extracting sub-components
- **Large components (> 300 lines)**: Definitely split into sub-components

Signs a component should be split:
- Multiple unrelated concerns
- Repeated markup patterns
- Deeply nested template logic
- Multiple `$effect` blocks for different purposes

---

## TypeScript Patterns

### Type Imports

Always use `import type` for type-only imports (required by `verbatimModuleSyntax`):

```typescript
// Good
import type { NimbleCharacter } from '#documents/actor/NimbleCharacter.js';
import { someFunction } from '#utils/helpers.js';

// Bad - will cause errors
import { NimbleCharacter } from '#documents/actor/NimbleCharacter.js';
```

### Module Path Aliases

Use configured path aliases for cleaner imports:

```typescript
// Good - use aliases
import type { NimbleCharacterData } from '#types/actor';
import localize from '#utils/localize.js';
import { keyPressStore } from '#stores/keyPressStore.js';

// Avoid - relative paths for cross-directory imports
import type { NimbleCharacterData } from '../../../types/actor';
```

Available aliases:

| Alias | Path |
|-------|------|
| `#documents/*` | `./src/documents/*` |
| `#lib/*` | `./lib/*` |
| `#managers/*` | `./src/managers/*` |
| `#stores/*` | `./src/stores/*` |
| `#types/*` | `./types/*` |
| `#utils/*` | `./src/utils/*` |
| `#view/*` | `./src/view/*` |

### File Extensions in Imports

Always include `.js` extensions in ESM imports (TypeScript compiles `.ts` to `.js`):

```typescript
// Good
import { helper } from './helper.js';
import { NimbleCharacter } from '#documents/actor/NimbleCharacter.js';

// Bad - missing extension
import { helper } from './helper';
```

### Class Definitions

```typescript
export class NimbleCharacter extends NimbleBaseActor {
  // Static properties first
  static override LOCALIZATION_PREFIXES = ['NIMBLE.Actor'];

  // Override methods with `override` keyword
  override prepareDerivedData(): void {
    super.prepareDerivedData();
    // ...
  }

  // Instance methods
  getRollData(): NimbleCharacterRollData {
    // ...
  }
}
```

### Data Model Schemas

Use factory functions for reusable schema definitions:

```typescript
// In common.ts
export const abilities = () => ({
  str: new fields.SchemaField({
    value: new fields.NumberField({ initial: 10, integer: true }),
    mod: new fields.NumberField({ integer: true }),
  }),
  // ...
});

// In CharacterDataModel.ts
export class CharacterDataModel extends foundry.abstract.TypeDataModel {
  static override defineSchema() {
    return {
      ...abilities(),
      level: new fields.NumberField({ initial: 1, min: 1, max: 10 }),
    };
  }
}
```

### Utility Functions

Prefer pure functions with clear type signatures:

```typescript
// Good - pure function with explicit types
export function calculateModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

// Good - default export for single-function modules
export default function localize(
  stringId: string,
  data?: Record<string, string>
): string {
  return game.i18n.format(stringId, data);
}
```

### Handling Foundry Globals

Foundry globals (`game`, `CONFIG`, `ui`, etc.) are defined in ESLint and Biome configs. Access them directly:

```typescript
// Good - direct access
const setting = game.settings.get('nimble', 'someSetting');
const { abilityScores } = CONFIG.NIMBLE;

// In Svelte components, often via context or CONFIG
const actor = getContext<NimbleCharacter>('actor');
```

---

## State Management

### Hierarchy of State Solutions

Choose the simplest solution that meets your needs:

1. **Component state** (`$state`) - For UI state within a single component
2. **Props** - For parent-child communication
3. **Context** - For deeply nested component trees
4. **Stores** - For state shared across unrelated components
5. **Document data** - For persistent game data

### Svelte 5 Runes

Use Svelte 5 runes for reactive state:

```svelte
<script lang="ts">
  // Local state
  let count = $state(0);
  let items = $state<string[]>([]);

  // Derived values (computed from other state)
  const doubled = $derived(count * 2);
  const isEmpty = $derived(items.length === 0);

  // Effects (side effects when dependencies change)
  $effect(() => {
    console.log(`Count changed to ${count}`);
  });
</script>
```

### Svelte Stores

For cross-component state, use Svelte's `writable` stores:

```typescript
// stores/keyPressStore.ts
import { writable } from 'svelte/store';

export interface KeyPressState {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
}

const initialState: KeyPressState = {
  ctrl: false,
  shift: false,
  alt: false,
};

export const keyPressStore = writable<KeyPressState>(initialState);
```

Usage in components:

```svelte
<script lang="ts">
  import { keyPressStore } from '#stores/keyPressStore.js';

  // Subscribe to store
  const isCtrlPressed = $derived($keyPressStore.ctrl);
</script>
```

### Document Mutations

For persistent data, mutate FoundryVTT documents directly:

```svelte
<script lang="ts">
  const actor = getContext<NimbleCharacter>('actor');

  async function updateHP(newValue: number) {
    await actor.update({ 'system.hp.value': newValue });
  }
</script>
```

---

## Imports and Exports

### Named vs Default Exports

**Named exports** (preferred for most cases):

```typescript
// utils/math.ts
export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}

// Usage
import { add, multiply } from '#utils/math.js';
```

**Default exports** (for single-purpose modules):

```typescript
// utils/localize.ts
export default function localize(
  stringId: string,
  data?: Record<string, string>
): string {
  return game.i18n.format(stringId, data);
}

// Usage
import localize from '#utils/localize.js';
```

### Import Order

Organize imports in this order, with blank lines between groups:

```typescript
// 1. Type imports
import type { NimbleCharacter } from '#documents/actor/NimbleCharacter.js';
import type { SpellData } from '#types/item';

// 2. External library imports
import { writable } from 'svelte/store';

// 3. Internal absolute imports (using aliases)
import { keyPressStore } from '#stores/keyPressStore.js';
import localize from '#utils/localize.js';

// 4. Relative imports
import { helper } from './helper.js';
import ChildComponent from './ChildComponent.svelte';
```

### Re-exports

Use index files sparingly. Prefer direct imports to avoid circular dependencies:

```typescript
// Prefer direct imports
import { NimbleCharacter } from '#documents/actor/NimbleCharacter.js';

// Avoid barrel exports that can cause circular dependencies
import { NimbleCharacter } from '#documents/actor/index.js';
```

---

## Styling

### SCSS Organization

```
scss/
├── base/
│   ├── _reset.scss       # CSS reset/normalize
│   ├── _variables.scss   # Design tokens
│   └── _typography.scss  # Font definitions
├── components/
│   ├── _buttons.scss     # Button styles
│   └── _forms.scss       # Form element styles
├── utils/
│   ├── _mixins.scss      # SCSS mixins
│   └── _functions.scss   # SCSS functions
├── vendor/
│   └── foundry/          # Foundry-specific overrides
└── nimble.scss           # Main entry point
```

### Scoped vs Global Styles

**Scoped styles** (in components) - default and preferred:

```svelte
<style lang="scss">
  .hit-point-bar {
    display: flex;
    gap: 0.5rem;
  }
</style>
```

**Global styles** - only in `scss/` directory:

```scss
// scss/components/_buttons.scss
.nimble-button {
  // Global button styles
}
```

### CSS Class Naming

Use descriptive, kebab-case class names:

```svelte
<!-- Good -->
<div class="ability-score-container">
  <span class="ability-score-value">{score}</span>
  <span class="ability-score-modifier">{modifier}</span>
</div>

<!-- Avoid -->
<div class="asc">
  <span class="val">{score}</span>
</div>
```

### CSS Custom Properties

Use CSS custom properties for theming:

```scss
// Define in variables
:root {
  --nimble-primary-color: #4a90d9;
  --nimble-spacing-sm: 0.25rem;
  --nimble-spacing-md: 0.5rem;
}

// Use in components
.component {
  color: var(--nimble-primary-color);
  padding: var(--nimble-spacing-md);
}
```

---

## Testing

### Test File Location

Place tests alongside the code they test with `.test.ts` suffix:

```
src/utils/
├── isCombatantDead.ts
└── isCombatantDead.test.ts
```

Or in the `tests/` directory for integration tests:

```
tests/
├── fixtures/          # Test data
├── mocks/             # Mock implementations
└── integration/       # Integration tests
```

### Test Structure

Use Vitest with descriptive test names:

```typescript
import { describe, expect, it } from 'vitest';
import { isCombatantDead } from './isCombatantDead.js';
import { createCombatantFixture } from '../../tests/fixtures/combatant.js';

describe('isCombatantDead', () => {
  it('returns true when wounds equal max wounds', () => {
    const combatant = createCombatantFixture({
      wounds: { value: 3, max: 3 },
    });

    expect(isCombatantDead(combatant)).toBe(true);
  });

  it('returns false when wounds are below max', () => {
    const combatant = createCombatantFixture({
      wounds: { value: 1, max: 3 },
    });

    expect(isCombatantDead(combatant)).toBe(false);
  });
});
```

### What to Test

- **Utility functions**: Pure logic with clear inputs/outputs
- **Data transformations**: Model preparation, data parsing
- **Edge cases**: Boundary conditions, null handling
- **Business logic**: Game rules, calculations

### What Not to Unit Test

- Svelte component rendering (use manual testing in FoundryVTT)
- FoundryVTT API calls (mock at integration level)
- Simple getters/setters

---

## FoundryVTT Integration

### Document Classes

Extend Foundry's base classes with proper typing:

```typescript
export class NimbleCharacter extends NimbleBaseActor {
  // Use override for inherited methods
  override prepareDerivedData(): void {
    super.prepareDerivedData();
    this._prepareCharacterData();
  }

  // Private methods with underscore prefix
  private _prepareCharacterData(): void {
    // ...
  }

  // Public API methods
  async applyDamage(amount: number): Promise<void> {
    // ...
  }
}
```

### Hooks

Register hooks in dedicated files under `src/hooks/`:

```typescript
// hooks/init.ts
export function registerInitHooks(): void {
  Hooks.once('init', () => {
    // Initialization logic
  });
}

// hooks/ready.ts
export function registerReadyHooks(): void {
  Hooks.once('ready', () => {
    // Ready logic
  });
}
```

### Sheet Registration

Define sheet classes that bridge Foundry and Svelte:

```typescript
// documents/sheets/PlayerCharacterSheetV2.ts
export class PlayerCharacterSheetV2 extends SvelteApplicationMixin(
  foundry.applications.api.DocumentSheetV2
) {
  static override DEFAULT_OPTIONS = {
    classes: ['nimble', 'sheet', 'actor', 'character'],
    position: { width: 750, height: 700 },
    window: { resizable: true },
  };

  override _getSvelteComponent() {
    return PlayerCharacterSheet;
  }
}
```

### Localization

Always use localization for user-facing strings:

```typescript
import localize from '#utils/localize.js';

// Simple string
const label = localize('NIMBLE.AbilityStr');

// With interpolation
const message = localize('NIMBLE.DamageRoll', { amount: '10' });
```

In Svelte templates:

```svelte
<script lang="ts">
  import localize from '#utils/localize.js';
</script>

<label>{localize('NIMBLE.HitPoints')}</label>
```

### Configuration

Define system constants in `src/config.ts`:

```typescript
export const NIMBLE = {
  abilityScores: {
    str: 'NIMBLE.AbilityStr',
    dex: 'NIMBLE.AbilityDex',
    // ...
  },
  damageTypes: {
    slashing: 'NIMBLE.DamageSlashing',
    // ...
  },
};
```

---

## Code Quality Checklist

Before committing, ensure:

- [ ] `npm run check` passes (format, lint, type-check, tests)
- [ ] No circular dependencies introduced
- [ ] New code follows existing patterns
- [ ] Svelte components use TypeScript (`lang="ts"`)
- [ ] Props have proper TypeScript interfaces
- [ ] File names follow conventions
- [ ] Imports use path aliases where appropriate
- [ ] No hardcoded user-facing strings (use localization)
- [ ] Tests added for new utility functions

---

## Quick Reference

### Component Template

```svelte
<script lang="ts">
  import type { SomeType } from '#types/something';
  import ChildComponent from './ChildComponent.svelte';
  import { getContext } from 'svelte';
  import localize from '#utils/localize.js';

  interface Props {
    value: number;
    onChange?: (value: number) => void;
  }

  let { value, onChange }: Props = $props();

  const actor = getContext<NimbleCharacter>('actor');

  let localState = $state(false);
  const derived = $derived(value * 2);

  function handleClick() {
    onChange?.(derived);
  }
</script>

<div class="my-component">
  <ChildComponent {value} />
  <button onclick={handleClick}>
    {localize('NIMBLE.Action')}
  </button>
</div>

<style lang="scss">
  .my-component {
    display: flex;
    gap: var(--nimble-spacing-md);
  }
</style>
```

### Utility Function Template

```typescript
/**
 * Brief description of what this function does.
 */
export function myUtility(input: InputType): OutputType {
  // Implementation
}
```

### Store Template

```typescript
import { writable } from 'svelte/store';

export interface MyStoreState {
  // State shape
}

const initialState: MyStoreState = {
  // Initial values
};

export const myStore = writable<MyStoreState>(initialState);
```
