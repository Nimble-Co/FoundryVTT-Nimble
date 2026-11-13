---
title: "Effects and Lasts Until"
---

# Effects and Lasts Until

An effect is something that is on a creature for a time: a condition, a change to its numbers from a spell, a mark from a feature. Each effect has its own window, where you set what it does and how long it lasts.

## How an effect works

Every effect goes the same way. In this example, Tessa casts True Strike on Grug.

**1. It goes on.** The card has an **Effects** part. An effect for the targets has an **Apply to Targets** button. An effect for the creature that uses the item goes on by itself. The line under the name says how long the effect lasts.

![Tessa's True Strike card: Grug is the target, and the Effects part has True Strike, until their next attack or the end of their next turn, with Apply to Targets](/images/documentation/effect-life-1-card.png)

**2. It shows on the sheet.** The **Effects** tab of the creature lists the effect and its Lasts Until.

![The Effects tab of Grug's sheet: True Strike, until your next attack, or until the end of your next turn](/images/documentation/effect-life-2-sheet.png)

**3. It ends.** The first moment in its Lasts Until ends it. When a roll or a use ends it, a line goes in the **Events** part at the bottom of that card. Here Grug's attack used the advantage.

![Grug's Battleaxe card: advantage on the roll, and in Events, True Strike ended on Grug, this roll used it, with Undo](/images/documentation/effect-life-3-ended-line.png)

When nothing in the chat ended it, such as the end of a turn, one message for that moment has a line for each effect that ended.

![The message for the end of Grug's turn: True Strike ended on Grug, until the end of your next turn, with Undo](/images/documentation/effect-life-4-moment.png)

**4. Undo puts it back.** **Undo** on the line puts the effect back on the creature, and the line then says "On Grug". The owner of the creature and the GM can use it. The effect keeps its old start, so it ends again at the next moment that matches.

![The same Battleaxe card after Undo: the line says On Grug](/images/documentation/effect-life-3b-undone.png)

A GM must be connected for an effect to end by itself.

## Open the effect window

On the character or NPC sheet, go to the **Effects** tab and click the pen at the end of the effect's row. An effect that an item keeps on (a passive effect of armor, for example) opens its item instead, because you change it there. The pen of a condition opens the effect that gives it. A condition with no effect of its own on the creature, such as Bloodied or a condition that an item keeps on, has no pen. For an effect of an item, use the [Effects tab of the item](#item-effects).

The window has four tabs:

- **Details**: **Off** (its changes and rules do not apply), for an effect on an item **Apply to the actor** (the actor that has the item gets the effect), the **Conditions** that the effect gives, and the description.
- **Lasts Until**: the moments that end the effect, and its Escape.
- **Changes**: core changes to the data of the creature, one row each: a key, a type, a value and a priority.
- **Rules**: the [Rules Builder](../rules-builder/index.md), the same as on an item. The rule types that work only on an item, such as Grant Item, are not in its list.

Each field saves when you change it.

![The Details tab of an effect: State, and the Conditions with Invisible picked](/images/documentation/effect-window-conditions.png)

## Item effects

Every item sheet has an **Effects** tab, next to **Activation** or **Rules**. It has two lists, each with a **New effect** button:

- **Given when something uses them**: effects with **Apply to the actor** off. An [Apply Effect](activations.md#apply-effect) step or a rule of the item gives a copy to a creature.
- **Always on while you have this item**: effects with **Apply to the actor** on. The creature that has the item has the effect.

Each row shows the Lasts Until of the effect and what uses it, such as "Used by: On use: Apply Effect", or "Nothing uses this effect.". The pen opens the effect window, and the trash button deletes the effect. When a step or a rule uses the effect, the confirm names them, and the delete clears the effect from each of them.

A rule can also pick an effect of its item: the **Effect** of an Apply Condition rule (a copy goes on the creature in place of the bare condition), of a Mark Target rule (the marker gets its Lasts Until, changes and rules), or the **Effect on the attacker** of a Defend Option rule. The select ends with **New effect**, which makes an effect on the item and picks it. The pen opens the effect, and the line under the select shows its Lasts Until, as on an Apply Effect step.

### Build a state such as Rage

A state that a creature turns on, such as Rage, is an item effect. The effect is the state: the creature is Raging while it has the effect.

1. On the item's **Effects** tab, click **New effect** under **Given when something uses them**. Set its name, its Lasts Until and what it does.
2. On the effect's **Rules** tab, add a **Tags** rule, such as `self:raging`, so that other rules can read the state. Add an **Empty pools at end** rule for each dice pool that the end empties.
3. On **Activation → On use**, add an **Apply Effect** step. Set **Who takes it** to **The creature that uses this**, and pick the effect.

![The Effects tab of the Rage item: the Raging effect, its Lasts Until, and Used by: On use: Apply Effect](/images/documentation/item-effects-tab.png)

![The Apply Effect step of Rage on the On use tab: the effect Raging, and Who takes it set to The creature that uses this](/images/documentation/item-on-use-self-step.png)

When the creature uses the item, the effect goes on it. The row of the item on the sheet shows **Active** while the creature has an effect that the item gave. To end the state by hand, delete the effect on the **Effects** tab of the sheet. Another feature can change the state with a **Change an effect** rule, or use the item for free with a **Use an item for free** rule. See [Rules for effects and states](../rules-builder/index.md#rules-for-effects-and-states).

::: details Using the item again, and ending the state
- With the Feature Effects automation setting off, the card has an **Apply to You** button in place.
- A use while the effect is on keeps one copy, and the card says "Raging stays on Grug". A click on the row still uses the item.
- The delete confirm has a line for each pool that the end empties, for example "Your Fury Dice are lost."
- When the item is removed from the creature, the effects that it gave the creature end too.
:::

## Lasts Until

![The Lasts Until tab: until the end of their next turn, or until you drop to 0 HP, or until 1 minute passes; Escape DC 10 + @intelligence with a STR or DEX save](/images/documentation/effect-window-lasts-until.png)

The tab is a sentence. Each row is one moment, and each word in a box is a choice. Use **add a moment...** to add a row, and the trash button to remove one.

| Moment | Reads as |
| --- | --- |
| A turn or a round | until **the end of** **their** **next turn**; until **the start of** the **next round** |
| Rounds or time | until **1** **minutes** pass |
| They or you do something | until **they** **attack**; until **you** **drop to 0 HP** |
| Another effect ends | until **the effect** **Rage** ends |

"Their" is the creature that has the effect. "Your" is the creature that used the item that applied it, as in the book. "The next hero's" is the next turn of any hero. "The" is the turn in progress, whoever's it is: until **the end of** **the** **turn**, for an effect that goes on during the turn of another creature.

They can attack, move, cast a spell, cast a tiered spell, make a roll (an attack, a save or a check), deal damage, take damage, be Healed, drop to 0 HP or die. You can attack, cast a spell, drop to 0 HP, die, lose Concentration or use this again.

The first moment that happens ends the effect. An effect with no moment stays until someone removes it. An older effect can also have a core duration, such as 1 round; the tab shows it, and it still ends the effect. When an effect ends, a line in the **Events** part of a card says so, with **Undo**: see [How an effect works](#how-an-effect-works).

## Hold a change for the next attack

An effect with a **Held Roll Change** rule (on its **Rules** tab) changes a later attack: the next attack of the creature that has it, or the next attack against that creature. The change can be advantage, a number added to the Primary Die, every die at its highest number, and more. With **The roll uses it up** on, the first attack that uses the change ends the effect, and the Lasts Until sentence starts with "until their next attack" or "until the next attack against them". The Lasts Until moments also end it in time.

For example, True Strike holds advantage for the next attack of its target, until the end of their next turn. The roll window shows a line for each held change that the attack uses. The card of the attack then has a line in **Events** for each change that the roll used up, with **Undo**.

![The roll window of Grug's Battleaxe: True Strike, +1 advantage, this roll spends it](/images/documentation/held-roll-window.png)

::: details More about held changes
- **Melee attacks only**: only a melee attack uses the change. An attack with no attack type counts as melee.
- **Only attacks by the creature that applied it**: for the next attack against the holder, only the creature that put the effect on uses it, as with Advance!.
- An area attack uses only the attacker's own changes, not the changes on a target.
- **Extra damage on a hit** adds a damage roll of its own type to the attack, such as `1d6` radiant. A miss deals none of it, but the attack still uses it up. An `@` reference in its formula takes the number from the creature that applied the effect, at the time it is applied: `1d@pools.judgment.faces` rolls that creature's Judgment Die size.
- A **Dice Consumer** rule set to **giveEffect** spends a die the player picks and puts the item's effect (one that does not go on the owner) on each creature they target, as Shining Mandate does. With no target, nothing is spent.
- Out of combat, a change that a feature holds for you (Assess, for example) is not held.
- **Ignore all disadvantage** lasts for your next action. A Move, a paid Assess or an item use that costs an action and is not an attack also ends it. The card of that action has the line in **Events**, with **Undo**.
:::

## Escape

Escape is the way out of an effect such as Restrained. Set the **DC** (a number or a formula, such as `10 + @intelligence`) and turn on the saves the holder can roll: STR, DEX, INT, WIL, or any set of them. A new effect has STR and DEX on. With no DC, the effect has no escape.

## Related pages

- [Conditions](../playing/conditions.md)
- [Rules Builder](../rules-builder/index.md)
- [Item Activations & Effects](activations.md)
