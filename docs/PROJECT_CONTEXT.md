# Project Context for AI Agents

> **Primary entry point**: [AGENTS.md](../AGENTS.md) — read it first for quick-reference rules.
> This file provides detailed technology stack, integration patterns, and testing infrastructure that supplement AGENTS.md.

_Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack

Exact versions in `package.json`. Formatting rules in `biome.json` and `.prettierrc`. Critical constraints:

- **Svelte 5 runes** — Globally enabled. Node modules opted out in vite config.
- **TypeScript** — Strict, `verbatimModuleSyntax`, `noImplicitOverride`. `noImplicitAny: false`.
- **Foundry VTT v13** — `game`, `CONFIG`, `Hooks`, `Roll`, `Actor`, `Item`, etc. are **globals** — never import them.
- **Vite library mode** — Single entry `src/nimble.ts` → `nimble.mjs`. `esbuild.keepNames: true` (Foundry uses class names at runtime). Icon paths (`/icons/...`) are external.
- **Base path** — Runtime assets at `/systems/nimble/`. Dev proxy handles redirect to Foundry at localhost:30000.
- **SCSS** — `svelte-preprocess` auto-prepends `_functions.scss` to all Svelte SCSS blocks.
- **Formatting/Linting** — Biome handles TS/JS/JSON; Prettier + ESLint handle `.svelte` files only.
- **Path aliases** — `#documents/*`, `#lib/*`, `#managers/*`, `#stores/*`, `#types/*`, `#utils/*`, `#view/*`. Defined in both `tsconfig.json` and `vite.config.mts`.
- **Lefthook** — Pre-commit: format staged files. Pre-push: lint + type-check + vitest.

## Language-Specific Rules

Full conventions in `STYLE_GUIDE.md`. Rules agents commonly miss:

- **`import type` required** — `verbatimModuleSyntax` is enforced. Type-only imports must use `import type` or the build fails.
- **File extensions in imports** — Always include `.ts` for TypeScript files, `.svelte` for components.
- **Unused vars** — Prefix with `_` (e.g., `_event`). The `^_` ignore pattern is enforced in both Biome and ESLint. Don't delete unused parameters — prefix them.
- **Forward declarations for circular deps** — Actor and item base classes cannot import each other. Instead, define a local interface mirroring the needed shape:
  ```typescript
  // In item/base.svelte.ts — avoids importing actor/base.svelte.ts
  interface NimbleBaseActor extends Actor { getDomain(): Set<string>; }
  ```
- **No barrel exports** — Import directly from source files. No index.ts re-exports — they cause circular dependency chains.

## Framework-Specific Rules

Svelte component conventions in `STYLE_GUIDE.md`. Foundry-Svelte integration rules:

### Svelte 5

- **`.svelte.ts` extension** — Any `.ts` file using Svelte runes (`$state`, `$derived`, `$effect`) outside a `.svelte` component must use `.svelte.ts` extension. The compiler won't process runes in plain `.ts` files.
- **`untrack()` for context** — When calling `setContext` with a reactive value, wrap in `untrack()` to suppress reactivity warnings.

### Foundry VTT Integration

- **Document class hierarchy** — All classes prefixed `Nimble`. Base classes: `NimbleBaseActor` (`src/documents/actor/base.svelte.ts`) and `NimbleBaseItem` (`src/documents/item/base.svelte.ts`). Extend these, not Foundry's `Actor`/`Item` directly.
- **Reactivity via `.reactive`** — Document classes use `createSubscriber` to integrate with Svelte reactivity. Access document data through `.reactive` in reactive contexts:
  ```typescript
  let hp = $derived(actor.reactive.system.attributes.hp.value);
  ```
  New document classes must replicate this pattern — see `base.svelte.ts` for the `createSubscriber` + Hooks setup.
- **Data preparation pipeline** — `prepareBaseData()` → `prepareEmbeddedDocuments()` → `prepareDerivedData()`. Guard with `if (this.initialized) return;` to prevent double-preparation.
- **Tags system** — `tags: Set<string>` with `namespace:value` format (e.g., `size:medium`, `identifier:fireball`). Populated in `_populateBaseTags()` and `_populateDerivedTags()`.
- **Sheet classes** — Mix `SvelteApplicationMixin` into `DocumentSheetV2`. Override `_getSvelteComponent()` to return the root Svelte component.
- **Dynamic imports for dialogs** — Use `await import()` to lazy-load dialog/sheet components to prevent circular dependencies.
- **Localization** — All user-facing strings via `localize()` from `src/utils/localize.ts`. Never hardcode display text.
- **Foundry API docs** — If a Context7 MCP server is available, use it to look up Foundry VTT API documentation. Not all environments have this configured.

