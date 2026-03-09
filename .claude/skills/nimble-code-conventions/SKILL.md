---
name: nimble-code-conventions
description: "Invoke when reviewing code or scaffolding new sheets. Loads the full Svelte 5, TypeScript, file naming, localization, SCSS, code quality, and FoundryVTT integration conventions checklist."
---

## Svelte 5 Conventions

- [ ] Uses runes: `$state`, `$derived`, `$effect`, `$props()` — no Svelte 4 stores in components
- [ ] Script order matches exact 10-item sequence (see `references/svelte5-script-order.md`):
  1. Type imports
  2. Component imports
  3. Utility imports
  4. Store imports
  5. Context (`getContext`)
  6. Props (`$props()`) — typed via `types/components/$SHEET_NAME.d.ts`
  7. Local state (`$state`)
  8. Derived values (`$derived`)
  9. Effects (`$effect`)
  10. Functions
- [ ] Props type defined in `types/components/ComponentName.d.ts`, not inline
- [ ] `setContext` / `getContext` used correctly (not direct store subscriptions across component boundaries)

## TypeScript Conventions

- [ ] Import aliases used (`#documents/*`, `#view/*`, `#utils/*`, etc.) with `.ts` extension
- [ ] No `any` types without justification
- [ ] `game.settings.register` uses `'nimble' as 'core'` and `key as 'rollMode'` casts; third arg cast `as never`
- [ ] Hook callbacks typed as `Hooks.on('hookName', (arg: unknown) => ...)`
- [ ] Constants use `SCREAMING_SNAKE_CASE`; system-wide constants added to `src/config.ts`

## File Naming

- [ ] Svelte components: `PascalCase.svelte`
- [ ] TS classes: `PascalCase.ts`
- [ ] TS utilities: `camelCase.ts`
- [ ] SCSS partials: `_kebab-case.scss`

## Localization

- [ ] All user-facing strings use `localize()` from `#utils/localize.ts` — no raw string literals in UI

## SCSS

- [ ] New SCSS partials: uses BEM naming, `var(--nimble-*)` custom properties, no hardcoded colors
- [ ] New partial added with `@use` in `src/scss/main.scss`

## Code Quality

- [ ] No over-engineering: helpers extracted only if shared across 2+ files
- [ ] No unused variables, dead code, or backwards-compat hacks
- [ ] No security issues: no `eval`, no `innerHTML` with user content, no command injection
- [ ] Error handling only at system boundaries (user input, external APIs) — not for internal invariants

## FoundryVTT Integration

- [ ] New settings registered correctly in `src/hooks/init.ts` or `src/settings/`
- [ ] New document classes registered in `src/hooks/init.ts`
- [ ] New sheets registered via `Actors.registerSheet` / `Items.registerSheet`
- [ ] Hook usage: `renderSceneControls` (not `getSceneControlButtons`) for DOM injection in v13
