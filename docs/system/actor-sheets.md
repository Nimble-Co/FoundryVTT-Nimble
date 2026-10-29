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
  monster/   the NPC sheet: Application, root component, view model, sections
```

The code names are `HeroSheet` (for `character`) and `MonsterSheet` (for `npc`, `soloMonster` and `minion`). Foundry stores the class name as the sheet id, so these names do not change. The words that users see stay "character sheet" and "NPC sheet".

## The flow of data

```
actor.reactive ──adapter──▶ { actor: ActorLike, context: SheetContext }
                                   │
                                   ▼
                   view functions (pure): heroRail(), heroFrame(), hero<Tab>Tab() for each of the 8 tabs
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
- `HeroSheetContext` holds the facts from Foundry globals: the combat state (with the reactions used this round), the missed level choices, the names of conditions, damage types, languages, armor types and spell schools, the dice pools and charge pools, the names of the targets, and the `localize` and `format` functions.
- `context.itemState` holds what the system works out for each item (`hero/heroItemState.ts`): the action cost with the action cost rules, the charge pools of the item (`getPoolsForItem`, hidden pools left out), the charge gate (`validateItemChargeConsumption`, only with resource spending on), the toggle effect and whether it is on, and the dice consumers in manual mode.

The adapter is the only view model code that reads Foundry. Keep Foundry calls out of the view functions.

### View functions

Each tab has one pure function, the rail has one, and the frame (tabs, the Effects count and edit band) has one: `heroRail`, `heroFrame`, `heroCoreTab`, `heroActionsTab`, `heroFeaturesTab`, `heroInventoryTab`, `heroSpellsTab`, `heroEffectsTab`, `heroBioTab` and `heroSettingsTab`. Each takes `(actor, context)`. A view function gives back a typed view: final strings (through the injected `localize` and `format`), numbers, and intents. It does not read Foundry, so its unit tests need no Foundry mocks.

- The view gives every string that a section shows: headings, button labels, tooltips and the labels for screen readers. A section never calls `localize`. So the localizer stub of the tests checks every key. A part can still localize its own fixed labels.
- Language keys for the views are under `NIMBLE.actorSheet.{parts,shared,hero,monster}`. Use a key that exists when its words are correct for the place.
- A place with no data is empty: the function gives back an empty list or `null`, and the section shows the empty state.
- No code for one class. A place is for a kind of data, and each class item lands in the place of its kind.
- No TypeScript picks a colour. A view gives a key (an ability key, a pool kind). The part or section sets `--tone` from a token, and CSS mixes it. Use a token that each theme class sets (for example `--nimble-ui-tone-mix`), not a `.theme-dark` ancestor selector: a sheet can have its own theme inside a page of the other theme.

### Rows

The list tabs are groups of rows (`HeroRowGroup`, `HeroRowView` in `hero/heroRows.ts`). `itemRow()` builds the row of an item, and `hero/heroicRows.ts` builds the rows of the built-in heroic actions (id `heroic-<actionId>`). A row view has:

- `use`: what a click does. `act` sends its intent at once; `choose` opens the choice step of the row; `blocked` does nothing and gives the reason (for example "Used this round" from the charge gate).
- `choice`: the choice step under the row, or `null`. `options` (a list of buttons, with lines such as the target name), `twoStep` (Assess: an option, then a skill) or `dice` (the dice pool spend: pick dice, then Spend). The picks while the step is open are local state of the section; `spendIntent()` makes the intent from them.
- `edit`: the intent of the pen, `drag`: what a drag gives (`shared/drag.ts`), `fields`: the numbers that you type in edit mode.
- `remove`: Delete in edit mode. Foundry v14 item windows have no Delete, so the row has a trash button that asks in a ConfirmBar first.
- `descriptionHtml`: the description as Foundry enriches it (inline rolls, links). The Application enriches only the open item rows; until then the row shows the plain `description`.
- Inventory rows also have `equip` (the EQUIP tag), `storeIn` (the "Store in" select in edit mode), `indent` (a stored object) and `dropInto` (the container that a drop on the row goes in).

`shared/placeOf.ts` decides where a feature goes (Actions, Reactions or only Features), and `shared/rowOrder.ts` has the order of a group (A to Z, spells by tier or by school).

The root component calls each view function in a `$derived`. A `$derived` runs only when something reads it, so only the place that shows recomputes.

### Intents and `perform`

An intent is plain data that says what the user asks for, for example `{ kind: 'setHp', value: 12 }` or `{ kind: 'configure', target: 'skills' }`. The views hold the intents for their controls. A control that you cannot use now has no intent: the view gives `null` and, where it helps, a reason in words.

