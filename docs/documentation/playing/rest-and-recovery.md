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

If your character has such a feature, the rest window shows a **Change my options** row. Expand it and you see one card for each feature that makes the offer, with the feature's icon and name. Hold the pointer on the icon to read the feature's own text. Wrath & Ruin wants "a notable act of destruction or feat of strength"; Focus wants you "meditating alone in a windy place". The system never checks this, and cannot: whether it happened is a question for your table, not for the software.

Inside a card, each pool of options your class grants picks from is a set of places. Every pick you hold is one place, shown as a chip with the option's icon and name and a filled check. Hold the pointer on a chip to read what the option does. Click its check to give the pick up: the chip becomes an empty place that says **Empty. Choose below.** and stays where it was. Under the chips, **Show N other options** unfolds what can fill a place. Click one and it takes the first empty place. While no place is empty, that list is greyed out under **Give up an option to choose another.**

When a pool's options come from more than one list, the chips sit under a small heading for each list, and the choices below the fold are split the same way. An option your levels grant outright, such as the Commander's +1 Max Combat Die, stands under its own name. The count stays one number for the whole pool, so when your class lets you choose from either list you can give up an option from one list and take one from another.

An option you may take more than once, such as the Commander's +1 Max Combat Die, is a chip for each copy you hold. It stays in the list below while you hold it, because it can fill another place, and its hover card says **You can take this more than once.** To hold three, give up a pick, choose the die, and repeat.

The pool heading shows how many you have chosen against how many your levels give you, and it moves as you click. When your sheet holds a different number than your levels give, one sentence under the heading says so, such as **Your level gives you 5 options. You have 3. Choose 2 more.** You can take the missing picks in the same window without giving anything up. When it holds more, the sentence says that, and you keep every place you hold. Neither stops the rest.

A pick is an item on your sheet. It does not matter how it got there: a level up, the level correction dialog, a drag from the compendium, or a GM's hand. If your sheet holds it and it belongs to a pool, the window shows it as a place and lets you trade it. A character built entirely by hand sees every pool their levels grant.

One line under the pool says what confirming will do: **You give up Face Me! and take Sweeping Strike.** or **You take Sweeping Strike.** If the selection is not ready, the line says what is missing instead, such as **Choose 1 more option to complete the swap.**, and confirming the rest changes nothing in that pool. The rest button itself reads **Safe Rest and swap options** while a swap is ready.

Nothing happens until you confirm the rest. Close the window and your picks are untouched. Confirm it and the old option is removed, the new one is granted, and the chat card lists what changed so the rest of the table can see it. An option that moved more than once is named once with its count, such as **+1 Max Combat Die x2**.

The Songweaver's Jack of All Trades works the same way for skills: it offers to move one skill point on a safe rest, as one line in its card: **Move a point** from one skill to another, each chosen from a list that shows the current total. A move is net zero, so a point can only be added to one skill by taking it from another. A point can only leave a skill that holds one and whose total would stay at +0 or better, and no skill can be pushed past the +12 maximum. If the feature that offers the move is itself a pick you are giving up in the same rest, its card says so and the move is not offered.

What a swap covers is your class option pools. A level that let you choose between alternatives, such as the Commander's Combat Ability or +1 max Combat Die, counts every alternative as part of one pool, so a die can be traded for an ability and back. Pools that share options are shown as one pool. A swap does not change your subclass, your ability score increases, or the spells you know.

Level down still removes what each level up recorded. A pick you took in a swap takes the place of the pick it replaced, so levelling down removes it with that level. A pick you took to fill a shortfall, or in place of an item no level recorded, is not tied to any level and stays through a level down.

## Features that improve resting

Items and features can change how resting works through their rules: advantage on hit dice under a stated condition, always-maximized hit dice, bigger or bonus hit dice, and stronger healing potions. These show up automatically in the rest windows' Modifiers section or in the results. See the [Rules Reference: Bonuses](../reference/rules-bonuses.md).

## Related pages

- [The Character Sheet](../characters/character-sheet.md)
- [Conditions](conditions.md)
- [Rules Reference: Bonuses](../reference/rules-bonuses.md)
