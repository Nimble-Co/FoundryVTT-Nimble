---
title: "Actor Sheets"
outline: deep
---

# Actor Sheets

This page is for contributors. It tells you how the new character sheet and the new NPC sheet are built, and where to put a change. The decision record is ADR 0004 ("new actor sheets are Hero and Monster over a pure view model").

The new sheets are in `src/view/actorSheets/`. They do not import from `src/view/sheets/` (the old sheets). A dependency-cruiser rule in CI stops such an import.

```
src/view/actorSheets/
  parts/     the parts: .svelte files and types.ts. Plain props only.
  shared/    view model code that both sheets use, and the sheet UI state
  hero/      the character sheet: Application, root component, view model, sections
  monster/   the NPC sheet (comes later)
```

The code names are `HeroSheet` (for `character`) and `MonsterSheet` (for `npc`, `soloMonster` and `minion`). Foundry stores the class name as the sheet id, so these names do not change. The words that users see stay "character sheet" and "NPC sheet".

## The flow of data

```
actor.reactive ──adapter──▶ { actor: ActorLike, context: SheetContext }
                                   │
                                   ▼
                   view functions (pure): heroRail(), heroCoreTab(), heroFrame()
                                   │  typed views with intents
                                   ▼
                    sections ──▶ parts (plain props)
                                   │  a click sends an intent
                                   ▼
                          perform(intent) ──▶ Foundry
```

### The adapter

`hero/heroAdapter.ts` builds the input of the view model from `actor.reactive`, the combat of this scene and the pools. The input is plain data:

- `HeroActorLike`, `ItemLike`, `EffectLike` and `RuleLike` hold only the fields that the views read.
- `HeroSheetContext` holds the facts from Foundry globals: the combat state, the missed level choices, the names of conditions, damage types, languages and armor types, the dice pools and charge pools, and the `localize` and `format` functions.

The adapter is the only view model code that reads Foundry. Keep Foundry calls out of the view functions.

### View functions

Each tab has one pure function, the rail has one, and the frame (tabs and edit band) has one: `heroRail(actor, context)`, `heroCoreTab(actor, context)`, `heroFrame(context)`. A view function gives back a typed view: final strings (through the injected `localize` and `format`), numbers, and intents. It does not read Foundry, so its unit tests need no Foundry mocks.

- The view gives every string that a section shows: headings, button labels, tooltips and the labels for screen readers. A section never calls `localize`. So the localizer stub of the tests checks every key. A part can still localize its own fixed labels.
- Language keys for the views are under `NIMBLE.actorSheet.{parts,shared,hero,monster}`. Use a key that exists when its words are correct for the place.
- A place with no data is empty: the function gives back an empty list or `null`, and the section shows the empty state.
- No code for one class. A place is for a kind of data, and each class item lands in the place of its kind.
- No TypeScript picks a colour. A view gives a key (an ability key, a pool kind). The part or section sets `--tone` from a token, and CSS mixes it. Use a token that each theme class sets (for example `--nimble-ui-tone-mix`), not a `.theme-dark` ancestor selector: a sheet can have its own theme inside a page of the other theme.

The root component calls each view function in a `$derived`. A `$derived` runs only when something reads it, so only the place that shows recomputes.

### Intents and `perform`

An intent is plain data that says what the user asks for, for example `{ kind: 'setHp', value: 12 }` or `{ kind: 'configure', target: 'skills' }`. The views hold the intents for their controls. A control that you cannot use now has no intent: the view gives `null` and, where it helps, a reason in words.

`hero/heroIntent.ts` has the `HeroIntent` union. `hero/heroPerform.ts` has `createHeroPerform(actor)`, the dispatcher. It is the only place with side effects: actor methods, `actor.update`, dialogs, pool helpers and combat helpers. Its `switch` has a `never` check, so a new intent kind does not compile until `perform` handles it.

To add an intent:

