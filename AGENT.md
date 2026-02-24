# Agent Guidelines

This file provides guidance for AI assistants working on this codebase.

## Style Guide

Before making changes, read the full coding style guide: [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md)

## Quick Reference

### Key Conventions

- **Svelte 5 runes**: Use `$state`, `$derived`, `$effect`, and `$props()` for reactivity
- **TypeScript**: Always use `lang="ts"` in Svelte components and `import type` for type-only imports
- **File extensions**: Include `.js` in ESM imports (TypeScript compiles to `.js`)
- **Path aliases**: Use `#utils/`, `#stores/`, `#documents/`, etc. instead of relative paths
- **Naming**: PascalCase for components/classes, camelCase for functions/directories

### Component Structure

```svelte
<script lang="ts">
  // 1. Type imports
  // 2. Component imports
  // 3. Utility imports
  // 4. Store imports
  // 5. Context
  // 6. Props (interface Props + $props())
  // 7. Local state ($state)
  // 8. Derived values ($derived)
  // 9. Effects ($effect)
  // 10. Functions
</script>

<!-- Template -->

<style lang="scss">
  /* Scoped styles */
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

### Before Committing

Run `npm run check` to verify formatting, linting, types, and tests pass.