## Testing Rules

Testing conventions in `STYLE_GUIDE.md`. Non-obvious setup details:

- **Globals enabled** — `describe`, `it`, `expect`, `vi` are globally available. Don't import them from `vitest`.
- **Setup file** — `tests/setup.ts` runs automatically before all tests. It mocks all Foundry globals (`game`, `CONFIG`, `foundry`, `ui`, `Roll`) and calls `init()` + `i18nInit()`, so `CONFIG.NIMBLE` is fully populated.
- **Foundry mocks** — All mocks in `tests/mocks/foundry.js`. Key exports: `createGameMock()`, `globalFoundryMocks`, `MockRollConstructor`, `uiMock`. Use these — don't create new Foundry mocks.
- **Roll mock reset** — `globalThis.__MockRollConstructor` is available for tests that need to reset or customize Roll behavior.
- **Automatic cleanup** — `vi.clearAllMocks()` and `@testing-library/svelte` `cleanup()` run in `afterEach` via setup. Don't duplicate this in test files.
- **Co-located tests** — Place `.test.ts` files next to the source file they test.

## Code Quality & Style Rules

Comprehensive style guide at `STYLE_GUIDE.md`. Read it before writing code. Key rules agents skip:

- **Check before creating** — Consult the Shared Code Inventory in the style guide before creating new utilities, components, or stores. Duplicating existing code is the most common agent mistake.
- **Directory structure** — `STYLE_GUIDE.md` documents where every type of new code goes. Follow it exactly.
- **`npm run check`** — Must pass before any PR. Runs: format, lint, circular-deps check, type-check, and tests.
- **Circular dependency check** — `dependency-cruiser` is configured (`.dependency-cruiser.cjs`). New imports can introduce cycles — the pre-push hook will catch them.
- **CSS custom properties** — Use `--nimble-*` variables for colors and spacing. Never hardcode colors — they must work in both light and dark mode (`[data-theme="dark"]`).
- **Scoped styles default** — Component styles are scoped via `<style lang="scss">`. Global styles only in `src/scss/`.

## Development Workflow Rules

- **Commit message format** — Conventional Commits: `type(scope): description`. Types: `feat`, `fix`, `chore`, `docs`. Scope is optional but preferred (e.g., `sheets`, `hooks`, `svelte`).
- **Branch strategy** — `main` is the release branch. `dev` is the working branch. Feature branches merge into `dev` via PR.
- **PR references** — Include issue/PR numbers in commit messages (e.g., `(#361)`).
- **Pre-push validation** — Lefthook runs biome check, type-check, and vitest on push. Fix issues before pushing — don't bypass with `--no-verify`.
- **Worktree support** — `npm run worktree:setup` and `npm run worktree:cleanup` scripts are available for parallel development in git worktrees.

## Critical Don't-Miss Rules

- **Never use Svelte 4 syntax** — No `export let`, no `$:` reactive statements, no `on:click` directives, no `createEventDispatcher()`. Use `$props()`, `$derived`, `$effect`, and `onclick` handlers.
- **Don't add new entry points** — Vite library mode builds from a single entry (`src/nimble.ts`). All new code must be reachable from this entry via imports.
- **Don't use `@ts-ignore`** — Use `@ts-expect-error` with a comment explaining why. It fails when the error is resolved, keeping suppressions honest.
- **Don't mutate documents directly** — Use `actor.update({ 'system.hp.value': newValue })` or `item.update()`. Direct property assignment won't persist or trigger Foundry hooks.
- **Don't modify test infrastructure** — `tests/setup.ts` and `tests/mocks/foundry.js` are stable shared infrastructure. Fix your test, not the setup.
- **Never extend `Actor`/`Item` directly** — Always extend `NimbleBaseActor` or `NimbleBaseItem`. Direct extension skips reactivity, tags, and data prep guards.
