---
title: "Rest & Recovery"
---

# Rest & Recovery

Nimble characters track two layers of harm, and the sheet gives you two kinds of rest to recover from them. This page covers what the sheet tracks and what each rest button actually does. For what wounds and rests mean in the fiction, see the Nimble rulebook.

## Wounds vs Hit Points

- **Hit Points** are the fast-moving number: the HP bar in the sheet header tracks current, temporary, and maximum HP, and drops with every hit.
- **Wounds** are the slow-moving one: droplet icons around your portrait, one per wound, with room for six by default (features can raise this). Click a droplet to mark or unmark a wound. A wound counter also appears next to the Hit Points heading while you have any.

HP comes back easily. Wounds don't: a safe rest heals exactly one.

## Field Rest

Click the hourglass button in the sheet sidebar. The field rest window asks two things:

![The field rest window showing the Catch Breath / Make Camp cards and the hit dice spend rows](/images/documentation/field-and-saferest.png)

- **Rest type.** *Catch Breath* is a 10 minute rest where the hit dice you spend are rolled, adding your Strength modifier to each. *Make Camp* is an 8 hour rest where each spent hit die counts as its maximum value plus your Strength modifier instead of being rolled.
- **Hit dice to spend.** One row per die size showing how many you have left; use the plus, minus, and Max buttons to choose how many to spend. You can also rest without spending any.

A **Modifiers** section appears when relevant: it shows when your hit dice will be maximized (making camp, or a feature that always maximizes them), and lists any toggleable advantage options from your features. Tick one to roll those hit dice with advantage when its condition applies.

Resting posts a chat card summarizing the rest type, dice spent, total healing, and whether the dice were maximized or rolled with advantage. If your class recovers mana on a field rest, mana refills too and shows on the card.

## Safe Rest

Click the moon button in the sheet sidebar. The safe rest window is a preview, not a form. It lists exactly what will happen before you commit:

- **Hit Points** restored to maximum, and any **temporary HP** removed.
- **All hit dice** restored.
- **Mana** restored to maximum, if your class recovers mana on a safe rest.
- **One wound** healed.
- **Charges** on features and items that recharge on a safe rest.

Anything already full is marked "Already full". Click the Safe Rest button to apply it all; a chat card summarizes what was recovered (no card is posted if there was nothing to recover).

![The safe rest window showing the recovery preview cards](/images/documentation/field-and-saferest.png)

## Rolling hit dice from the sheet

You don't need a rest to spend hit dice. Click the roll button on the hit dice bar in the sheet header. The window lets you pick how many dice of each size to roll, plus two checkboxes:

- **Add STR bonus**: add your Strength modifier to each die (on by default).
- **Apply healing to HP**: apply the result to your HP immediately instead of just rolling (on by default).

## Changing your class options

Several classes let you re-pick the class options you chose at earlier levels. The Berserker's Wrath & Ruin, the Mage's Study!, the Hunter's Remember the Wild and their siblings all say the same thing in their own words: on a safe rest, you may choose different options.

If your character has such a feature, the rest window shows a **Change my options** row. Expand it and you see:

- **The feature's own text**, quoted under the heading. Wrath & Ruin wants "a notable act of destruction or feat of strength"; Focus wants you "meditating alone in a windy place". The system never checks this, and cannot: whether it happened is a question for your table, not for the software. It is shown so you read it while you decide.
- **Each pool of options** your class has given you picks from. Your current picks sit at the top, marked as selected, and the pool's heading says how many picks you hold in it. The rest of the pool is folded below them behind a **Show more options** row, so a class with many pools stays readable. In a pool with a single pick, clicking another option swaps it in. In a pool with several picks, release one of yours first, then pick its replacement. The pool keeps you to the number of picks you are owed.
- **An option you took more than once** is one card carrying its count, such as **x2**, with a minus button that gives up one copy at a time. It never gives up the last copy: at one, the card shows the usual deselect control instead. An option the rules let you repeat also carries a plus button, so you can take another copy once you have released a different pick. The plus is greyed while the pool is full, and says so.

A pick is something you chose in a level up. An item a GM dragged onto your sheet by hand is not a pick: the window never counts it, offers it as held, trades it away or deletes it, and it stays exactly where it is through a level up or a level down. A character built entirely by hand, with no level ups, is told so and offered no pools.

Nothing happens until you confirm the rest. Close the window and your picks are untouched. Confirm it and the old option is removed, the new one is granted, and the chat card lists what changed so the rest of the table can see it. An option that moved more than once is named once with its count, such as **+1 Max Combat Die x2**.

The Songweaver's Jack of All Trades works the same way for skills: it offers to move one skill point on a safe rest. A move is net zero, so a point can only be added to one skill by taking it from another. A point can only leave a skill that holds one and whose total would stay at +0 or better, and no skill can be pushed past the +12 maximum.

What a swap covers is your class option pools. A level that let you choose between alternatives, such as the Commander's Combat Ability or +1 max Combat Die, counts every alternative as part of one pool, so a die can be traded for an ability and back. A Commander who took the die at two levels holds two picks of it, sees one die card marked **x2**, and can trade one away while keeping the other, or trade an ability for a second die. Pools that share options are shown as one pool. A swap does not change your subclass, your ability score increases, or the spells you know.

## Features that improve resting

Items and features can change how resting works through their rules: advantage on hit dice under a stated condition, always-maximized hit dice, bigger or bonus hit dice, and stronger healing potions. These show up automatically in the rest windows' Modifiers section or in the results. See the [Rules Reference: Bonuses](../reference/rules-bonuses.md).

## Related pages

- [The Character Sheet](../characters/character-sheet.md)
- [Conditions](conditions.md)
- [Rules Reference: Bonuses](../reference/rules-bonuses.md)
