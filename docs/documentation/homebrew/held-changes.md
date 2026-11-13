---
title: "Held Changes and Damage Each Turn"
---

# Held Changes and Damage Each Turn

Two rules on the **Rules** tab of an [effect](effects.md) work at a later time: a held change waits for an attack, and damage each turn comes at the start or end of a turn.

## Hold a change for the next attack

An effect with a **Held Roll Change** rule (on its **Rules** tab) changes a later attack: the next attack of the creature that has it, or the next attack against that creature. The change can be advantage, a number added to the Primary Die, every die at its highest number, and more. With **The roll uses it up** on, the first attack that uses the change ends the effect, and the Lasts Until sentence starts with "until their next attack" or "until the next attack against them". The Lasts Until moments also end it in time.

For example, True Strike holds advantage for the next attack of its target, until the end of their next turn. The roll window shows a line for each held change that the attack uses. The card of the attack then has a line in **Events** for each change that the roll used up, with **Undo**.

With **Feature Effects** off, each held change is a tick box in the roll window, and no box starts ticked. Only a ticked change goes on the roll, and only a ticked change ends when the roll uses it up. A change you do not tick stays on.

![The roll window of Grug's Battleaxe: True Strike, +1 advantage, this roll spends it](/images/documentation/held-roll-window.png)

::: details More about held changes
- **Melee attacks only**: only a melee attack uses the change. A monster attack with no attack type is melee, but a monster area attack with none is neither melee nor ranged. A hero attack with no attack type is neither.
- **Only attacks by the creature that applied it**: for the next attack against the holder, only the creature that put the effect on uses it, as with Advance!.
- An area attack uses only the attacker's own changes, not the changes on a target. The one exception is **every die at its highest number** on a target: that target alone takes the highest total of the area roll, and the change is used up when the damage is applied.
- **Ranged attacks only** is the opposite of melee only.
- **Extra damage on a hit** adds a damage roll of its own type to the attack, such as `1d6` radiant. A miss deals none of it, but the attack still uses it up. An `@` reference in its formula takes the number from the creature that applied the effect, at the time it is applied: `1d@pools.judgment.faces` rolls that creature's Judgment Die size.
- A **Dice Consumer** rule set to **giveEffect** spends a die the player picks and puts the item's effect (one that does not go on the owner) on each creature they target, as Shining Mandate does. With no target, nothing is spent.
- Out of combat, a change that a feature holds for you (Assess, for example) is not held.
- **Ignore all disadvantage** lasts for your next action. A Move, a paid Assess or an item use that costs an action and is not an attack also ends it. The card of that action has the line in **Events**, with **Undo**.
- With **Feature Effects** off, a kept amount also starts unticked. With no roll window (Alt-click), no change goes on the roll.
- With **Feature Effects** off, some changes have no roll window to tick them, so they do not apply and do not end: a one-use vulnerability, **every die at its highest number** on a target of an area attack, and every change in a minion group attack. An action that is not an attack does not end **Ignore all disadvantage**. Apply these by hand, and remove the effect when it is used.
:::

## Damage each turn

A **Damage each turn** rule deals damage, gives Wounds, or both, at each turn of a creature. Put it on an effect for a hazard that lasts ("1d20 fire damage/turn" while in a cauldron), or on an item for a monster that always hurts the creatures next to it (a burning aura). **Who takes it** is the creature that has the rule, or each other creature within **Reach** of it, allies too. **When** is the start of that creature's turn, or its end. **Damage** is dice or a number, rolled each time, with a **Damage type**. **Wounds** gives that many Wounds, up to the max of the track: "1 Wound/round" is Wounds 1 with no damage.

The damage ignores armor and Defend, as damage from outside an attack does: temp HP go first, then HP. Each time is a line in **Events** on the card of that turn start or end, with **Undo**, which gives back the HP, temp HP and Wounds it took. An effect that ends at that moment deals nothing at it. A dead or defeated creature takes nothing and deals nothing. With **Feature Effects** off, the line has a **Take Damage** button for the creature's owner or the GM.

::: details More about damage each turn
- A creature with no Wound track (a monster) takes the damage and no Wounds.
- The damage counts as "they take damage" for Lasts Until and Save on an Event, with its type: lightning damage makes the creature Charged.
- A turn played again after the GM goes back in the combat tracker deals nothing a second time.
- The line goes on the card, and shows as dealt, before the damage is dealt. When the line cannot be written, nothing is dealt. When the damage cannot be dealt, the line waits again.
- A creature with more than one turn in a round takes it on each turn.
- **Undo** is not healing: an effect that lasts until its holder is healed stays.
:::
## Related pages

- [Effects](effects.md)
- [Lasts Until, Stacks and Escape](lasts-until.md)
- [Dice Rolls & Chat Cards](../playing/dice-and-chat.md)
- [Rules Builder](../rules-builder/index.md)
