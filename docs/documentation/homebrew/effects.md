---
title: "Effects"
---

# Effects

An effect is something on a creature for a time, such as a condition, a change to its numbers from a spell, or a mark from a feature. Each effect has a window where you set what it does and how long it lasts. [Lasts Until, Stacks and Escape](lasts-until.md) tells how an effect ends. [Held Changes and Damage Each Turn](held-changes.md) covers an effect that changes a later attack or deals damage each turn.

## How an effect works

Each effect goes through the same steps. Here, Tessa casts True Strike on Grug.

**1. It goes on.** The card has an **Effects** part. An effect for the targets has an **Apply to Targets** button. An effect for the creature that uses the item goes on by itself. The line under the name says how long the effect lasts.

![Tessa's True Strike card: Grug is the target, and the Effects part has True Strike, until their next attack or the end of their next turn, with Apply to Targets](/images/documentation/effect-life-1-card.png)

**2. It shows on the sheet.** The **Effects** tab of the creature lists the effect and its Lasts Until.

![The Effects tab of Grug's sheet: True Strike, until your next attack, or until the end of your next turn](/images/documentation/effect-life-2-sheet.png)

**3. It ends.** The first moment in its Lasts Until ends it. When a roll or a use ends it, the system puts a line in the **Events** part at the bottom of that card. Here, Grug's attack used the advantage.

![Grug's Battleaxe card: advantage on the roll, and in Events, True Strike ended on Grug, this roll used it, with Undo](/images/documentation/effect-life-3-ended-line.png)

When nothing in chat ended it, such as at the end of a turn, the system posts one message for that moment, with a line for each effect that ended.

![The message for the end of Grug's turn: True Strike ended on Grug, until the end of your next turn, with Undo](/images/documentation/effect-life-4-moment.png)

**4. Undo puts it back.** **Undo** on the line puts the effect back on the creature, and the line then says "On Grug". The owner of the creature and the GM can use it. The effect keeps its old start, so it ends again at the next moment that matches.

![The same Battleaxe card after Undo: the line says On Grug](/images/documentation/effect-life-3b-undone.png)

A GM must be connected for an effect to end by itself.

## Open the effect window

On the character or NPC sheet, go to the **Effects** tab and click the pen at the end of the effect's row. The pen of an effect that an item keeps on, such as a passive effect of armor, opens the item instead, because you change the effect there. The pen of a condition opens the effect that gives it. A condition with no effect of its own on the creature, such as Bloodied or a condition that an item keeps on, has no pen. For an effect of an item, use the [Effects tab of the item](#item-effects).

The window has four tabs:

- **Details** has **Off** (its changes and rules do not apply), the **Conditions** that the effect gives, [Stacks](lasts-until.md#stacks), and the description. An effect on an item also has **Apply to the actor**, which gives the effect to the actor that has the item. When that is off, it has **Rule formulas read the creature that has it**.
- **Lasts Until** has the moments that end the effect, and its Escape.
- **Changes** has core changes to the data of the creature, one row each, with a key, a type, a value and a priority. The type **Multiply, round down** multiplies and rounds the result down, so a halved speed of 7 is 3. Core's **Multiply** rounds to the nearest number. An `@` reference in a value reads the creature that has the effect.
- **Rules** has the [Rules Builder](../rules-builder/index.md), the same as on an item. Its list leaves out the rule types that work only on an item, such as Grant Item.

::: details Multiply, round down, and what a rule formula reads
- **Multiply, round down** applies after every rule, so a halving also halves what a Speed Bonus or a granted speed adds. Two halvings from two effects both apply, so 7 becomes 3, then 1. To halve speed, give each movement type its own row: walk, fly, climb, swim and burrow. It works on a `token.` key too, such as `token.light.dim`.
- On the copy that a step puts on a creature, an `@` reference in a rule formula reads the creature that applied it, at the time it was applied. With **Rule formulas read the creature that has it** on, each formula reads the creature that has the copy, each time the rule works.
- `@stacks` always reads the creature that has the effect, and `@speed` the creature that moves. The Escape DC always reads the creature that applied it.
:::

Each field saves when you change it.

![The Details tab of an effect: State, and the Conditions with Invisible picked](/images/documentation/effect-window-conditions.png)

## Item effects

Every item sheet has an **Effects** tab, next to **Activation** or **Rules**. It has two lists, each with a **New effect** button:

- **Given when something uses them** lists the effects with **Apply to the actor** off. An [Apply Effect](activation-steps.md#apply-effect) step or a rule of the item gives a copy of one to a creature.
- **Always on while you have this item** lists the effects with **Apply to the actor** on. The creature that has the item has these effects.

Each row shows the Lasts Until of the effect and what uses it, such as "Used by: On use: Apply Effect", or "Nothing uses this effect.". The pen opens the effect window, and the trash button deletes the effect. When a step or a rule uses the effect, the confirm dialog names them, and the delete removes the effect from each of them.

A rule can also pick an effect of its item:

- The **Effect** of an Apply Condition rule. A copy of the effect goes on the creature in place of the bare condition.
- The **Effect** of a Mark Target rule. The marker gets the Lasts Until, changes and rules of the effect.
- The **Effect on the attacker** of a Defend Option rule.

The last option in the select is **New effect**, which makes an effect on the item and picks it. The pen opens the effect, and the line under the select shows its Lasts Until, as on an Apply Effect step.

### Build a state such as Rage

A state that a creature turns on, such as Rage, is an item effect. The creature is Raging while it has the effect.

1. On the item's **Effects** tab, click **New effect** under **Given when something uses them**. Set its name, its Lasts Until and what it does.
2. On the effect's **Rules** tab, add a **Tags** rule, such as `self:raging`, so that other rules can read the state. Add an **Empty pools at end** rule for each dice pool that empties when the state ends.
3. On **Activation → On use**, add an **Apply Effect** step. Set **Who takes it** to **The creature that uses this**, and pick the effect.

![The Effects tab of the Rage item: the Raging effect, its Lasts Until, and Used by: On use: Apply Effect](/images/documentation/item-effects-tab.png)

![The Apply Effect step of Rage on the On use tab: the effect Raging, and Who takes it set to The creature that uses this](/images/documentation/item-on-use-self-step.png)

When the creature uses the item, the effect goes on it. The row of the item on the sheet shows **Active** while the creature has an effect that the item gave. To end the state by hand, delete the effect on the **Effects** tab of the sheet. Another feature can change the state with a **Change an effect** rule, or use the item for free with a **Use an item for free** rule. See [Rules for effects and states](../rules-builder/index.md#rules-for-effects-and-states).

::: details Using the item again, and ending the state
- With the Feature Effects automation setting off, the card has an **Apply to You** button instead.
- A use while the effect is on keeps one copy, and the card says "Raging stays on Grug". A click on the row still uses the item.
- The confirm dialog of the delete has a line for each pool that empties, for example "Your Fury Dice are lost."
- When the item is removed from the creature, the effects that it gave the creature end too.
:::

## Related pages

- [Lasts Until, Stacks and Escape](lasts-until.md)
- [Held Changes and Damage Each Turn](held-changes.md)
- [Conditions](../playing/conditions.md)
- [Rules Builder](../rules-builder/index.md)
- [Item Activations & Effects](activations.md)
