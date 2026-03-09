# GitHub Copilot Instructions

This is a **FoundryVTT game system** for the Nimble 2 RPG, built with **TypeScript + Svelte 5 + Vite**.

## Commands

```bash
pnpm dev              # Dev server proxying to FoundryVTT on localhost:30000
pnpm dev:remote       # Dev server proxying to live Oracle server (no local Foundry needed)
pnpm build            # Build compendia + system for production
pnpm check            # Run all checks: format, lint, circular-deps, type-check, tests
pnpm format           # Format with Biome + Prettier (svelte)
pnpm lint             # Lint with ESLint (svelte) + Biome
pnpm lint-fix         # Auto-fix linting issues
pnpm type-check       # TypeScript type check (tsc --noEmit)
pnpm test             # Run all tests (vitest)
pnpm test:watch       # Run tests in watch mode
```

Run a single test file:
```bash
pnpm vitest run src/path/to/file.test.ts
```

Run `pnpm check` before committing.

## Architecture

### Entry Point & Lifecycle

- `src/nimble.ts` — Main entry; registers all hooks
- `src/hooks/init.ts` — Registers document classes, sheets, data models
- `src/config.ts` — System-wide constants (`CONFIG.NIMBLE`)
- `src/game.ts` — Global game instance utilities

### Document System (Proxy Pattern)

Documents dispatch to typed subclasses via a Proxy:
- `src/documents/actor/actorProxy.ts` → `character.ts`, `npc.ts`, `minion.ts`, `soloMonster.ts`
- `src/documents/item/itemProxy.ts` → `spell.ts`, `boon.ts`, `class.ts`, etc.
- Base classes: `src/documents/actor/base.svelte.ts`, `src/documents/item/base.svelte.ts`

### Svelte Sheet Pattern

Each document type has two paired artifacts:
1. **Sheet class** in `src/documents/sheets/` (e.g., `PlayerCharacterSheet.svelte.ts`) — extends `SvelteApplicationMixin(ActorSheetV2)`, sets `this.root` to the Svelte component
2. **Svelte component** in `src/view/sheets/` — the actual UI

### Import Aliases

Always use aliases (with `.ts` extension in ESM imports):
```
#documents/*  → src/documents/*
#lib/*        → lib/*
#managers/*   → src/managers/*
#stores/*     → src/stores/*
#types/*      → types/*
#utils/*      → src/utils/*
#view/*       → src/view/*
```

Example: `import foo from '#utils/foo.ts'`

## Key Conventions

### Svelte 5 Only

Use runes — `$state`, `$derived`, `$effect`, `$props()`. No Svelte 4 store patterns in components.

### Component Script Order

```svelte
<script lang="ts">
  // 1. Type imports
  // 2. Component imports
  // 3. Utility imports
  // 4. Store imports
  // 5. Context (getContext)
  // 6. Props ($props())
  // 7. Local state ($state)
  // 8. Derived values ($derived)
  // 9. Effects ($effect)
  // 10. Functions
</script>
```

### Props Types

Define in `types/components/ComponentName.d.ts`, not inline in the component.

### Localization

Use `localize()` from `src/utils/localize.ts` for all user-facing strings.

### File Naming

| Type | Convention |
|------|------------|
| Svelte components | `PascalCase.svelte` |
| TS classes | `PascalCase.ts` |
| TS utilities/functions | `camelCase.ts` |
| Directories | `camelCase/` |
| Test files | `*.test.ts` |
| SCSS partials | `_kebab-case.scss` |

### Constants

Use `SCREAMING_SNAKE_CASE`. Add system-wide constants to `src/config.ts`.

### Code Placement

- Used only in one file → keep it there
- Shared within a feature → feature root directory
- Shared across features → `src/utils/` or `src/view/components/`

### Testing

Test files live co-located with source (`src/**/*.test.ts`). Foundry globals are mocked in `tests/setup.ts`. Use `tests/fixtures/` for reusable test data and `tests/mocks/` for Foundry API mocks.

## Branch Strategy

- Feature branches → `dev`
- PRs target `dev`
- `main` is reserved for releases

## Upstream

To incorporate upstream Nimble-Co changes:
```bash
git fetch upstream && git merge upstream/dev
```
