# Nimble Sheet Selectors & Patterns

## Opening Sheets
- Double-click actor name element in Actors sidebar to open sheet.
- The NCSW panel may intercept pointer events; hide it first via the crosshairs toggle.

## Sheet Form ID Pattern
- Player character: `PlayerCharacterSheet-Actor-{actorId}`
- Find actorId via: `game.actors.getName("Mage").id`

## Tab Navigation
- Tab buttons: `button[aria-label="Core"]`, `button[aria-label="Spells"]`, etc.
- Available tabs: Core, Conditions, Inventory, Features, Spells, Bio, Settings
- Must use Playwright `browser_click` with snapshot ref (NOT `evaluate + .click()`) for reliable
  Svelte state updates — the `.click()` DOM method does not trigger Svelte event handlers.
- Tab content is fully re-rendered by Svelte on each switch (single content area, not hidden panels).

## Sheet Structure (Svelte 5 / ApplicationV2)
- Root form: `.nimble-sheet.nimble-sheet--player-char` (PC) or `.nimble-sheet` (NPC)
- Header: `.nimble-sheet__header`
- Nav: `navigation[ref]` containing `list > listitem > button` per tab
- Nav labels (sidebar): `.nimble-primary-navigation__current-tab-label` (always all 7 visible)
- Content area: single div re-rendered by Svelte on tab switch
- No `aria-selected`, `role="tabpanel"`, or `data-tab` on sheet tab buttons — pure Svelte state

## Closing Sheets
- `button[aria-label="Close Window"]` in sheet banner — works reliably.

## Known Actors in Midgard World
- Mage (PC, Halfling, Mage class Lv3) — HP 14/18, Mana 0/12
- Berserker (NPC, Human, Berserker) — HP 20/20, in Monsters folder
- Rouge (PC) — in root actors list
- New Character (PC) — in active combat
- Cultist (NPC) — in active combat, Monsters/Cultists folder
