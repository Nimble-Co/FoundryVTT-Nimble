---
title: "Lasts Until, Stacks and Escape"
---

# Lasts Until, Stacks and Escape

The **Lasts Until** tab of the [effect window](effects.md#open-the-effect-window) sets when an effect ends, and how its holder can escape it. The **Details** tab sets whether a second application adds a stack.

## Lasts Until

![The Lasts Until tab: until the end of their next turn, or until you drop to 0 HP, or until 1 minute passes; Escape DC 10 + @intelligence with a STR or DEX save](/images/documentation/effect-window-lasts-until.png)

The tab reads as a sentence. Each row is one moment, and each word in a box is a choice. Use **add a moment...** to add a row, and the trash button to remove one.

| Moment | Reads as |
| --- | --- |
| A turn or a round | until **the end of** **their** **next turn**, or their **2nd next turn** up to the 5th; until **the start of** the **next round** |
| Rounds or time | until **1** **minutes** pass |
| They or you do something | until **they** **attack**; until **you** **drop to 0 HP**; until **they** **take** **fire** damage; until **they** **gain** **Incapacitated** |
| Another effect ends | until **the effect** **Rage** ends |
| Combat ends | until **combat ends**, or until **the 2nd combat ends** up to the 5th |

"Their" is the holder, the creature that has the effect. "Your" is the creature that used the item that applied it, as the book uses the word.

The first moment that happens ends the effect. An effect with no moment stays until someone removes it. An effect with a condition takes the condition's own Lasts Until, such as "until the end of their next turn" for Dazed. Turn on **Stays until someone removes it** to keep the effect on. When an effect ends, a line in the **Events** part of a card says so, with **Undo**. See [How an effect works](effects.md#how-an-effect-works). With the **Feature Effects** automation setting off, the effect does not end by itself. Its line has an **End** button instead. See [When an effect ends](../playing/how-long-effects-last.md#when-an-effect-ends).

::: details "The next hero's" and "the" turn
"The next hero's" is the next turn of any hero. "The" is the turn in progress, whoever's turn it is. Use until **the end of** **the** **turn** for an effect that goes on during the turn of another creature.
:::

::: details Each thing they or you can do
They can attack, move, cast a spell, cast a tiered spell, make a roll (an attack, a save or a check), deal damage, take damage, be Healed, drop to 0 HP, die, gain or apply something, or lose its temp HP. You can attack, cast a spell, drop to 0 HP, die, lose Concentration, use this again, gain or apply something.

- **Take damage** can name damage types. Turn on **fire** and **radiant** for "until they take fire or radiant damage". With none on, any damage ends it.
- **Gain** and **apply** name a condition, or an effect by its name ("an effect named..."). A condition also counts the conditions that count as it, so gaining Stunned is a gain of Incapacitated. To end an effect when any effect of a group goes on, give each effect of the group the same custom condition, and name that condition. An effect never ends on its own gain.
- **Apply** looks at the creature the new effect came from (its origin).
:::

::: details Temp HP, combat ends and a core duration
- **Lose its temp HP** ends the effect when the temp HP it gave are gone. They are gone when they reach 0, or when another effect or a potion replaces them.
- **Combat ends** counts each combat that the effect is part of. The effect is part of a combat when it went on in that combat, or when its holder or the creature that applied it is in that combat. The combat in progress when the effect goes on is the 1st. A combat that the GM deletes before round 1 counts for nothing and ends only the effects that went on in it.
- An older effect can also have a core duration, such as 1 round. The tab shows it, and it still ends the effect.
:::

## Stacks

Some effects build up, such as "Dazed 3 times = Petrified". On the effect's **Details** tab, under **Stacks**, turn on **A new application adds a stack**. When a creature that has the effect gets it again, it keeps one effect and adds 1 to its count of stacks. The same effect means an effect with Stacks on, the same name and the same conditions, from any source. The timing follows the application that lasts longer, as for [the same condition again](../playing/how-long-effects-last.md#the-same-condition-again). The effect ends as one, with all its stacks.

- With **At [N] stacks, they gain [effect]**, the creature also gains another effect of the same item, once, when the count gets to N. The stacking effect stays on. The card that caused the stack gets the line "Tessa gains Petrified: 3 stacks of Dazed", with **Undo**. With Feature Effects off, the line is "Tessa has 3 stacks of Dazed", with an **Apply Petrified** button.
- On a creature's effect, **Stacks now** shows the count, and you can change it there. Set **At [N] stacks** on the effect of the item. The sheet row has a tag such as **3 stacks**, and the card says "On Goblin (3 stacks)".
- Any rule formula on the effect, dice formulas too, can read the count as `@stacks`. For example, `(@stacks)d6` rolls one d6 per stack. A **Situational Roll Mode** with **For each stack** on gives its value once for each stack.

An effect with Stacks off never stacks. When a second Dazed comes, the one that lasts longer stays.

::: details Count failed saves
To count failed saves ("advantage on the save for each failure"), put a stacking effect under **On Failed Save** with **Each creature that fails**. Give it a Situational Roll Mode with **For each stack** on and the condition `save:from:<item>`, and a Lasts Until of **combat ends**.
:::

::: details A stack with no card
When no card caused a stack, such as a dice pool spend or a turn, its line goes on a card of its own. A line with no button (the count only, with nothing to gain) gets no card.
:::

## Escape

Escape is the way out of an effect such as Restrained. Set the **DC** (a number or a formula, such as `10 + @intelligence`) and turn on the saves the holder can roll: STR, DEX, INT, WIL, or any set of them. The row under it, "or a ... check", turns on skill checks too, such as Finesse to pick a lock. At least one save or check stays on. A new effect has STR and DEX on.

A blank DC means the effect has no escape. Turn on **No DC** for an escape that the table judges, such as a monster grapple with no printed DC. [Escape](../playing/how-long-effects-last.md#escape) on the player page shows what the holder sees.

::: details More about Escape
Monsters have no skills. A monster rolls the save of the skill's stat instead, such as a DEX save for Finesse. When a save and a check use the same stat, the monster gets that save once.

With **Feature Effects** off, a successful Escape roll gives a line with **End**. The damage comes when someone clicks it, and its line has a **Take Damage** button.
:::

A **Damage on escape** rule on the effect deals its damage once, when the holder escapes. That is when the Escape roll succeeds, or when the table clicks **Escapes**. The damage ignores armor and Defend, as with [Damage each turn](held-changes.md#damage-each-turn). Its line goes on the roll card of the escape, after the ended line, with **Undo**. The line goes on the card before the damage is dealt, as with Damage each turn. Any other end, such as a moment, Undo or a delete by hand, deals nothing. A reroll that turns the escape into a failure puts the effect back and gives the damage back. An upcast can add dice to its **Damage**, even when it is blank, as Shadow Trap does. See [Raise Effect Rule](spells.md#step-4-upcasting-the-spell-scaling-section).

## Related pages

- [Effects](effects.md)
- [Held Changes and Damage Each Turn](held-changes.md)
- [How Long Effects Last](../playing/how-long-effects-last.md)
- [Conditions](../playing/conditions.md)
