---
title: Code Style Guide
---

# Code Style Guide

This guide documents the coding conventions and patterns for the Nimble FoundryVTT system. It adapts Svelte best practices for the unique requirements of the Nimble FoundryVTT system module.

## Table of Contents

- [Foundational Principles](#foundational-principles)
- [Directory Structure](#directory-structure)
- [File Naming Conventions](#file-naming-conventions)
- [Svelte Components](#svelte-components)
- [TypeScript Patterns](#typescript-patterns)
- [State Management](#state-management)
- [Imports and Exports](#imports-and-exports)
- [Styling](#styling)
- [Testing](#testing)
- [FoundryVTT Integration](#foundryvtt-integration)
- [Shared Code Inventory](#shared-code-inventory)

---

## Foundational Principles

### 1. Write Self-Documenting Code

Code should be self-explanatory through clear organization and naming. Well-named code reduces the need for comments and makes the codebase easier to navigate.

#### Naming Conventions

| Element | Convention | Examples |
|---------|------------|----------|
| **Variables** | Descriptive names that convey purpose | `isCharacterDead`, `totalDamageDealt`, `formattedModifier` |
| **Functions** | Verbs that describe the action | `calculateModifier`, `applyDamage`, `formatRollResult` |
| **Components** | Nouns that describe what they represent | `PlayerCharacterSheet`, `AbilityScores`, `SpellSlotTracker` |
| **Constants** | SCREAMING_SNAKE_CASE for true constants | `MAX_ABILITY_SCORE`, `DEFAULT_HIT_DIE`, `SKILL_PROFICIENCY_MULTIPLIER` |

**Avoid abbreviated or unclear names:**

```typescript
// Bad
const d = new Date();
const fn = (a) => a.s + a.m;
const x = items.filter((i) => i.a && !i.d);

// Good
const currentDate = new Date();
const calculateTotalBonus = (ability) => ability.score + ability.modifier;
const activeItems = items.filter((item) => item.isActive && !item.isDeleted);
```

#### Code Organization Principles

Code should be:

- **Well-organized**, Group related logic together, separate concerns appropriately
- **Easy to reason about**, A developer should understand the flow without extensive documentation
- **Easy to understand**, Prefer clarity over cleverness; straightforward code is better than clever one-liners
- **Clear for humans to follow**, Structure code so the intent is obvious at a glance

---

### 2. Don't Repeat Yourself

Look for existing utilities, stores, and components before building new ones. If you find yourself copying logic from one component into another, extract it into a shared abstraction.

See the [Shared Code Inventory](#shared-code-inventory) section for utilities, stores, and components that already exist.

#### When to Extract

Use these trigger rules to decide when to extract code:

| Situation | Action |
|-----------|--------|
| Type used by 2+ files | Extract to a `types/` file |
| Same literal repeated in 2+ files | Extract to `config.ts` or a constants file |
| Pure helper used by 2+ files | Extract to `src/utils/` |
| Component used by 2+ features | Extract to `src/view/components/` |

#### Promotion Rules (Local → Shared)

Use this rule to decide where code should live:

**A) Default: Keep code local**

If a helper, utility, or component is only used in one place, keep it there. Don't pre-emptively extract.

```
src/view/sheets/components/AbilityScores.svelte  ← helper function used only here stays here
```

**B) Promote when it becomes shared**

When code is reused, promote it to the narrowest common ancestor:

1. **Shared within a feature**, Move to feature's root directory
   ```
   src/view/sheets/helpers/calculateModifier.ts  ← used by multiple sheet components
   ```

2. **Shared across features**, Move to global shared location
   ```
   src/utils/calculateModifier.ts  ← used by sheets AND dialogs AND chat
   ```

**C) Import smell heuristic**

If a file imports from a distant, unrelated directory for a helper that seems feature-specific, consider:
- Moving that helper down into the feature that uses it most
- Or promoting it to a true shared utility if multiple features need it

**Avoid over-extraction:**
- Keep small private helpers in the same file unless there's a clear "domain module" boundary
- Don't create micro-files for single helpers, prefer one cohesive module per domain

---

### 3. Avoid Premature Optimization

Write clear, correct code first. Optimize only when you have evidence of a performance problem.

> "Premature optimization is the root of all evil", Donald Knuth

#### Principles

- **Correctness first**, Code that works correctly but slowly is better than fast code that's wrong or unmaintainable
- **Measure before optimizing**, Use browser profilers or logging to identify actual bottlenecks
- **Optimize the right thing**, The perceived slow spot is often not the actual bottleneck
- **Readability matters**, Optimized code is often harder to understand and maintain

#### When NOT to Optimize

```svelte
<script lang="ts">
  // Unnecessary, simple derivation, no expensive computation
  const fullName = $derived(`${firstName} ${lastName}`);

  // Just use the simple version
  const fullName = `${firstName} ${lastName}`;
</script>
```

#### When TO Optimize

Optimize when you have:

- **Measured evidence** of a performance problem (profiler data, slow interactions)
- **Expensive computations** that run on every render (complex filtering, sorting large arrays)
- **Components re-rendering excessively** due to unnecessary reactivity

```svelte
<script lang="ts">
  // Large dataset transformation, worth memoizing with $derived
  const sortedAndFilteredItems = $derived(
    items
      .filter((item) => item.status === activeFilter)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  );
</script>
```

**Rule of thumb:** If you can't articulate what performance problem you're solving, you probably don't need the optimization.

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
| Component prop types | `types/components/` |
| Shared type definitions | `types/` |

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
  import type { HitPointBarProps } from '../../types/components/HitPointBar.d.ts';

  // 2. Component imports
  import AbilityScores from './AbilityScores.svelte';

  // 3. Utility imports
  import localize from '../../utils/localize.ts';

  // 4. Store imports
  import { keyPressStore } from '#stores/keyPressStore.ts';

  // 5. Context
  const actor = getContext('actor');

  // 6. Props
  let { currentHP, maxHP, onUpdate }: HitPointBarProps = $props();

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

Define prop types in separate type files, then import them in components:

```typescript
// types/components/HitPointBar.d.ts
export interface HitPointBarProps {
  currentHP: number;
  maxHP: number;
  onUpdate?: (value: number) => void;
}
```

```svelte
<script lang="ts">
  import type { HitPointBarProps } from '../../types/components/HitPointBar.d.ts';

  let { currentHP, maxHP, onUpdate }: HitPointBarProps = $props();
</script>
```

For complex optional patterns, define union types in the type file:

```typescript
// types/components/ValueEditor.d.ts
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

export type ValueEditorProps = Editable | ReadOnly;
```

```svelte
<script lang="ts">
  import type { ValueEditorProps } from '../../types/components/ValueEditor.d.ts';

  let props: ValueEditorProps = $props();
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
- **Medium components (100-500 lines)**: Consider extracting sub-components
- **Large components (> 500 lines)**: Definitely split into sub-components

Signs a component should be split:
- Multiple unrelated concerns
- Repeated markup patterns
- Deeply nested template logic
- Multiple `$effect` blocks for different purposes

### Component Design Principles

#### Components Should Be Easy to Plug In

Components should require the minimum number of props necessary. If the consumer has to pass more than a few props, consider whether some can be defaults, derived internally, or split into composition.

**Good example, minimal required props:**

```svelte
<!-- Just the essential data, component handles the rest -->
<ConfirmationDialog
  opened={isOpen}
  onClose={close}
  title="Delete Item"
  onConfirm={handleDelete}
/>
```

**Good example, composable via slots:**

```svelte
<Sheet {actor}>
  <svelte:fragment slot="header">
    <SheetHeader {actor} />
  </svelte:fragment>
  <svelte:fragment slot="content">
    <AbilityScores {actor} />
    <Skills {actor} />
  </svelte:fragment>
</Sheet>
```

**Avoid, too many props when a single object would suffice:**

```svelte
<!-- Bad: spreading every field as a separate prop -->
<CharacterBadge
  id={character.id}
  name={character.name}
  level={character.level}
  class={character.class}
  hitPoints={character.hitPoints}
  maxHitPoints={character.maxHitPoints}
  armorClass={character.armorClass}
  onClick={handleClick}
/>

<!-- Good: pass the typed object -->
<CharacterBadge character={character} onClick={handleClick} />
```

#### Handle Loading and Empty States

Every component that depends on async data should account for three states:

| State | Treatment |
|-------|-----------|
| **Loading** | Show skeleton placeholders matching expected content shape |
| **Empty** | Show clear empty-state message, never render bare empty containers |
| **Error** | Show inline error message with retry option where possible |

```svelte
<script lang="ts">
  let { actor, isLoading, error }: Props = $props();
</script>

{#if isLoading}
  <div class="skeleton skeleton--abilities" />
{:else if error}
  <div class="error-state">
    <p>Failed to load abilities</p>
    <button onclick={retry}>Retry</button>
  </div>
{:else if !actor}
  <div class="empty-state">No character selected</div>
{:else}
  <AbilityScores {actor} />
{/if}
```

---

## TypeScript Patterns

### Type Imports

Always use `import type` for type-only imports (required by `verbatimModuleSyntax`):

```typescript
// Good
import type { NimbleCharacter } from '#documents/actor/NimbleCharacter.ts';
import { someFunction } from '#utils/helpers.ts';

// Bad - will cause errors
import { NimbleCharacter } from '#documents/actor/NimbleCharacter.ts';
```

### Module Path Aliases

Use configured path aliases for cleaner imports:

```typescript
// Good - use aliases
import type { NimbleCharacterData } from '#types/actor';
import localize from '../../utils/localize.ts';
import { keyPressStore } from '#stores/keyPressStore.ts';

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

Include file extensions in ESM imports:

```typescript
// TypeScript files
import { helper } from './helper.ts';
import { NimbleCharacter } from '#documents/actor/NimbleCharacter.ts';

// Svelte components (no extension needed)
import PlayerCharacterSheet from './PlayerCharacterSheet.svelte';
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
  import { keyPressStore } from '#stores/keyPressStore.ts';

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
import { add, multiply } from '#utils/math.ts';
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
import localize from '../../utils/localize.ts';
```

### Import Order

Organize imports in this order, with blank lines between groups:

```typescript
// 1. Type imports
import type { NimbleCharacter } from '#documents/actor/NimbleCharacter.ts';
import type { SpellData } from '#types/item';

// 2. External library imports
import { writable } from 'svelte/store';

// 3. Internal absolute imports (using aliases)
import { keyPressStore } from '#stores/keyPressStore.ts';
import localize from '../../utils/localize.ts';

// 4. Relative imports
import { helper } from './helper.ts';
import ChildComponent from './ChildComponent.svelte';
```

### Re-exports

Use index files sparingly. Prefer direct imports to avoid circular dependencies:

```typescript
// Prefer direct imports
import { NimbleCharacter } from '#documents/actor/NimbleCharacter.ts';

// Avoid barrel exports that can cause circular dependencies
import { NimbleCharacter } from '#documents/actor/index.ts';
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

### Color Contrast and Light/Dark Mode

#### Use Semantic Color Variables

Define colors by their purpose, not their appearance. This enables theme switching and ensures consistent contrast:

```scss
// Define semantic color variables
:root {
  // Surface colors
  --nimble-surface-primary: #ffffff;
  --nimble-surface-secondary: #f5f5f5;
  --nimble-surface-elevated: #ffffff;

  // Text colors
  --nimble-text-primary: #1a1a1a;
  --nimble-text-secondary: #666666;
  --nimble-text-muted: #999999;

  // Interactive colors
  --nimble-interactive: #4a90d9;
  --nimble-interactive-hover: #3a7bc8;

  // Status colors
  --nimble-success: #2e7d32;
  --nimble-warning: #f57c00;
  --nimble-error: #d32f2f;
}
```

#### Light/Dark Mode Support

Define dark mode overrides using Foundry's color scheme selector:

```scss
// Dark mode overrides
[data-theme="dark"] {
  --nimble-surface-primary: #1e1e1e;
  --nimble-surface-secondary: #2d2d2d;
  --nimble-surface-elevated: #333333;

  --nimble-text-primary: #e0e0e0;
  --nimble-text-secondary: #a0a0a0;
  --nimble-text-muted: #707070;

  --nimble-interactive: #6ba3e0;
  --nimble-interactive-hover: #8ab8e8;

  --nimble-success: #66bb6a;
  --nimble-warning: #ffa726;
  --nimble-error: #ef5350;
}
```

#### Color Contrast Requirements

Ensure sufficient contrast for accessibility:

| Text Type | Minimum Contrast Ratio |
|-----------|------------------------|
| Body text | 4.5:1 |
| Large text (18px+ or 14px+ bold) | 3:1 |
| UI components and graphics | 3:1 |

```scss
// Good - sufficient contrast
.label {
  color: var(--nimble-text-primary);  // High contrast for readability
  background: var(--nimble-surface-primary);
}

// Good - muted text only for non-essential info
.hint {
  color: var(--nimble-text-muted);  // Lower contrast acceptable for hints
}

// Avoid - hardcoded colors that break in dark mode
.label {
  color: #333;  // Will be invisible on dark backgrounds
}
```

#### Best Practices

1. **Never hardcode colors** - Always use CSS custom properties
2. **Test both modes** - Verify UI is readable in light and dark themes
3. **Use semantic names** - Name variables by purpose (`--text-primary`) not appearance (`--dark-gray`)
4. **Maintain contrast** - Ensure text remains readable against its background in both modes
5. **Consider hover states** - Interactive elements need visible hover feedback in both modes

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

### Write Meaningful Tests

Tests should verify logic and behavior, not just that code runs without crashing.

**Avoid shallow existence checks:**

```typescript
// Bad, no assertions about behavior
it('renders', () => {
  const result = calculateModifier(10);
  // Test passes but doesn't verify anything useful
});

// Bad, just checking it doesn't throw
it('works', () => {
  expect(() => isCombatantDead(combatant)).not.toThrow();
});
```

**Test specific behavior, state transitions, and edge cases:**

```typescript
// Good, tests specific behavior
describe('calculateModifier', () => {
  it('returns 0 for ability score of 10', () => {
    expect(calculateModifier(10)).toBe(0);
  });

  it('returns negative modifier for scores below 10', () => {
    expect(calculateModifier(8)).toBe(-1);
    expect(calculateModifier(6)).toBe(-2);
  });

  it('returns positive modifier for scores above 10', () => {
    expect(calculateModifier(12)).toBe(1);
    expect(calculateModifier(18)).toBe(4);
  });
});
```

### Test Structure

Use Vitest with descriptive test names:

```typescript
import { describe, expect, it } from 'vitest';
import { isCombatantDead } from './isCombatantDead.ts';
import { createCombatantFixture } from '../../tests/fixtures/combatant.ts';

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

| Category | Examples |
|----------|----------|
| **State transitions** | Open/close workflows, mode changes, form state |
| **Business logic** | Game rules, damage calculations, resource management |
| **Edge cases** | Null inputs, boundary values, empty arrays |
| **Validation rules** | Input validation, error conditions |
| **Data transformations** | Model preparation, data parsing, formatting |

**Example, testing state transitions:**

```typescript
describe('HitDiceManager', () => {
  it('reduces available hit dice when spent', () => {
    const manager = new HitDiceManager(character);
    const initialCount = manager.getAvailableCount('d8');

    manager.spend('d8', 1);

    expect(manager.getAvailableCount('d8')).toBe(initialCount - 1);
  });

  it('restores hit dice on long rest', () => {
    const manager = new HitDiceManager(character);
    manager.spend('d8', 2);

    manager.onLongRest();

    expect(manager.getAvailableCount('d8')).toBeGreaterThan(0);
  });
});
```

**Example, testing edge cases:**

```typescript
describe('getActorHpValue', () => {
  it('returns null for undefined actor', () => {
    expect(getActorHpValue(undefined)).toBeNull();
  });

  it('returns null for null actor', () => {
    expect(getActorHpValue(null)).toBeNull();
  });

  it('returns null when HP is NaN', () => {
    const actor = createActorFixture({ hp: NaN });
    expect(getActorHpValue(actor)).toBeNull();
  });

  it('returns 0 for actors at zero HP', () => {
    const actor = createActorFixture({ hp: 0 });
    expect(getActorHpValue(actor)).toBe(0);
  });
});
```

### What Not to Unit Test

- Svelte component rendering (use manual testing in FoundryVTT)
- FoundryVTT API calls (mock at integration level)
- Simple getters/setters with no logic

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

Always use localization for user-facing strings. Import the `localize` utility using relative paths:

```typescript
import localize from '../utils/localize.ts';

// Simple string
const label = localize('NIMBLE.AbilityStr');

// With interpolation
const message = localize('NIMBLE.DamageRoll', { amount: '10' });
```

In Svelte templates:

```svelte
<script lang="ts">
  import localize from '../../utils/localize.ts';
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

### Before Committing

- [ ] `pnpm check` passes (format, lint, type-check, tests)
- [ ] No circular dependencies introduced
- [ ] New code follows existing patterns
- [ ] Svelte components use TypeScript (`lang="ts"`)
- [ ] Props types defined in separate `.d.ts` files
- [ ] File names follow conventions
- [ ] Imports use path aliases where appropriate
- [ ] No hardcoded user-facing strings (use localization)
- [ ] Tests added for new utility functions

### Pre-Review Extraction Checks

Use these rules as a pre-review gate. They help keep files focused by extracting shared code into the right locations.

**Types:**
- [ ] No `export type` remains in component/utility files when used outside that file → move to `types/`
- [ ] Prop types for components are in separate `.d.ts` files

**Constants:**
- [ ] No magic numbers or repeated literals → extract to `config.ts` or a constants file
- [ ] Policy values that affect behavior (page sizes, timeouts, thresholds) are named constants

**Utilities:**
- [ ] Pure helpers used by 2+ files are extracted to `src/utils/`
- [ ] Cohesive clusters of related helpers are in a single module (not micro-files)

**Components:**
- [ ] Components used by 2+ features are in `src/view/components/`
- [ ] Large components (500+ lines) are split into sub-components

**State:**
- [ ] Loading, empty, and error states are handled
- [ ] No duplicated state management logic → extract to a store if shared

---

## Quick Reference

### Component Template

```svelte
<script lang="ts">
  import type { MyComponentProps } from '../../types/components/MyComponent.d.ts';
  import ChildComponent from './ChildComponent.svelte';
  import { getContext } from 'svelte';
  import localize from '../../utils/localize.ts';

  let { value, onChange }: MyComponentProps = $props();

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

---

## Shared Code Inventory

> **Note:** This list is a snapshot. Check the actual directories for the current inventory before creating something new.

### Shared Utilities

| Utility | Location | Purpose |
|---------|----------|---------|
| `localize()` | `src/utils/localize.ts` | Format i18n strings with optional interpolation |
| `isCombatantDead()` | `src/utils/isCombatantDead.ts` | Check if a combatant is dead based on HP/wounds |
| `getActorHpValue()` | `src/utils/isCombatantDead.ts` | Get an actor's current HP value |
| `getActorWoundsValueAndMax()` | `src/utils/isCombatantDead.ts` | Get an actor's wounds value and max |
| `calculateRollMode()` | `src/utils/calculateRollMode.ts` | Determine roll mode based on modifier keys |
| `getRollFormula()` | `src/utils/getRollFormula.ts` | Build roll formula strings |
| `arraysAreEqual()` | `src/utils/arraysAreEqual.ts` | Compare two arrays for equality |
| `sortDocumentsByName()` | `src/utils/sortDocumentsByName.ts` | Sort Foundry documents alphabetically |
| `isValidDiceModifier()` | `src/utils/isValidDiceModifier.ts` | Validate dice modifier strings |
| `combatManaRules` | `src/utils/combatManaRules.ts` | Combat mana calculation and rules |
| `ChargePoolRuleConfig` | `src/utils/chargePoolRuleConfig.ts` | Shared charge-system constants (scopes, triggers, flags) |
| `ChargePoolService` | `src/utils/chargePoolService.ts` | Charge pool sync, consumption, and recovery operations |
| `manaRecovery` | `src/utils/manaRecovery.ts` | Mana recovery calculations |
| `prelocalize()` | `src/utils/prelocalize.ts` | Pre-localize configuration objects |
| `getChoicesFromCompendium()` | `src/utils/getChoicesFromCompendium.ts` | Fetch selectable options from compendiums |
| `getSubclassChoices()` | `src/utils/getSubclassChoices.ts` | Get available subclass options |
| `spell/*` | `src/utils/spell/` | Spell-related utilities |
| `treeManipulation/*` | `src/utils/treeManipulation/` | Tree data structure utilities |

### Shared Stores

| Store | Location | Purpose |
|-------|----------|---------|
| `keyPressStore` | `src/stores/keyPressStore.ts` | Track modifier key states (ctrl, shift, alt) |

### Managers

| Manager | Location | Purpose |
|---------|----------|---------|
| `ConditionManager` | `src/managers/ConditionManager.ts` | Manage status conditions and effects |
| `HitDiceManager` | `src/managers/HitDiceManager.ts` | Handle hit dice tracking and spending |
| `RestManager` | `src/managers/RestManager.ts` | Process rest actions and recovery |
| `ItemActivationManager` | `src/managers/ItemActivationManager.ts` | Handle item activation workflows |
| `ModifierManager` | `src/managers/ModifierManager.ts` | Track and apply roll modifiers |
| `RulesManager` | `src/managers/RulesManager.ts` | Game rules and validation |
| `ClassResourceManager` | `src/managers/ClassResourceManager.ts` | Manage class-specific resources |

### Shared Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `RadioGroup` | `src/view/components/RadioGroup.svelte` | Single-select radio button group |
| `TagGroup` | `src/view/components/TagGroup.svelte` | Multi-select tag/chip group |
| `PrimaryNavigation` | `src/view/components/PrimaryNavigation.svelte` | Main navigation tabs |
| `PrimaryNavigationItem` | `src/view/components/PrimaryNavigationItem.svelte` | Individual navigation tab |
| `SecondaryNavigation` | `src/view/components/SecondaryNavigation.svelte` | Secondary navigation container |
| `SecondaryNavigationItem` | `src/view/components/SecondaryNavigationItem.svelte` | Secondary navigation item |
| `Hint` | `src/view/components/Hint.svelte` | Hint/tooltip text display |