`hero/heroIntent.ts` has the `HeroIntent` union. `hero/heroPerform.ts` has `createHeroPerform(actor)`, the dispatcher. It is the only place with side effects: actor methods, `actor.update`, dialogs, pool helpers and combat helpers. Its `switch` has a `never` check, so a new intent kind does not compile until `perform` handles it.

To add an intent:

1. Add the kind to `HeroIntent`.
2. Handle it in `createHeroPerform`.
3. Add a test in `hero/__tests__/heroPerform.test.ts` that checks the Foundry call or the dialog.
4. Give the intent from the view function that has the control.

UI state is not an intent. The tab, edit mode, the open rows (`openRows`; on a tab where the text starts open, the closed rows in `closedRows`), the open choice step, the ConfirmBar that asks and the row to flash are in `SheetUiState` (`shared/sheetUiState.ts`). A section changes that state through the functions in that file (`showTab`, `setEditing`, `askConfirm`, `closeConfirm`, `toggleRow`, `setOpenRows`, `toggleClosedRow`, `setClosedRows`, `toggleChoice`, `closeChoice`, `revealIn`), not with an assignment in its template. Svelte warns when a nested component writes to a prop that its parent did not bind.

### `reveal()`

Outside code (the heroic action macro, the dice pool spend request, drop feedback) must not reach into the sheet. It calls `sheet.reveal({ tab, rowId?, step?: 'choice', flash?: true })`:

- `tab` selects the tab.
- `rowId` with `step: 'choice'` opens the choice step of that row.
- `rowId` with `flash: true` scrolls to the row and flashes it.

The UI state is on the Application, so it exists before the sheet renders. When the sheet is closed, `reveal()` renders it.

Three callers use it now. The heroic action macro opens the choice step of Assess or Opportunity Attack, or the Actions or Spells tab. The `dicePool.requestSpend` router opens the dice spend step of the item row (Spells for a spell, the Inventory for an object other than an equipped weapon, else Actions). A drop shows and flashes the row on its tab. Both find the new sheet with `asRevealable()` (`shared/revealable.ts`) and keep the old sheet path until the old sheets are deleted. Each row has a `data-row-id` attribute; `reveal()` and the tests find rows by it.

### The Application

`hero/HeroSheetApplication.svelte.ts` has the `HeroSheet` class (`ActorSheetV2` with `SvelteApplicationMixin`). It gives the root component three props: `source` (the adapter), `ui` (its `$state`) and `perform` (the Foundry dispatcher). It also runs the level choice audit, primes the combat mana rules, and enriches the Bio notes and the open row descriptions (enrichment is async, so the adapter gets the results through its extras).

### Drops

`HeroSheet._onDrop` takes every Item drop on the sheet; other drops go to the core handler. An Inventory row and the Inventory list take their own drop and stop it, with the place of the drop (a container id, or empty for loose). `hero/heroDrop.ts` (`dropAction`) decides what the drop does: create the item through the shared drop route (`routeItemDrop`), store a carried object in a container, take it out, or show the row of a carried item. After the drop, `reveal({ tab, rowId, flash: true })` shows the row. There is no hand sorting.

The file name is not `HeroSheet.svelte.ts`: TypeScript resolves `./HeroSheet.svelte` to a `.svelte.ts` file with the same name first, and then the root component import gets the class type.

The character sheet opens at 720 x 850. Below 560 px it changes to the narrow form (a header, the tabs and a strip of meters). A ResizeObserver on the root measures the width.

## The NPC sheet

`monster/` has the same layers as `hero/`, for the `npc`, `soloMonster` and `minion` actor types. It imports from `parts/` and `shared/`, never from `hero/`.

