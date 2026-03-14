# Agent Guidelines

This file provides guidance for AI assistants working on this codebase.

## References

Before making changes, read the full coding style guide: [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md)

For detailed technology stack, Foundry VTT integration patterns, and testing infrastructure: [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md)

## Quick Reference

### Key Conventions

- **Svelte 5 runes**: Use `$state`, `$derived`, `$effect`, and `$props()` for reactivity
- **TypeScript**: Always use `lang="ts"` in Svelte components and `import type` for type-only imports
- **File extensions**: Include `.ts` in ESM imports for TypeScript files
- **Props types**: Define in separate `types/components/*.d.ts` files, not inline
- **Naming**: PascalCase for components/classes, camelCase for functions/directories
- **Localization**: Use `localize()` from `src/utils/localize.ts` for all user-facing strings
- **Path aliases**: Use `#documents/*`, `#lib/*`, `#managers/*`, `#stores/*`, `#types/*`, `#utils/*`, `#view/*`

### Engineering Principles
These are mandatory implementation constraints, not slogans.

**KISS**: Use explicit control flow (`if`/`switch`). Avoid dynamic component lookups, runtime string-to-function dispatch, or Svelte action factories that obscure what runs and when.
**YAGNI**: Every abstraction (utility, store, component) must have a current caller. If a code path isn't supported yet, throw an error, don't add a stub or no-op fallback.
**DRY + Rule of Three**: Two similar blocks in the same file are fine. Extract to a shared utility or component only after the same pattern appears three times across different files, and only if the extracted code respects [Code Promotion Rules](#code-promotion-rules).

### Foundational Principles

1. **Write self-documenting code** — Use descriptive names; avoid abbreviations
2. **Don't repeat yourself** — Check [Shared Code Inventory](docs/STYLE_GUIDE.md#shared-code-inventory) before creating new utilities
3. **Avoid premature optimization** — Write clear code first; optimize only with evidence

### Component Structure

```svelte
<script lang="ts">
  // 1. Type imports (from types/*.d.ts)
  // 2. Component imports
  // 3. Utility imports
  // 4. Store imports
  // 5. Context
  // 6. Props (import type, then $props())
  // 7. Local state ($state)
  // 8. Derived values ($derived)
  // 9. Effects ($effect)
  // 10. Functions
</script>

<!-- Template with loading/empty/error states -->

<style lang="scss">
  /* Scoped styles using CSS custom properties */
</style>
```

### Directory Structure

| Code Type | Location |
|-----------|----------|
| Shared components | `src/view/components/` |
| Sheet components | `src/view/sheets/` |
| Dialogs | `src/view/dialogs/` |
| Stores | `src/stores/` |
| Utilities | `src/utils/` |
| Document classes | `src/documents/` |
| Data models | `src/models/` |
| Managers | `src/managers/` |
| Component prop types | `types/components/` |

### Code Promotion Rules

- **Local**: Keep helpers in the file if only used there
- **Feature**: Move to feature directory if shared within feature
- **Global**: Move to `src/utils/` or `src/view/components/` if shared across features

### Before Committing

Run `pnpm check` to verify formatting, linting, types, and tests pass.

Use **Conventional Commits**: `type(scope): description` (types: `feat`, `fix`, `chore`, `docs`).

See [Pre-Review Extraction Checks](docs/STYLE_GUIDE.md#pre-review-extraction-checks) for the full checklist.

### Critical Rules

- **Foundry globals**: `game`, `CONFIG`, `Hooks`, `Roll`, `Actor`, `Item` are globals — never import them
- **`.svelte.ts` extension**: Any `.ts` file using runes (`$state`, `$derived`, `$effect`) outside a `.svelte` component must use `.svelte.ts`
- **No Svelte 4 syntax**: No `export let`, `$:`, `on:click`, or `createEventDispatcher()` — use `$props()`, `$derived`, `$effect`, `onclick`
- **No barrel exports**: No `index.ts` re-exports — they cause circular dependency chains
- **Unused vars**: Prefix with `_` (e.g., `_event`), don't delete parameters
- **Don't mutate documents directly**: Use `actor.update()` / `item.update()` — direct assignment won't persist
- **Extend `NimbleBaseActor`/`NimbleBaseItem`**: Never extend Foundry's `Actor`/`Item` directly
- **`@ts-expect-error` not `@ts-ignore`**: Use `@ts-expect-error` with a comment explaining why
- **Don't add new entry points**: All code must be reachable from `src/nimble.ts` via imports
- **Don't modify test infrastructure**: `tests/setup.ts` and `tests/mocks/foundry.js` are stable shared infrastructure — fix your test, not the setup
