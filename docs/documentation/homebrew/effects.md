---
title: "Effects and Lasts Until"
---

# Effects and Lasts Until

An effect is something that is on a creature for a time: a condition, a change to its numbers from a spell, a mark from a feature. Each effect has its own window, where you set what it does and how long it lasts.

## Open the effect window

On the character or NPC sheet, go to the **Effects** tab and click the pen at the end of the effect's row. An effect that an item keeps on (a passive effect of armor, for example) opens its item instead, because you change it there. The pen of a condition opens the effect that gives it. A condition with no effect of its own on the creature, such as Bloodied or a condition that an item keeps on, has no pen.

The window has four tabs:

- **Details**: **Off** (its changes and rules do not apply), for an effect on an item **Apply to the actor** (the actor that has the item gets the effect), the **Conditions** that the effect gives, and the description.
- **Lasts Until**: the moments that end the effect, and its Escape.
- **Changes**: core changes to the data of the creature, one row each: a key, a type, a value and a priority.
- **Rules**: the [Rules Builder](../rules-builder/index.md), the same as on an item. The rule types that work only on an item, such as Grant Item, are not in its list.

Each field saves when you change it.

An effect on an item with **Apply to the actor** off goes on a creature from the item's card, through an [Apply Effect](activations.md#apply-effect) entry. A rule can also pick one, for example the **Effect on the attacker** of a Defend Option rule: a copy goes on the attacker when the hero Defends. An Apply Condition rule can name one as its **Effect**: when the rule fires, a copy goes on the creature in place of the bare condition, with the Lasts Until of the effect. A Toggle Effect rule can name one as its **Effect**: while the toggle is on, the character has a copy of it, and the copy ends by its Lasts Until. A Modify Toggle rule on another feature can take moments out of that copy with **Does not end when**. A Mark Target rule can name one as its **Effect**: the marker on each marked creature gets its Lasts Until, changes and rules, and the mark ends when the marker ends.

![The Details tab of an effect: State, and the Conditions with Invisible picked](/images/documentation/effect-window-conditions.png)

## Lasts Until

![The Lasts Until tab: until the end of their next turn, or until you drop to 0 HP, or until 1 minute passes; Escape DC 10 + @intelligence with a STR or DEX save](/images/documentation/effect-window-lasts-until.png)

The tab is a sentence. Each row is one moment, and each word in a box is a choice. Use **add a moment...** to add a row, and the trash button to remove one.

| Moment | Reads as |
| --- | --- |
| A turn or a round | until **the end of** **their** **next turn**; until **the start of** the **next round** |
| Rounds or time | until **1** **minutes** pass |
| They or you do something | until **they** **attack**; until **you** **drop to 0 HP** |
| Another effect ends | until **the effect** **Rage** ends |

"Their" is the creature that has the effect. "Your" is the creature that used the item that applied it, as in the book. "The next hero's" is the next turn of any hero.

They can attack, move, cast a spell, cast a tiered spell, make a roll (an attack, a save or a check), deal damage, take damage, be Healed, drop to 0 HP or die. You can attack, cast a spell, drop to 0 HP, die, lose Concentration or use this again.

The first moment that happens ends the effect. An effect with no moment stays until someone removes it. An older effect can also have a core duration, such as 1 round; the tab shows it, and it still ends the effect. When an effect ends, the chat says so, with an Undo button: see [How long a condition lasts](../playing/conditions.md#how-long-a-condition-lasts).

## Hold a change for the next attack

An effect with a **Held Roll Change** rule (on its **Rules** tab) changes a later attack: the next attack of the creature that has it, or the next attack against that creature. The change can be advantage, a number added to the Primary Die, every die at its highest number, and more. With **The roll uses it up** on, the first attack that uses the change ends the effect, and the Lasts Until sentence starts with "until their next attack" or "until the next attack against them". The Lasts Until moments also end it in time.

For example, True Strike holds advantage for the next attack of its target, until the end of their next turn. The roll window shows a line for each held change that the attack uses.

::: details More about held changes
- **Melee attacks only**: only a melee attack uses the change. An attack with no attack type counts as melee.
- **Only attacks by the creature that applied it**: for the next attack against the holder, only the creature that put the effect on uses it, as with Advance!.
- An area attack uses only the attacker's own changes, not the changes on a target.
- **Extra damage on a hit** adds a damage roll of its own type to the attack, such as `1d6` radiant. A miss deals none of it, but the attack still uses it up. An `@` reference in its formula takes the number from the creature that applied the effect, at the time it is applied: `1d@pools.judgment.faces` rolls that creature's Judgment Die size.
- A **Dice Consumer** rule set to **giveEffect** spends a die the player picks and puts the item's effect (one that does not go on the owner) on each creature they target, as Shining Mandate does. With no target, nothing is spent.
- Out of combat, a change that a feature holds for you (Assess, for example) is not held.
:::

## Escape

Escape is the way out of an effect such as Restrained. Set the **DC** (a number or a formula, such as `10 + @intelligence`) and turn on the saves the holder can roll: STR, DEX, INT, WIL, or any set of them. A new effect has STR and DEX on. With no DC, the effect has no escape.

## Related pages

- [Conditions](../playing/conditions.md)
- [Rules Builder](../rules-builder/index.md)
- [Item Activations & Effects](activations.md)