- `monsterAdapter.ts` (`createMonsterSource`) gives `MonsterActorLike` and `MonsterSheetContext` (`monsterSource.ts`): the condition, damage type and size names, the charge pools of each item, whether the user may change the monster, the enriched notes and descriptions, and the import credit line.
- The view functions are `monsterRail` (portrait, HP or the minion rules, saves, armor and speeds, defenses), `monsterFrame` (four tabs: Abilities, Effects, Notes, Settings), `monsterAbilitiesTab`, `monsterEffectsTab`, `monsterNotesTab` and `monsterSettingsTab`.
- The Abilities tab has the groups Features, Actions, Bloodied and Last Stand, in the order of the item `sort` field. An attack sequence is in Actions, with its actions nested under it. An item with no description and no effects is a heading line. The text of each card starts open, so the open state is in `closedRows`.
- Hand sorting: `monsterReorder.ts` has `dropPlace()` (a line above or below the target, or nest below an attack sequence; a drop works only in the same group) and `reorderIntent()` (one `reorder` intent with the new `sort` of each ability in the group and the `parentItemId` of the dragged action). A drag that starts on the tab is a reorder: the row takes the drop and stops it. A drop from outside goes on to `MonsterSheet._onDrop`, which creates the item through `routeItemDrop` and then flashes the card.
- `monsterIntent.ts` has the `MonsterIntent` union, and `monsterPerform.ts` has `createMonsterPerform(actor, sheet)`, with a test for each kind in `monster/__tests__/monsterPerform.test.ts`.
- `MonsterSheetApplication.svelte.ts` has the `MonsterSheet` class. It opens at 660 x 650; below 560 px it changes to the narrow form (a header with the HP, the rail without the portrait, and a strip of tabs).

Both sheets build the Effects tab from `shared/`: `effectLists.ts` (the lists, the count on the tab, the duration words), `effectsTab.ts` (the rows, their intents and the condition grid), `effectActions.ts` (End, Remove, a condition on or off) and `ConditionGrid.svelte`. `shared/documentLikes.ts` turns items, effects and conditions into their `*Like` types and registers the redraw hooks. `shared/textEnricher.svelte.ts` enriches the notes and the open descriptions. `shared/SheetPortrait.svelte` is the portrait with its image offsets and scale.

## Parts and sections

A part (`parts/`) takes plain props only and never reads the actor. It may import other parts, its props type, Svelte and the `localize` helper, nothing else; a dependency-cruiser rule checks this. Each part has a story in `storybook/parts/`. A sheet does not style a part from its own files: a size or a state that one sheet needs is a named prop or variant on the part.

A section (`hero/sections/`, `monster/sections/`) takes a view, the UI state where it needs it, and `perform`. It sends the intents of its view. Where the user types a value, the view gives a function that makes the intent from it (for example a Settings number), or the section builds an intent that carries only that value (for example `setHp` with the number that you typed).

The props type of each part, section and root is in `types/components/actorSheets/<Name>.d.ts` as `<Name>Props`, as AGENTS.md asks for all components.

`shared/sheetFrame.svelte.ts` has the code that both sheet roots use: `trackWidth()` (the ResizeObserver) and `flashRows()` (the flash of `reveal()`). `shared/gridKeys.ts` moves the focus in a grid of buttons with the arrow keys (the condition grid). When the script of a section is longer than 30 lines, its logic goes in a co-located `.svelte.ts` file, as `HeroRow.svelte.ts`.

## Tests

- View functions: unit tests in `__tests__` beside the code, with the fixtures in `tests/fixtures/actorSheets/` (`blankHero()`, `heroContext()`, `heroTurn()`, and `containerHero()`, `featureHero()`, `effectsHero()` for the other tabs; `goblin()`, `soloMonster()`, `minion()`, `monsterContext()` and `effectsMonster()` for the NPC sheet). The fixture context uses a localizer stub: it gives back the key (and the data for `format`), and it fails the test when the key is not in `public/lang/en.json`.
- `perform`: one test for each intent kind.
- Sections and the root: component tests with `@testing-library/svelte`, a view object and a `perform` spy. Find elements by role and accessible name, or by `data-row-id`. No `data-testid`, and no part class names in selectors. Name a test file `*.svelte.test.ts` when it needs `$state` for the UI state.
- Live: `tests/integration/heroSheet.test.ts` opens the sheet in Foundry v14 and uses its controls (tabs, rows, the EQUIP tag, HP, rest, drops, the window menu, Escape, the condition grid, the pools, a combat turn, the macro and the spend request). See `tests/integration/README.md` to run it.

## Storybook

Storybook runs the real view model with no Foundry:

```bash
pnpm storybook        # dev server on port 6006
pnpm storybook:build  # what CI builds
```

`storybook/sheets/` has the sheet stories over the same fixtures as the tests, with a `perform` that only logs. The story harness keeps the actions left, so you can spend an action, and a `nimble-story:reveal` event on `window` calls `revealIn` the way outside code calls `sheet.reveal()`. `storybook/parts/` has one story for each part. Use the theme switch in the toolbar to see both themes; every change must work in light and dark.

## Checks

CI runs the tests, `type-check`, `lint`, `circular-deps`, the Storybook build and `pnpm check:svelte-sheets`. The last one runs `svelte-check` and fails only on problems in `src/view/actorSheets/` and `storybook/`, because the old code does not pass `svelte-check`.
