---
title: "Lasts Until, Stacks and Escape"
---

# Lasts Until, Stacks and Escape

The **Lasts Until** tab of the [effect window](effects.md#open-the-effect-window) sets when an effect ends, and how a creature can escape it. The **Details** tab sets if a second application adds a stack.

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

"Their" is the creature that has the effect. "Your" is the creature that used the item that applied it, as in the book.

The first moment that happens ends the effect. An effect with no moment stays until someone removes it. An effect with a condition takes the condition's own Lasts Until (Dazed: until the end of their next turn); turn on **Stays until someone removes it** to keep it on. When an effect ends, a line in the **Events** part of a card says so, with **Undo**: see [How an effect works](effects.md#how-an-effect-works). With the **Feature Effects** automation setting off, the effect does not end by itself. Its line has an **End** button instead, as told in [When an effect ends](../playing/how-long-effects-last.md#when-an-effect-ends).

::: details "The next hero's" and "the" turn
"The next hero's" is the next turn of any hero. "The" is the turn in progress, whoever's it is: until **the end of** **the** **turn**, for an effect that goes on during the turn of another creature.
:::

::: details Each thing they or you can do
They can attack, move, cast a spell, cast a tiered spell, make a roll (an attack, a save or a check), deal damage, take damage, be Healed, drop to 0 HP, die, gain or apply something, or lose its temp HP. You can attack, cast a spell, drop to 0 HP, die, lose Concentration, use this again, gain or apply something.

- **Take damage** can name damage types: turn on **fire** and **radiant** for "until they take fire or radiant damage". With none on, any damage ends it.
- **Gain** and **apply** name a condition, or an effect by its name ("an effect named..."). A condition also counts its aliases: Stunned is a gain of Incapacitated. To end an effect on any of a group of effects, give each of them the same custom condition and name that condition. An effect never ends on its own gain.
- **Apply** is the creature the new effect came from (its origin).
:::

::: details Temp HP, combat ends and a core duration
- **Lose its temp HP** ends the effect when the temp HP it gave are gone: they reach 0, or another effect or a potion takes their place.
- **Combat ends** counts each combat that the effect is part of: it went on in that combat, or the creature that has it, or the creature that applied it, is in it. The combat in progress when the effect goes on is the 1st. A combat that the GM deletes before round 1 counts for nothing and ends only the effects that went on in it.
- An older effect can also have a core duration, such as 1 round. The tab shows it, and it still ends the effect.
:::

## Stacks

Some effects build up: "Dazed 3 times = Petrified". On the effect's **Details** tab, under **Stacks**, turn on **A new application adds a stack**. When a creature that has the effect gets it again, it keeps one effect with a count, the stacks. "The same effect" is an effect with Stacks on, the same name and the same conditions, from any source. The timing follows the one that lasts longer, as for [the same condition again](../playing/how-long-effects-last.md#the-same-condition-again). The effect ends as one: all its stacks go together.

- **At [N] stacks, they gain [effect]**: when the count gets to N, the creature also gains another effect of the same item, once. The stacking effect stays on. The card that caused the stack gets the line "Tessa gains Petrified: 3 stacks of Dazed", with **Undo**. With Feature Effects off, the line is "Tessa has 3 stacks of Dazed", with an **Apply Petrified** button.
- On a creature's effect, **Stacks now** shows the count, and you can change it there. Set **At [N] stacks** on the effect of the item. The sheet row has a tag such as **3 stacks**, and the card says "On Goblin (3 stacks)".
- Any rule formula on the effect, a dice formula too, can read the count as `@stacks`: `(@stacks)d6` rolls one d6 per stack. A **Situational Roll Mode** with **For each stack** on gives its value once for each stack.

An effect with Stacks off never stacks: a second Dazed keeps the one that lasts longer.

::: details Count failed saves
To count failed saves ("advantage on the save for each failure"), put a stacking effect under **On Failed Save** with **Each creature that fails**. Give it a Situational Roll Mode with **For each stack** on and the condition `save:from:<item>`, and a Lasts Until of **combat ends**.
:::

::: details A stack with no card
A stack with no card that caused it (a dice pool spend, a turn) puts its line on a card of its own. When the line has no button (the count only, with nothing to gain), no card is made.
:::

## Escape

Escape is the way out of an effect such as Restrained. Set the **DC** (a number or a formula, such as `10 + @intelligence`) and turn on the saves the holder can roll: STR, DEX, INT, WIL, or any set of them. The row under it, "or a ... check", turns on skill checks too, such as Finesse to pick a lock. One save or check always stays on. A new effect has STR and DEX on.

A blank DC means the effect has no escape. Turn on **No DC** for an escape that the table judges, such as a monster grapple with no printed DC. For what the holder sees, see [Escape](../playing/how-long-effects-last.md#escape).

::: details More about Escape
Monsters have no skills. A monster rolls the save of the skill's stat instead, such as a DEX save for Finesse. When a save and a check use the same stat, the monster gets that save once.

With **Feature Effects** off, an Escape roll that succeeds gives a line with **End**, and the damage comes when someone clicks it, with a **Take Damage** button on its line.
:::

A **Damage on escape** rule on the effect deals its damage once, when the holder escapes: the Escape roll succeeds, or the table clicks **Escapes**. The damage ignores armor and Defend, as with [Damage each turn](held-changes.md#damage-each-turn). Its line goes on the roll card of the escape, after the ended line, with **Undo**. As with Damage each turn, the line goes on the card before the damage is dealt. Another end (a moment, Undo, a delete by hand) deals nothing. A reroll that turns the escape into a failure puts the effect back and gives the damage back. An upcast can add dice to its **Damage**, even when it is blank, as Shadow Trap does: see [Raise Effect Rule](spells.md#step-4-upcasting-the-spell-scaling-section).
## Related pages

- [Effects](effects.md)
- [Held Changes and Damage Each Turn](held-changes.md)
- [How Long Effects Last](../playing/how-long-effects-last.md)
- [Conditions](../playing/conditions.md)
