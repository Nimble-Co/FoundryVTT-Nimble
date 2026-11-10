---
title: "Effects and Lasts Until"
---

# Effects and Lasts Until

An effect is something that is on a creature for a time: a condition, a buff from a spell, a mark from a feature. Each effect has its own window, where you set what it does and how long it lasts.

## Open the effect window

On the character or NPC sheet, go to the **Effects** tab and click the pen at the end of the effect's row. An effect that an item keeps on (a passive effect of armor, for example) opens its item instead, because you change it there.

The window has four tabs:

- **Details**: the description, **Off** (its changes and rules do not apply), **Minor Status** (it ends when combat ends) and, for an effect on an item, **Put on the owner** (the actor that has the item gets the effect).
- **Lasts Until**: the moments that end the effect, and its Escape.
- **Changes**: core changes to the data of the creature, one row each: a key, a type, a value and a priority.
- **Rules**: the [Rules Builder](../rules-builder/index.md), the same as on an item. The rule types that work only on an item, such as Grant Item, are not in its list.

Each field saves when you change it.

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

They can attack, move, cast a spell, take damage, be Healed, drop to 0 HP or die. You can drop to 0 HP, die, lose Concentrating or use this again.

The first moment that happens ends the effect. An effect with no moment stays until someone removes it. When an effect ends, the chat says so, with an Undo button: see [How long a condition lasts](../playing/conditions.md#how-long-a-condition-lasts).

## Escape

Escape is the way out of an effect such as Restrained. Set the **DC** (a number or a formula, such as `10 + @intelligence`) and the save: STR or DEX, one ability, or any. With no DC, the effect has no escape.

## Related pages

- [Conditions](../playing/conditions.md)
- [Rules Builder](../rules-builder/index.md)
- [Item Activations & Effects](activations.md)
