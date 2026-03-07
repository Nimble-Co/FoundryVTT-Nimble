# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # Start dev server (proxies to FoundryVTT on localhost:30000)
pnpm dev:remote       # Start dev server proxying to live Oracle server (no local Foundry needed)
pnpm deploy:nimble    # Build + rsync dist/ to remote Data/systems/nimble/ (with --delete)
pnpm deploy:data      # Rsync foundrydata/Data/ to remote Data/ excluding systems/ (worlds, modules, etc.)
pnpm pull             # Pull foundryuserdata/Data/ from Oracle server into local foundrydata/Data/ (excludes systems/nimble/)
pnpm build            # Build compendia + system for production
pnpm build:system     # Build system only
pnpm build:compendia  # Build compendia only
pnpm check            # Run all checks: format, lint, circular-deps, type-check, tests
pnpm format           # Format with Biome + Prettier (svelte)
pnpm lint             # Lint with ESLint (svelte) + Biome
pnpm lint-fix         # Auto-fix linting issues
pnpm type-check       # TypeScript type check (tsc --noEmit)
pnpm circular-deps    # Check for circular dependencies
pnpm test             # Run tests (vitest)
pnpm test:watch       # Run tests in watch mode
```

Run `pnpm check` before committing — it runs format, lint, circular-deps, type-check, and tests together.

## Architecture

This is a **FoundryVTT game system** for the Nimble 2 RPG, built with **TypeScript + Svelte 5 + Vite**.

### Entry Point & Lifecycle

- `src/nimble.ts` — Main entry; registers all hooks
- `src/hooks/init.ts` — Registers document classes, sheets, data models
- `src/hooks/setup.ts` — Post-init setup
- `src/hooks/ready.ts` — System ready
- `src/config.ts` — System-wide constants (ability scores, damage types, classes, etc.)
- `src/game.ts` — Global game instance utilities

### Key Directory Layout

| Directory | Purpose |
|-----------|---------|
| `src/documents/` | FoundryVTT document classes (Actor, Item, Combat, etc.) |
| `src/models/` | Data model definitions for document types |
| `src/view/` | All Svelte UI (sheets, dialogs, chat, components) |
| `src/stores/` | Svelte stores |
| `src/utils/` | Utility functions (feature-specific in subdirectories) |
| `src/hooks/` | FoundryVTT lifecycle hooks |
| `src/dice/` | Custom dice: `NimbleRoll`, `DamageRoll`, `DicePool` |
| `src/managers/` | Game logic managers |
| `src/enrichers/` | Text enricher implementations |
| `src/scss/` | SCSS stylesheets |
| `types/` | TypeScript type definitions (component props in `types/components/`) |
| `lib/` | Svelte component mixins |
| `packs/` | JSON source files for game content compendia |

### Document System

Documents use a **Proxy pattern** to dispatch to typed subclasses:
- `src/documents/actor/actorProxy.ts` → dispatches to `character.ts`, `npc.ts`, `minion.ts`, `soloMonster.ts`
- `src/documents/item/itemProxy.ts` → dispatches to `spell.ts`, `boon.ts`, `class.ts`, etc.
- Base classes: `src/documents/actor/base.svelte.ts`, `src/documents/item/base.svelte.ts`

### Svelte Sheets Pattern

Each document type has:
1. A sheet class in `src/documents/sheets/` (e.g., `PlayerCharacterSheet.svelte.ts`) — FoundryVTT `ApplicationV2` subclass
2. A Svelte component in `src/view/sheets/` — the actual UI

### Import Aliases

Configured in `package.json` `imports` field:
```
#documents/*  → src/documents/*
#lib/*        → lib/*
#managers/*   → src/managers/*
#stores/*     → src/stores/*
#types/*      → types/*
#utils/*      → src/utils/*
#view/*       → src/view/*
```

Always include `.ts` extension in ESM imports (e.g., `import foo from '#utils/foo.ts'`).

## Coding Conventions

### Svelte 5

Use runes: `$state`, `$derived`, `$effect`, `$props()`. No Svelte 4 stores patterns in components.

### Component Script Order

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

Use `SCREAMING_SNAKE_CASE` for true constants. Add system-wide constants to `src/config.ts`.

### Code Placement

- Helper used only in one file → keep it there
- Helper shared within a feature → feature root directory
- Helper shared across features → `src/utils/`
- Component used across features → `src/view/components/`

## Branch Strategy

- Feature branches → `dev`
- PRs target `dev`
- `main` is reserved for releases
