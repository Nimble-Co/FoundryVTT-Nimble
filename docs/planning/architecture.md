---
title: "Architecture"
outline: deep
---

::: warning AI-Generated Content
This document was primarily generated with AI assistance. Since this is a community-driven project with contributors having limited time, AI helps accelerate documentation and planning work.
:::

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
55 functional requirements across 10 categories spanning 4 development phases. Phase 1 (MVP) covers core gameplay: character management (FR1-9), basic dice rolling and combat actions (FR10-16), chat cards with role-based actions (FR17-22), combat tracker carousel (FR23-30), GM Helper v1 (FR31-35), compendium content (FR36-39), rest/recovery (FR40-41), and module integration hooks (FR42-44). Phase 2 extends into automation toolbox composability (FR45-51) and an overhauled dice roller with per-die manipulation (FR52-55).

**Non-Functional Requirements:**
14 NFRs with architecture-shaping implications:
- Performance: Sub-200ms sheet interactions, sub-500ms dice resolution, 60fps GM Helper with 20+ creatures (NFR1-7)
- Integration: FoundryVTT v13 API compatibility, stable module hooks, migration-safe schema changes (NFR8-12)
- Accessibility: Keyboard shortcuts for critical actions, WCAG AA color contrast (NFR13-14)

**Scale & Complexity:**

- Primary domain: FoundryVTT system module (platform plugin)
- Complexity level: Medium-High
- Estimated architectural components: ~15-20 (document models, sheet applications, combat subsystem, chat card engine, dice roller, GM Helper, automation toolbox, content pipeline, hooks/API layer, data migration, rules engine, effect system, rest system, settings, compendium management)

### Technical Constraints & Dependencies

- **FoundryVTT v13 API** - All document persistence, hook events, permission management, and application rendering go through Foundry's API. Cannot bypass or replace core systems.
- **Single entry point** - Vite library mode builds from `src/nimble.ts`. All code must be reachable via imports from this entry.
- **Svelte 5 runes only** - No legacy Svelte 4 syntax. Reactive files must use `.svelte.ts` extension.
- **TypeScript strict mode** - `verbatimModuleSyntax`, `noImplicitOverride`, `import type` enforced.
- **No barrel exports** - Direct imports only, to prevent circular dependency chains.
- **Document class hierarchy** - Must extend `NimbleBaseActor`/`NimbleBaseItem`, not Foundry base classes directly.
- **Brownfield context** - 146 closed issues, established patterns, existing codebase conventions documented in style guide.

### Cross-Cutting Concerns Identified

1. **Role-based UI rendering** - Chat cards, combat tracker, GM Helper, and sheet actions all behave differently based on viewer role (player vs GM). This must be a consistent pattern, not ad-hoc per component.
2. **Reactive document bridge** - Every UI component that displays document data must go through the `.reactive` accessor pattern with `createSubscriber`. This is the connective tissue between Foundry's imperative updates and Svelte's reactivity.
3. **Data migration safety** - Schema changes across system updates must preserve all character, item, and world data (NFR10). Migration scripts are a critical architectural concern.
4. **Automation composability** - The Phase 2 toolbox building blocks must be attachable to any item/feature by non-developers. This requires a well-designed rule/effect data model that's both powerful and accessible.
5. **Combat performance** - High-entity combat scenarios (20+ creatures with effects, chat cards, reactive updates) are the primary stress test. Architecture must support efficient batch operations and minimal re-renders.
6. **Content extensibility** - New content types (monsters, classes, spells) must be addable as compendium data without code changes. The data model must be stable and well-documented.

## Starter Template Evaluation

### Primary Technology Domain

FoundryVTT system module (platform plugin) - this is a brownfield project with an established codebase, not a greenfield project requiring starter template selection.

### Existing Technical Foundation (Brownfield)

This project has a mature, established technology stack. No starter template selection is needed - the architectural foundation is already in place.

**Rationale:** The codebase has 146 closed issues, established conventions, and a documented style guide. Architectural decisions build on this existing foundation rather than selecting a new one.