1. Add the kind to `HeroIntent`.
2. Handle it in `createHeroPerform`.
3. Add a test in `hero/__tests__/heroPerform.test.ts` that checks the Foundry call or the dialog.
4. Give the intent from the view function that has the control.

UI state is not an intent. The tab, edit mode, the open rows, the open choice step, the ConfirmBar that asks and the row to flash are in `SheetUiState` (`shared/sheetUiState.ts`). A section changes that state directly.

### `reveal()`

Outside code (the heroic action macro, the dice pool spend request, drop feedback) must not reach into the sheet. It calls `sheet.reveal({ tab, rowId?, step?: 'choice', flash?: true })`:

- `tab` selects the tab.
- `rowId` with `step: 'choice'` opens the choice step of that row.
- `rowId` with `flash: true` scrolls to the row and flashes it.

The UI state is on the Application, so it exists before the sheet renders. When the sheet is closed, `reveal()` renders it. Each row has a `data-row-id` attribute; `reveal()` and the tests find rows by it.

### The Application

`hero/HeroSheetApplication.svelte.ts` has the `HeroSheet` class (`ActorSheetV2` with `SvelteApplicationMixin`). It gives the root component three props: `source` (the adapter), `ui` (its `$state`) and `perform` (the Foundry dispatcher). It also runs the level choice audit and primes the combat mana rules.

The file name is not `HeroSheet.svelte.ts`: TypeScript resolves `./HeroSheet.svelte` to a `.svelte.ts` file with the same name first, and then the root component import gets the class type.

The character sheet opens at 720 x 850. Below 560 px it changes to the narrow form (a header, the tabs and a strip of meters). A ResizeObserver on the root measures the width.

## Parts and sections

A part (`parts/`) takes plain props only and never reads the actor. It may import other parts, its props type, Svelte and the `localize` helper, nothing else; a dependency-cruiser rule checks this. Each part has a story in `storybook/parts/`. A sheet does not style a part from its own files: a size or a state that one sheet needs is a named prop or variant on the part.

A section (`hero/sections/`) takes a view, the UI state where it needs it, and `perform`. It sends the intents of its view and builds the intents that carry a typed value (for example `setHp` with the number that you typed).

The props type of each part, section and root is in `types/components/actorSheets/<Name>.d.ts` as `<Name>Props`, as AGENTS.md asks for all components.

`shared/sheetFrame.svelte.ts` has the code that both sheet roots use: `trackWidth()` (the ResizeObserver) and `flashRows()` (the flash of `reveal()`).

## Tests

- View functions: unit tests in `__tests__` beside the code, with the fixtures in `tests/fixtures/actorSheets/` (`blankHero()`, `heroContext()`, `heroTurn()`). The fixture context uses a localizer stub: it gives back the key (and the data for `format`), and it fails the test when the key is not in `public/lang/en.json`.
- `perform`: one test for each intent kind.
- Sections and the root: component tests with `@testing-library/svelte`, a view object and a `perform` spy. Find elements by role and accessible name, or by `data-row-id`. No `data-testid`, and no part class names in selectors. Name a test file `*.svelte.test.ts` when it needs `$state` for the UI state.

## Storybook

Storybook runs the real view model with no Foundry:

```bash
pnpm storybook        # dev server on port 6006
pnpm storybook:build  # what CI builds
```

`storybook/sheets/` has the sheet stories over the same fixtures as the tests, with a `perform` that only logs. The story harness keeps the actions left, so you can spend an action, and a `nimble-story:reveal` event on `window` calls `revealIn` the way outside code calls `sheet.reveal()`. `storybook/parts/` has one story for each part. Use the theme switch in the toolbar to see both themes; every change must work in light and dark.

## Checks

CI runs the tests, `type-check`, `lint`, `circular-deps`, the Storybook build and `pnpm check:svelte-sheets`. The last one runs `svelte-check` and fails only on problems in `src/view/actorSheets/` and `storybook/`, because the old code does not pass `svelte-check`.
