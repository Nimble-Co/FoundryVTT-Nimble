# Agent Guidelines

This file provides guidance for AI assistants working on this codebase.

## Style Guide

Before making changes, read the full coding style guide: [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md)

## Quick Reference

### Key Conventions

- **Svelte 5 runes**: Use `$state`, `$derived`, `$effect`, and `$props()` for reactivity
- **TypeScript**: Always use `lang="ts"` in Svelte components and `import type` for type-only imports
- **File extensions**: Include `.ts` in ESM imports for TypeScript files
- **Props types**: Define in separate `types/components/*.d.ts` files, not inline
- **Naming**: PascalCase for components/classes, camelCase for functions/directories
- **Localization**: Use `localize()` from `src/utils/localize.ts` for all user-facing strings

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

See [Pre-Review Extraction Checks](docs/STYLE_GUIDE.md#pre-review-extraction-checks) for the full checklist.