**Architectural Decisions Already Established:**

**Language & Runtime:**
- TypeScript (strict mode, `verbatimModuleSyntax`, `noImplicitOverride`)
- Svelte 5 with runes globally enabled
- FoundryVTT v13 as the host platform (provides globals: `game`, `CONFIG`, `Hooks`, `Roll`, `Actor`, `Item`)

**Styling Solution:**
- SCSS via `svelte-preprocess` with auto-prepended `_functions.scss`
- CSS custom properties (`--nimble-*`) for theming (light/dark mode via `[data-theme="dark"]`)
- Scoped styles by default in Svelte components; global styles in `src/scss/`

**Build Tooling:**
- Vite library mode - single entry point `src/nimble.ts` → `nimble.mjs`
- esbuild with `keepNames: true` (Foundry uses class names at runtime)
- Path aliases (`#documents/*`, `#lib/*`, etc.) in both `tsconfig.json` and `vite.config.mts`
- Icon paths (`/icons/...`) treated as external

**Testing Framework:**
- Vitest with globals enabled (`describe`, `it`, `expect`, `vi` available without import)
- Co-located test files (`.test.ts` next to source)
- Shared setup (`tests/setup.ts`) mocking all Foundry globals
- Foundry mocks in `tests/mocks/foundry.js`
- Automatic cleanup via `afterEach`

**Code Organization:**
- Document class hierarchy: `NimbleBaseActor`, `NimbleBaseItem` extending Foundry base classes
- No barrel exports - direct imports only to prevent circular dependencies
- Forward declarations for circular dep avoidance between actor/item base classes
- `dependency-cruiser` configured for circular dependency detection

**Development Experience:**
- Vite dev server with proxy to Foundry at localhost:30000
- Biome (TS/JS/JSON formatting) + Prettier/ESLint (Svelte files)
- Lefthook: pre-commit (format staged files), pre-push (lint + type-check + vitest)
- `pnpm run check` quality gate: format + lint + circular-deps + type-check + tests
- Git worktree support scripts for parallel development

**Note:** New architectural decisions in subsequent sections build on this established foundation. The architecture document focuses on decisions not yet made - particularly around the chat card system, GM Helper, automation toolbox, and Phase 2 extensibility.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
None - the existing architecture is well-established and the remaining work extends proven patterns.

**Important Decisions (Shape Architecture):**
1. GM Helper: Dockable ApplicationV2 (standalone or sidebar)
2. Automation Toolbox: Extend existing rules engine

**Deferred Decisions (Post-MVP):**
1. Dice roller abstraction layer (Phase 2 prep, nice-to-have)

### Data Architecture

**Chat Card Data Model:**
- Decision: Continue existing pattern
- Rationale: Current typed data models (10 card types) with Foundry's `ChatMessage` system field work well. Role-based actions determined at render time via permission checks, consistent with Foundry patterns.
- Extend with: New effect node components for Phase 1 interactions (crit prompts, save prompts, GM effect management)

**Automation Toolbox Data Schema:**
- Decision: Extend existing rules engine
- Rationale: The current rules system (18+ rule types, `RulesManager`, predicate/domain gating, data prep lifecycle hooks) directly supports the Phase 2 building blocks. Dice pools, counters, toggles, conditions, summon, and shapeshift all map to new rule types registered via `CONFIG.NIMBLE.ruleDataModels`.
- Edge cases handled case-by-case during implementation.

**Rules Engine Architecture:**
- Decision: Continue existing distributed pattern
- Rationale: Rules live on items, execute during data preparation pipeline (`prepareBaseData → prepareEmbeddedDocuments → prepareDerivedData`), gated by predicates against tag domains. Pattern is proven across 18+ rule types and extensible.

### Frontend Architecture

**GM Helper:**
- Decision: Dockable ApplicationV2 - can run as standalone window or dock into Foundry sidebar, user's choice
- Rationale: Follows existing `SvelteApplicationMixin(ApplicationV2)` pattern. Provides flexibility for different GM workflows.
- Accessible with or without active combat. Shows world NPCs/monsters outside combat, filters to combatants during combat.

