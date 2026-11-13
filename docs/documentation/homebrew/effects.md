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

- **Details**: **Off** (its changes and rules do not apply), for an effect on an item **Apply to the actor** (the actor that has the item gets the effect) and, when that is off, **Rule formulas read the creature that has it**, the **Conditions** that the effect gives, [Stacks](#stacks), and the description.
- **Lasts Until**: the moments that end the effect, and its Escape.
- **Changes**: core changes to the data of the creature, one row each: a key, a type, a value and a priority. The type **Multiply, round down** multiplies and rounds the result down, so a halved speed of 7 is 3 (core's **Multiply** rounds to the nearest number). An `@` reference in a value reads the creature that has the effect.
- **Rules**: the [Rules Builder](../rules-builder/index.md), the same as on an item. The rule types that work only on an item, such as Grant Item, are not in its list.

::: details Multiply, round down, and what a rule formula reads
- **Multiply, round down** applies after every rule, so a halving also halves what a Speed Bonus or a granted speed adds. Two halvings from two effects both apply (7 is 3, then 1). A halved speed halves each movement type that has a row of its own. It works on a `token.` key too, such as `token.light.dim`.
- On the copy that a step puts on a creature, an `@` reference in a rule formula reads the creature that applied it, at the time it was applied. With **Rule formulas read the creature that has it** on, each formula reads the creature that has the copy, each time the rule works.
- `@stacks` always reads the creature that has the effect, and `@speed` the creature that moves. The Escape DC always reads the creature that applied it.
:::

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
| A turn or a round | until **the end of** **their** **next turn**, or their **2nd next turn** up to the 5th; until **the start of** the **next round** |
| Rounds or time | until **1** **minutes** pass |
| They or you do something | until **they** **attack**; until **you** **drop to 0 HP**; until **they** **take** **fire** damage; until **they** **gain** **Incapacitated** |
| Another effect ends | until **the effect** **Rage** ends |
| Combat ends | until **combat ends**, or until **the 2nd combat ends** up to the 5th |

"Their" is the creature that has the effect. "Your" is the creature that used the item that applied it, as in the book. "The next hero's" is the next turn of any hero. "The" is the turn in progress, whoever's it is: until **the end of** **the** **turn**, for an effect that goes on during the turn of another creature.

They can attack, move, cast a spell, cast a tiered spell, make a roll (an attack, a save or a check), deal damage, take damage, be Healed, drop to 0 HP, die, gain or apply something, or lose its temp HP. You can attack, cast a spell, drop to 0 HP, die, lose Concentration, use this again, gain or apply something.

- **Take damage** can name damage types: turn on **fire** and **radiant** for "until they take fire or radiant damage". With none on, any damage ends it.
- **Gain** and **apply** name a condition, or an effect by its name ("an effect named..."). A condition also counts its aliases: Stunned is a gain of Incapacitated. To end an effect on any of a group of effects, give each of them the same custom condition and name that condition. An effect never ends on its own gain.
- **Apply** is the creature the new effect came from (its origin).

The first moment that happens ends the effect. An effect with no moment stays until someone removes it. An effect with a condition takes the condition's own Lasts Until (Dazed: until the end of their next turn); turn on **Stays until someone removes it** to keep it on. An older effect can also have a core duration, such as 1 round; the tab shows it, and it still ends the effect. When an effect ends, a line in the **Events** part of a card says so, with **Undo**: see [How an effect works](#how-an-effect-works).

::: details Temp HP and combat ends
- **Lose its temp HP** ends the effect when the temp HP it gave are gone: they reach 0, or another effect or a potion takes their place.
- **Combat ends** counts each combat that the effect is part of: it went on in that combat, or the creature that has it, or the creature that applied it, is in it. The combat in progress when the effect goes on is the 1st. A combat that the GM deletes before round 1 counts for nothing and ends only the effects that went on in it.
:::

## Stacks

Some effects build up: "Dazed 3 times = Petrified". On the effect's **Details** tab, under **Stacks**, turn on **A new application adds a stack**. When a creature that has the effect gets it again, it keeps one effect with a count, the stacks. "The same effect" is an effect with Stacks on, the same name and the same conditions, from any source. The timing follows the one that lasts longer, as for [the same condition again](../playing/conditions.md#how-long-a-condition-lasts). The effect ends as one: all its stacks go together.

- **At [N] stacks, they gain [effect]**: when the count gets to N, the creature also gains another effect of the same item, once. The stacking effect stays on. The card that caused the stack gets the line "Tessa gains Petrified: 3 stacks of Dazed", with **Undo**. A stack with no card (a dice pool spend, a turn) puts the line on a card of its own. With Feature Effects off, the line is "Tessa has 3 stacks of Dazed", with an **Apply Petrified** button.
- On a creature's effect, **Stacks now** shows the count, and you can change it there. Set **At [N] stacks** on the effect of the item. The sheet row has a tag such as **3 stacks**, and the card says "On Goblin (3 stacks)".
- Any rule formula on the effect, a dice formula too, can read the count as `@stacks`: `(@stacks)d6` rolls one d6 per stack. A **Situational Roll Mode** with **For each stack** on gives its value once for each stack.
- To count failed saves ("advantage on the save for each failure"), put a stacking effect under **On Failed Save** with **Each creature that fails**. Give it a Situational Roll Mode with **For each stack** on and the condition `save:from:<item>`, and a Lasts Until of **combat ends**.

An effect with Stacks off never stacks: a second Dazed keeps the one that lasts longer.

## Hold a change for the next attack

An effect with a **Held Roll Change** rule (on its **Rules** tab) changes a later attack: the next attack of the creature that has it, or the next attack against that creature. The change can be advantage, a number added to the Primary Die, every die at its highest number, and more. With **The roll uses it up** on, the first attack that uses the change ends the effect, and the Lasts Until sentence starts with "until their next attack" or "until the next attack against them". The Lasts Until moments also end it in time.

For example, True Strike holds advantage for the next attack of its target, until the end of their next turn. The roll window shows a line for each held change that the attack uses. The card of the attack then has a line in **Events** for each change that the roll used up, with **Undo**.

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
:::

## Damage each turn

A **Damage each turn** rule deals damage, gives Wounds, or both, at each turn of a creature. Put it on an effect for a hazard that lasts ("1d20 fire damage/turn" while in a cauldron), or on an item for a monster that always hurts the creatures next to it (a burning aura). **Who takes it** is the creature that has the rule, or each other creature within **Reach** of it, allies too. **When** is the start of that creature's turn, or its end. **Damage** is dice or a number, rolled each time, with a **Damage type**. **Wounds** gives that many Wounds, up to the max of the track: "1 Wound/round" is Wounds 1 with no damage.

The damage ignores armor and Defend, as damage from outside an attack does: temp HP go first, then HP. Each time is a line in **Events** on the card of that turn start or end, with **Undo**, which gives back the HP, temp HP and Wounds it took. An effect that ends at that moment deals nothing at it. A dead or defeated creature takes nothing and deals nothing. With **Feature Effects** off, the line has a **Take Damage** button for the creature's owner or the GM.

::: details More about damage each turn
- A creature with no Wound track (a monster) takes the damage and no Wounds.
- The damage counts as "they take damage" for Lasts Until and Save on an Event, with its type: lightning damage makes the creature Charged.
- A turn played again after the GM goes back in the combat tracker deals nothing a second time.
- The line goes on the card before the damage is dealt. When the line cannot be written, nothing is dealt.
- A creature with more than one turn in a round takes it on each turn.
- **Undo** is not healing: an effect that lasts until its holder is healed stays.
:::

## Escape

Escape is the way out of an effect such as Restrained. Set the **DC** (a number or a formula, such as `10 + @intelligence`) and turn on the saves the holder can roll: STR, DEX, INT, WIL, or any set of them. The row under it, "or a ... check", turns on skill checks too, such as Finesse to pick a lock. One save or check always stays on. A new effect has STR and DEX on.

A blank DC means the effect has no escape. Turn on **No DC** for an escape that the table judges, such as a monster grapple with no printed DC. For what the holder sees, see [Escape](../playing/conditions.md#escape).

::: details A monster and a skill check escape
Monsters have no skills. A monster rolls the save of the skill's stat instead, such as a DEX save for Finesse. When a save and a check use the same stat, the monster gets that save once.
:::

A **Damage on escape** rule on the effect deals its damage once, when the holder escapes: the Escape roll succeeds, or the table clicks **Escapes**. The damage ignores armor and Defend, as with [Damage each turn](#damage-each-turn). Its line goes on the roll card of the escape, after the ended line, with **Undo**. Another end (a moment, Undo, a delete by hand) deals nothing. A reroll that turns the escape into a failure puts the effect back and gives the damage back. An upcast can add dice to its **Damage**, even when it is blank, as Shadow Trap does: see [Raise Effect Rule](spells.md#step-4-upcasting-the-spell-scaling-section).

## Related pages

- [Conditions](../playing/conditions.md)
- [Rules Builder](../rules-builder/index.md)
- [Item Activations & Effects](activations.md)
