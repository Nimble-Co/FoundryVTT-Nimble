---
title: "Macros & the Hotbar"
---

# Macros & the Hotbar

Nimble's macro story is deliberately simple: drag things to the hotbar, get one-click buttons. For most tables, that's the whole page.

## Drag it to the hotbar

Drag a weapon, spell, feature, or inventory item from a character or monster sheet down to the hotbar. The system creates a button with the item's name and icon: no writing, no configuration.

<!-- TODO(screenshot): dragging a weapon from the character sheet to the hotbar, with the created button visible -->

Clicking the button activates the item for whichever token you currently have selected (or your assigned character if none is selected), exactly as if you'd clicked it on the sheet: the roll window opens if the item asks questions, the result posts to chat as a card, and, if you're in combat, the item's action cost is deducted from your action pips automatically.

Heroic actions and reactions work the same way: drag one from the **Actions** tab of the character sheet to get a hotbar button for it. Simple ones like *Move*, *Unarmed Strike*, *Defend*, *Interpose*, and *Help* resolve directly (spending the reaction and posting the chat card, with a confirmation prompt if you're bending the usual limits); ones that need a decision, like *Attack* or *Opportunity Attack*, open your sheet at the right panel so you can pick a weapon.

A few things worth knowing:

- The button looks the item up **by name** on the current token's actor. That's what makes one "Longsword" button work for every fighter in the party, but it also means renaming the item breaks the button, and if an actor carries two items with the same name, the first one wins (you'll get a warning).
- The item must be **owned by an actor** when you drag it. Dragging straight from a compendium or the items sidebar won't create a button.
- If your selected token has no item with that name, the button warns you instead of doing nothing.

::: tip Players can do this too
Hotbar buttons aren't a GM tool. Encourage players to drag their two or three most-used attacks and spells down before the first session. It noticeably speeds up combat.
:::

## For tinkerers

The helpers behind those buttons live at `game.nimble.macros`, and you can call them from your own script macros. There are four:

**`activateItemMacro(itemName)`** activates an item by name on the selected token's actor. This is the entire body of every drag-created item button. Paste this and change the name:

```js
game.nimble.macros.activateItemMacro('Longsword');
```

**`activateHeroicActionMacro(actionId, actionType)`** performs a heroic action (`'attack'`, `'spell'`, `'move'`, `'assess'`, `'unarmedStrike'`) or reaction (`'defend'`, `'interpose'`, `'interposeAndDefend'`, `'help'`, `'opportunity'`) for the selected character. Paste this and change the two words:

```js
game.nimble.macros.activateHeroicActionMacro('defend', 'reaction');
```

**`createMacro(data, slot)`** lets you build the hotbar button for an item yourself, given its identifier and a hotbar slot number. This is what the drag-and-drop calls:

```js
game.nimble.macros.createMacro({ uuid: item.uuid }, 1);
```

**`createHeroicActionMacro(data, slot)`** does the same for a heroic action button:

```js
game.nimble.macros.createHeroicActionMacro(
  { actionId: 'interpose', actionType: 'reaction', name: 'Interpose' },
  2,
);
```

## Beyond this page

That's the entire macro surface the system commits to. Anything fancier (custom dialogs, world scripts, cross-actor automation) is Foundry module territory rather than something this system documents or guarantees.

And before you reach for a script at all: if the goal is "make my homebrew feature *do* something" (add a bonus, apply a condition on a hit, grant a resource), that isn't a macro job. The [Rules Builder](../rules-builder/index.md) does it declaratively, survives updates, and shows up properly on sheets and chat cards.

## Related pages

- [Rules Builder](../rules-builder/index.md)
- [Homebrew Activations](../homebrew/activations.md)
- [Dice & Chat](../playing/dice-and-chat.md)