**Dialog System:**
- Decision: Continue existing pattern
- Rationale: Independently-built dialogs with dynamic imports work well. No unified framework needed.

**Chat Card Components:**
- Decision: Continue extending existing pattern
- Rationale: Separate Svelte components per card type with shared sub-components (CardHeader, ItemCardEffects, typed nodes). New interactions added as new node components in the effect tree.

### Deferred Decisions

**Dice Roller Abstraction (Phase 2 prep):**
- Status: Nice-to-have for Phase 1, not critical
- Context: Phase 1 uses current basic roller. Phase 2 replaces with full per-die manipulation. An abstraction layer could reduce Phase 2 churn but isn't required.
- Decision: Evaluate during Phase 1 implementation. If a clean interface emerges naturally, adopt it. Don't force it.

## UX-Informed Architectural Additions

_Added after UX Design Specification completion (2026-03-05). These patterns were identified during UX design and have architectural implications for implementation._

### Chat Card State Machine

Chat cards are not static - they progress through defined states that determine what UI is rendered and what actions are available. This state is implicit (derived from data presence on the message document), not an explicit status field.

**State Progression:**
1. **Fresh** - Roll result rendered, effect nodes visible. Apply buttons available if targets present.
2. **Awaiting Reaction** - Monster attack hit a player. Defend prompt rendered for the target player. GM waits.
3. **Ready to Apply** - Reaction resolved (or no reaction applicable). Targets assigned, Apply Damage/Healing enabled.
4. **Applied** - Damage/healing applied. Confirmation banner with per-target HP before → after. Undo available.
5. **Undone** - HP restored to snapshot. Returns to Ready to Apply state.

**Architectural Implications:**
- State is derived from message `system` fields (e.g., presence of `appliedHealing[effectId]`, presence of defend response data), not a stored enum. This keeps the data model additive.
- Role-gated rendering checks state + viewer role to determine which UI elements appear.
- Each state transition is a `message.update()` call that triggers Svelte re-render via the `.reactive` accessor.

### Defend Reaction Data Flow

The Defend reaction is a **cross-player interaction** on a single chat message. This is architecturally distinct from normal card actions because it involves multiple users modifying the same message.

**Flow:**
1. GM rolls monster attack → `NimbleChatMessage` created with roll data and target UUID
2. Target player's client renders the Defend prompt (incoming damage, armor value, resulting damage if defended, action cost)
3. Player clicks Defend or Take It → `message.update()` writes defend response to `system` fields
4. All clients re-render: original damage struck through, reduced value shown, GM sees post-Defend amount
5. GM clicks Apply Damage → applies the final (potentially reduced) value

**Permission Model:**
- Message is owned by GM (monster's attack). Player needs permission to update specific `system` fields (defend response only).
- Implementation options: (a) GM-proxied update via socket, (b) Foundry's ownership/permission on the message, (c) custom socket handler. Decision deferred to implementation - evaluate Foundry v13's permission model first.

**Data Fields (on `NimbleChatMessage.system`):**
- `defendResponse.defended: boolean` - whether the player chose to Defend
- `defendResponse.armorValue: number` - armor applied
- `defendResponse.respondedBy: string` - user ID of the responding player
- `defendResponse.actionCost: number` - actions spent (1 for Defend, 2 for Interpose+Defend)

### Undo/Snapshot Pattern (General)

The existing `undoHealing` pattern (snapshot HP before apply, restore on undo) should be generalized as an architectural pattern for all apply-type actions.

**Pattern:**
1. On Apply: record `{ targetUuid: { hpBefore, tempHpBefore } }` snapshot in `system.applied[effectId]`
2. On Undo: read snapshot, restore HP values, delete snapshot record
3. UI: show "✓ Applied" with per-target breakdown when snapshot exists; show "↩ Undo" button

**Applies to:**
- Healing (existing - `system.appliedHealing[effectId]`)
- Damage (extend - `system.appliedDamage[effectId]` or similar)
- Future: any effect that modifies actor data and should be reversible

**Constraints:**
- Snapshots are point-in-time. If other damage/healing is applied between apply and undo, the undo restores to the *original* snapshot, not the intermediate state. This is acceptable - it's a correction tool, not a full transaction log.
- Only GM or message author can undo (same permission gate as apply).

### GM Helper: Context-Aware Modes

The GM Helper operates in two modes based on whether combat is active:

**Out of Combat:**
- Shows all world NPCs/monsters the GM has placed in the scene
- Used for prep, quick reference, and non-combat encounters
- No action economy or turn tracking

**In Combat:**
- Filters to current combatants only
- Shows per-creature: HP, conditions, action economy status
- Creature rows are expandable for full action/feature access
- Bulk operations available at section level (e.g., damage all creatures of a type)
- Boss creatures may show phase indicators (Bloodied thresholds)

**Data Source:**
- Out of combat: `canvas.scene.tokens` filtered to non-player actors
- In combat: `game.combat.combatants` with actor data via `.reactive`

### Action Economy & Variable Action Count

**Action Count is Variable:**
- Base: 3 actions per hero turn (standard Nimble rule)
- Modified by: initiative roll result, class features, effects, conditions
- Reactions (Defend, Opportunity Attack, Interpose, Help) cost 1 action each, deducted from the character's *next* turn
- Players can have more or fewer than 3 actions on any given turn

**Data Model:**
- `NimbleCombatant` needs fields for: `actionsTotal` (this turn's budget), `actionsUsed` (spent this turn), `reactionsUsedThisRound` (max 1 per round by default)
- Reaction spending during another creature's turn writes to the reacting combatant's data
- Action budget recalculates at start of turn: base (3) + modifiers - reactions spent since last turn

**Architectural Note:**
- This is combatant-level data, not actor-level. A creature's action budget is combat-specific state.
- The `ActionEconomyIndicator` component reads from combatant data, not actor data.

## Implementation Patterns & Consistency Rules

_Primary references: `docs/STYLE_GUIDE.md`, `CONTRIBUTING.md`, and `project-context.md`. This section covers only patterns specific to the architectural decisions in this document - not general coding conventions._

### Architecture-Specific Patterns

**New Rule Types:** camelCase naming (e.g., `abilityBonus`, `dicePool`, `resourceCounter`). Register in `src/config/registerRulesConfig.ts`. Follow the existing rule class pattern (`NimbleBaseRule` extension, schema definition, lifecycle hook implementation).

**Chat Card Extensions:** Prefer adding new node types to the effect tree over creating new card types. New card types only when the data model is fundamentally different from existing cards.

**GM Helper:** Built as a dockable `SvelteApplicationMixin(ApplicationV2)` - can run standalone or in sidebar. Accesses combat data reactively via `.reactive` pattern.

### Svelte 5 Reactivity (from official guidance)

- **`$derived` over `$effect`** - 90% of reactive code should use `$derived`. Never use `$effect` to synchronize state into another `$state` variable; refactor to `$derived`.
- **`$effect`** - Genuine side effects only (DOM manipulation, Foundry document sync, logging).
- **`.reactive` accessor** - Always access Foundry document data through `.reactive` in reactive contexts.

### Error Handling

- Catch errors at component boundaries - prevent errors from crashing sheets/applications
- Display errors via `ui.notifications.error()` - users must always know when something fails so they can report issues
- Log full error details to console for debugging
- Document updates: always `actor.update()` / `item.update()`, never direct mutation

### Enforcement

All conventions enforced through `docs/STYLE_GUIDE.md`, `project-context.md`, `pnpm run check`, Lefthook hooks, and code review. See those files for comprehensive rules.

## Project Structure & Boundaries

### Existing Project Structure

The project structure is established and documented in `docs/STYLE_GUIDE.md`. Key architectural boundaries within `src/`:

```
src/
├── nimble.ts                  # Single entry point (Vite library mode)
├── actions/                   # Svelte actions (draggable, etc.)
├── canvas/                    # Canvas layer overrides
├── config/                    # CONFIG.NIMBLE registration (rules, data models)
├── dice/                      # Dice mechanics and custom terms
├── documents/                 # Document classes (.svelte.ts)
│   ├── actor/                 # NimbleBaseActor + subtypes (character, npc, minion)
│   ├── canvas/                # Canvas document overrides
│   ├── combat/                # NimbleCombat + combat handlers
│   ├── combatant/             # NimbleCombatant
│   ├── dialogs/               # Document-level dialog logic
│   ├── item/                  # NimbleBaseItem + subtypes (feature, spell, etc.)
│   ├── sheets/                # Sheet classes (SvelteApplicationMixin + DocumentSheetV2)
│   └── token/                 # Token document overrides
├── enrichers/                 # Text enrichment (inline rolls, links)
├── etc/                       # Standalone utilities (Predicate, etc.)
├── hooks/                     # Foundry hook registrations
├── import/                    # Data import tools (Nimble Nexus)
├── managers/                  # Orchestrators (RulesManager, ItemActivationManager)
├── migration/                 # Schema migration scripts
├── models/                    # Foundry DataModel schemas
│   ├── activeEffect/          # Condition effect data
│   ├── actor/                 # Actor data models
│   ├── chat/                  # Chat card data models (10 types)
│   ├── combatant/             # Combatant data model
│   ├── fields/                # Custom DataModel fields
│   ├── item/                  # Item data models + activation components
│   └── rules/                 # Rule type DataModels (18+ types)
├── pixi/                      # PixiJS rendering (canvas graphics)
├── scss/                      # Global styles
├── settings/                  # Foundry settings registration
├── stores/                    # Svelte stores
├── utils/                     # Shared utilities
└── view/                      # Svelte components (.svelte)
    ├── chat/                  # Chat card components + sub-components
    ├── components/            # Shared UI components
    ├── dataPreparationHelpers/# View-layer data formatting
    ├── dialogs/               # Dialog components (creation, level-up, import)
    ├── handlers/              # UI event handlers
    ├── pixi/                  # PixiJS UI components
    ├── sheets/                # Actor/item sheet components + pages
    └── ui/                    # System UI (combat tracker, settings)
```

### Requirements to Structure Mapping

| FR Category | Primary Location | Notes |
|---|---|---|
| Character Management (FR1-9) | `documents/actor/`, `models/actor/`, `view/sheets/`, `view/dialogs/` | Existing, extend as needed |
| Dice Rolling & Combat (FR10-16) | `dice/`, `managers/ItemActivationManager`, `documents/item/` | Existing activation flow |
| Chat Cards (FR17-22) | `documents/chatMessage.ts`, `models/chat/`, `view/chat/` | Extend with new node types |
| Combat Tracker (FR23-30) | `documents/combat/`, `view/ui/CombatTracker.svelte` | Existing carousel |
| GM Helper (FR31-35) | `view/ui/` (new), `documents/sheets/` (new sheet class) | **New component** |
| Compendium (FR36-39) | `packs/` (project root), `models/item/` | Content additions |
| Rest & Recovery (FR40-41) | `documents/actor/`, `models/chat/` (rest cards) | Existing |
| Module Integration (FR42-44) | `hooks/` | Extend hook exports |
| Automation Toolbox (FR45-51) | `models/rules/` (new rule types), `config/registerRulesConfig.ts` | **New rule types** |
| Advanced Dice Roller (FR52-55) | `dice/`, `managers/`, `view/dialogs/` | **Phase 2 rework** |

### Where New Features Land

**GM Helper (Phase 1):**
- Sheet class: `src/documents/sheets/` (new `SvelteApplicationMixin(ApplicationV2)`)
- Svelte component: `src/view/ui/GmHelper.svelte` + `src/view/ui/components/`
- Settings: `src/settings/` (docking preference)

**New Chat Card Nodes (Phase 1):**
- Node components: `src/view/chat/components/` (new `.svelte` files)
- Node registration: `src/view/dataPreparationHelpers/effectTree/getNodeComponent.ts`

**New Rule Types (Phase 2):**
- Rule DataModels: `src/models/rules/` (new `.ts` files)
- Registration: `src/config/registerRulesConfig.ts`
- Tests: co-located `.test.ts` files

### Architectural Boundaries

**Document ↔ View boundary:** Document classes (`src/documents/`) handle data and business logic. View components (`src/view/`) handle rendering. They communicate through the `.reactive` accessor and Foundry's hook system. Views never mutate documents directly - they call `document.update()`.

**Model ↔ Document boundary:** DataModels (`src/models/`) define schemas and validation. Document classes wrap models with methods and lifecycle hooks. Models are pure data; documents are behavior.

**Rules ↔ Data Prep boundary:** Rules execute during the actor/item data preparation pipeline. They read from tags/domain and write to prepared data. Rules must not trigger document updates or side effects during data prep.

**Chat Card boundary:** Chat messages are self-contained after creation. Card components read from `messageDocument.reactive` and call action methods on `NimbleChatMessage`. No direct actor/item manipulation from chat card components - always go through message methods.

## Architecture Validation Results

### Coherence Validation

- Decision compatibility: All decisions extend existing patterns - no conflicts
- Pattern consistency: Naming, structure, and communication patterns align with established conventions
- Structure alignment: Every feature maps to a clear location in the existing directory hierarchy

### Requirements Coverage

- **55/55 Functional Requirements** architecturally supported (FR31-35 and FR45-51 as new extensions, rest via existing systems)
- **14/14 Non-Functional Requirements** addressed (performance via Svelte 5 reactivity, integration via FoundryVTT v13 API, accessibility via CSS custom properties)
- **All 4 phases** have clear architectural paths

### Implementation Readiness

- Existing codebase provides proven patterns for every architectural decision
- Style guide, project context, and contributing docs provide comprehensive implementation guidance
- New features (GM Helper, automation toolbox) follow established extension patterns
- No architectural rewrites needed between phases

### Minor Gaps (Non-Blocking)

1. GM Helper sidebar docking - exact Foundry v13 mechanism TBD at implementation
2. Dice roller Phase 2 transition - no abstraction; accepted trade-off
3. Data migration details - covered by existing `src/migration/` conventions

### Architecture Completeness Checklist

- [x] Project context analyzed with constraints and cross-cutting concerns
- [x] Existing technical foundation documented (brownfield)
- [x] Critical architectural decisions made (GM Helper, automation toolbox, chat cards)
- [x] Implementation patterns defined (reactivity, error handling, rule types)
- [x] Project structure mapped with FR-to-directory mapping
- [x] Architectural boundaries defined (document/view, model/document, rules/data-prep, chat card)
- [x] All requirements verified against architecture

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High - brownfield project with proven patterns; new features extend rather than replace.

**Key Strengths:**
- Mature rules engine directly supports Phase 2 automation toolbox
- Established reactive document bridge (`.reactive` + Svelte 5) is well-tested
- Clear separation of concerns (models → documents → views)
- Effect tree pattern provides composable, extensible chat card interactions

**Areas for Future Enhancement:**
- GM Helper docking mechanism investigation
- Dice roller abstraction if natural interface emerges
- Performance profiling under 20+ creature combat load once GM Helper is built

### Implementation Handoff

**AI Agent Guidelines:**
- Read `docs/STYLE_GUIDE.md`, `CONTRIBUTING.md`, and `project-context.md` before implementing
- Follow architectural boundaries: documents for logic, views for rendering, models for schemas
- Use `.reactive` accessor in all reactive contexts
- Register new rule types in `src/config/registerRulesConfig.ts`
- Add new chat card nodes via the effect tree pattern
- Use `pnpm run check` before submitting any changes

**First Implementation Priorities:**
1. Resolve remaining Phase 1 open issues
2. Chat card redesign with new role-based action nodes
3. GM Helper v1 as dockable ApplicationV2
