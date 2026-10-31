---
title: "Dice Rolls & Chat Cards"
---

# Dice Rolls & Chat Cards

Nimble rolls dice a little differently from most systems, and the chat cards are where most of the table action happens. This page covers how attack dice behave, what the roll windows ask you, and what all the buttons on a chat card do.

## How Nimble attack dice work

When you attack, the whole damage pool is rolled at once, but only one die decides the outcome: the **primary die**, the first die of your weapon's base damage. Everything else (sneak attack dice, bonus damage, flat modifiers) just adds to the total.

- **Critical hit:** the primary die rolls its maximum value. It explodes: the die is rerolled and added to the damage, and keeps going as long as it keeps rolling maximum.
- **Miss:** the primary die normally rolls a natural 1. Some targets can raise this threshold, causing other low primary-die results to miss too. The attack misses no matter what the bonus dice rolled.
- **Advantage and disadvantage:** each level of advantage adds one extra die to the pool, and the lowest die is dropped before anything else is decided (disadvantage drops the highest instead). Advantage and disadvantage cancel each other out one-for-one, and only the leftover applies.
- **Area attacks** (anything with a template shape, such as a cone, line, or circle) can neither crit nor miss: one shared roll applies to everyone in the area.
- **No proficiency, no crit.** If a weapon requires a proficiency you don't have, you can still use it, but it won't crit. Minions never crit.

Because advantage is resolved first, a natural 1 that gets dropped by advantage does *not* cause a miss. The primary die is whichever die survives the drop.

Some special abilities roll pools where several dice can each crit independently, or where no die can crit or miss at all; the system handles those automatically based on how the item was built.

## The roll window

Clicking an ability, skill, saving throw, or initiative on your sheet opens a roll window before anything hits chat:

![The check roll window showing the advantage/disadvantage slider and formula preview](/images/documentation/roll-dialog-simple-attack.png)

- **The advantage slider.** Drag from Disadvantage ×6 through Straight Roll up to Advantage ×6. The formula preview below updates live so you can see exactly what will be rolled.
- **Hide roll** *(GMs only)*. Ticking this makes the roll a blind roll that other players can't see.
- **Roll.** Sends the result to chat.

Saving throws can start with the slider already offset: each save has a default roll mode that comes from your class and ancestry. You can review or change these defaults from the saving throw configuration window on the sheet's Core tab (with editing enabled), which also offers a reset button that recalculates the defaults from your class and items.

::: tip Hide Rolls by Default
If you're a GM who usually rolls in secret, turn on the **Hide Rolls by Default** setting. The hide checkbox will then start ticked in every roll window. See the [Settings Reference](../reference/settings.md).
:::

### The attack roll window

Attacks, spells, and other items that roll damage or healing open their own roll window. It has the same advantage slider, plus three fields for one-off changes. Leave a field empty (or at 0) and it does nothing.

In combat, the window says what the roll spends: "When you roll, it spends 1 action." From your second attack on your turn, the slider starts with the disadvantage of a Rushed Attack, and a line in the window says so. Move the slider if a feature or the GM says otherwise. A spell that the target saves against does not start with disadvantage: the rule gives the target advantage instead, so tell the GM.

- **Add to Roll (number or dice).** A bonus for this roll only, such as `2` or `1d4`. It is added to the end of the item's first damage formula. Other damage rolls of the item, and healing rolls, do not get it. It does not change the primary die, so it cannot cause a crit or prevent a miss.
- **Set Primary Die Result.** The primary die is not rolled: it shows the number you enter, from 1 up to the die's size. Enter the maximum and the attack crits and the die explodes as usual, if the attack can crit. Enter 1 and the attack misses.
- **Add to Primary Die Result.** The primary die is rolled, then this number is added to its face. The die stops at its maximum and at 1, and the rest of the number is lost. The new face decides the outcome: a d6 that rolls 5 with 1 added is a 6, so the attack crits and the die explodes, if the attack can crit. A rolled 1 with 1 added is a 2, so the attack does not miss. A d6 that rolls 6 with 1 added stays a 6: the 1 is lost.

If you fill in both **Set Primary Die Result** and **Add to Primary Die Result**, the number is added to the set result, up to the maximum. Both fields only apply to attacks that can crit or miss. They do nothing for area attacks, and the card shows nothing for them.

With advantage or disadvantage, the dice are rolled and dropped first. The set result or the added number then applies to the die that stays, so it is never dropped.

When an ability rerolls the attack, the new roll does not keep **Set Primary Die Result**: its primary die is rolled again. It keeps **Add to Primary Die Result**, and the number is added to the new face.

Some features add to the Primary Die of your attacks without the roll window. Such a feature adds its number in the same way as **Add to Primary Die Result**, and it adds to the number you type there. It can apply only to melee or only to ranged attacks, or only while a condition is true. A reroll keeps it. An area attack does not get it. The card shows one line at the roll for each of these features, with the feature's name and a tag such as **+1 to Primary Die**. Hover the line to read it as a sentence, for example "Unerring Judgment: +1 to the Primary Die".

The chat card shows what happened below the dice. A set result appears as **Primary Die Set To**. An added number appears with the face before it and the result, for example "Primary Die: 5 + 1 = 6". When the die stops at its maximum, the line says so, for example "Primary Die: 6 + 1 = 6, the max". Hover it to see who added the number, for example "Unerring Judgment +1". The die on the card always shows the result. When a feature sets the Primary Die and adds the number to the set value, the value picker shows a small badge with the number on the corner of the new value, such as **+1**. Hover the badge to see who added it.

## Anatomy of a chat card

An attack or spell card is built from a few recurring pieces:

- **Header and outcome.** The card names the item used, and the subheading calls out **Critical Hit** or **Miss** when the primary die decided one.
- **Roll summaries.** Each damage or healing roll shows its total in a box, with a damage type label. Click the arrow beside it to expand the individual dice; hovering the total shows the same breakdown as a tooltip. If the roll window set the primary die or added to it, that is shown below the dice, with the roll before the added number.
- **Apply Damage** *(GMs only)*. Applies the damage to the card's targets. If a target takes less than the rolled total, from a damage reduction rule, a monster's resistances or immunities, or a pending one-shot reduction from a feature like the Berserker's "That all you got?!", the reduced number is what lands, and the card lists each reason per target under **Reduced Damage**. The button stays available even when reduction absorbs the whole hit, and is disabled only when there's nothing to apply, for example on a miss.
- **Targets.** Tokens targeted when the roll was made are listed on the card. Buttons in this section let you add the currently selected or currently targeted tokens as targets, or remove targets, so a GM can fix up targeting after the roll. Hostile targets are highlighted so it's obvious when you're about to damage the wrong side.
- **Save prompts.** If the item forces a saving throw, the card shows the save with a d20 button: select the tokens that need to save and click it to roll the save for each of them. The card lists what happens on a failed and a successful save.
- **Condition buttons.** Conditions the item inflicts appear as buttons. Click one to apply the condition to all selected tokens. See [Conditions](conditions.md).
- **Rerolls and changes.** Under the roll, before **Apply Damage**, the card shows one button for each thing that features can do to the roll: **Reroll** and **Change die**. When two or more features give the same button, the button shows how many. A click on a button always opens a menu, also when only one feature gives it, so you see the feature and its uses before you spend one. In the menu, the features are under the name of each character, and the cost of each feature is at the right (uses left, Mana, Wounds, 1 action or a Heroic Reaction). Click a feature to use it. Hover a feature to read the full sentence, for example "Reroll with Unstoppable Brutality (1 Wound)". The arrow keys move through the menu, and Escape closes it. Some features show a short note under their name, such as a limit that the table checks. A feature is gone from the menu when it has no uses left, and a button is gone when no feature gives it. See [Changing a die](#changing-a-die) for the **Change die** button. After a reroll, the roll shows one line for each reroll of the last action: the reroll you made and each reroll that happened by itself after it, in roll order, the first at the top. Each line names the feature that rerolled, for example "Pocket Sand", and shows the old Primary Die, paler, with an arrow to the new one. Hover the line to read it as a sentence, for example "Rerolled with Pocket Sand". A reroll that happened by itself, with no click, starts with an **Automatic** tag, and its sentence says so, for example "Rerolled automatically by Warding Bond". This is also true for a reroll that happened before the card was posted, and features that add to a reroll also add to an automatic one. A crit die is green and a miss die is red. A smaller line under it tells who used it, the uses left and any Wounds gained. When a feature can reroll again, it stays in the **Reroll** menu, and its sentence starts with "Reroll again with". The lines of that feature then keep only what the menu and the card's header do not already say. Each new use from a menu starts a new list. With Dice So Nice on, the roll on the card turns into a tumbling die while the dice are in the air, for everyone at the table, and the new result shows when they land. When the feature keeps the triggers of a crit it rerolled and the new roll misses, the target's when-crit abilities trigger at once. When the new roll hits, they trigger when the damage is applied. They trigger one time for each card.
- **Options.** Other features that act on the card appear after **Apply Damage**, under an **Options** heading. They use the same buttons and menus as rerolls: one **Add Damage** button and one **Interpose** button, each with a menu of the features under each character's name. Defensive ones belong to whoever was attacked, such as an Interpose to take a hit for an ally. Offensive ones belong to the attacker: a feature that spends dice to add damage, like the Berserker's Death Blow, shows in the **Add Damage** menu once the attack lands the way the feature needs. Each feature can be used once per card. Once used, the card records what it did so the table can see where the extra damage came from.

A player sees only the features of the characters they own. The GM sees all of them.

![An attack chat card showing a damage total, the Apply Damage button, a targets list, and a saving throw prompt](/images/documentation/condition-chatcard-with-button.png)

## Rerolling a save or check

A save, skill check or ability check card is one line, so its rerolls and changes use a small button at the right end of the roll. Only the owner of the one who rolled, the owner of an ally with such a feature, and the GM see it.

A click on the button always opens a short menu, also when only one feature gives it, so you see the feature and its cost before you spend a use. The features are under the headings **Reroll** and **Change a die**, each with its cost at the right. Click one to use it. The arrow keys move through the menu, and Escape closes it. With one feature, hover the button to see it and its cost, for example "Reroll with Unstoppable Brutality (1 Wound)".

A change that sets a value opens the value picker in place, on the line of the roll. See [Changing a die](#changing-a-die).

The button shows only while a feature can be used on the roll and has a use left. It comes back or goes away by itself when the character's uses, Mana or Wounds change. While the Dice So Nice dice are in the air, the roll on the card is a tumbling d20, as on an attack card. After a reroll, the same lines as on an attack card show under the roll, with the old d20 and the new one. Cards posted before this version show no button.

## Rerolls from an ally

Some features let a character reroll an ally's roll, such as the Songweaver's Inspiration and the gnome's Optimistic. When an ally makes a roll, the character's feature shows in the menu on the ally's card, under the character's name, for the character's owner and the GM. Two player characters are always allies. For other tokens, the token disposition decides. A feature with a Reach shows only when its token is within that many spaces of the ally's token when the roll is made. An attack with an area has no reroll or change buttons.

When a disposition or a Reach kept an ally's reroll off a card, the GM sees one quiet line under the options, for example "1 ally reroll left out". Open it to see each reroll and why it was left out. Click **Add** to give the ally's owner the feature on that card.

### Rerolling one die

Some features reroll one die and keep the others. When the player picks the die, a click on the feature opens the dice of the roll, with the Primary Die marked. Click a die to reroll it, or click **Cancel** or press Escape to close the dice and go back to the buttons. The arrow keys move between the dice. On a save or a check rolled with advantage or disadvantage, you can also pick the d20 that was dropped. The roll then keeps the highest or lowest again and works out the hit, the crit and the total again. A Primary Die that rolls its maximum explodes, and one that no longer rolls its maximum loses its explosion dice. With Dice So Nice on, only the rerolled die is thrown. With manual dice entry on in Foundry's Dice Configuration, the new die and each explosion die are asked for, as for a whole reroll. A player's reroll is rolled on the GM's client, so the GM's dice settings apply to it.

### Keeping either result

Some features let a player keep the new result or the old one. After the dice roll, two **Keep** buttons show under the reroll line, for example **Keep 9** (Miss) and **Keep 12** (Hit). The player who keeps a result and the GM see them; everyone else sees who keeps it. Until a result is kept, the card keeps the old roll, no other reroll can be used, and **Apply Damage** says "Keep a result first". Hover the reroll line to read the kept total, for example "Rerolled with Songweaver's Inspiration, kept 12". The feature's use is spent either way.

### Features that add to a reroll

Some features add to another feature's reroll, such as the Songweaver's Unfailing Courage, Heroic Ballad, Fire in my Bones and Inspiring Presence on Songweaver's Inspiration. What they did shows as small tags under the reroll line. Hover a tag to see the feature.

- **Advantage** or **Disadvantage:** the reroll was rolled with it. On a reroll of one die, that die is rolled two times and the higher (or lower) stays. The tag's tooltip tells both results.
- **Extra damage,** for example **+3 Heroic Ballad:** added to the attack's damage when its result stands, also when a player keeps the old result. It is part of the total in the roll box and on the **Keep** buttons.
- **Actions,** for example **Wren +1 action:** the one who rolled gains them at once. Only a hero in combat gains actions. Otherwise the tag says why no action was given.
- **Temp HP,** for example **3 temp HP to 2 creatures** or **3 temp HP to Wren:** the one who rolled and their allies near the feature's owner gain temp HP. Click the tag to see who. Temp HP does not add up, so each creature keeps the larger amount: a creature that already has as much temp HP or more keeps its own. The list tells both amounts, for example "Bram keeps 5, not 3" or "Tam had 1, now has 3". The rules let each creature choose which amount it keeps, so a player who wants the other amount changes it on the sheet. When the owner has no token on the scene, nobody gains temp HP.

Advantage and extra damage count one time for each attack, however many times the reroll is used. Actions and temp HP come with each use. They are given when the reroll is used, not when a result is kept. With **Feature Effects** off in the Automation settings, the action and temp HP tags are dashed, with a hand, and a note under them says what to give by hand.

## Changing a die

Some features put a new value on one die that was already rolled. No die is rolled again. On an attack card they are in the **Change die** menu. On a save or check card they are under the **Change a die** heading. The feature decides which die it changes: the Primary Die, or one die that you pick. On a save or a check, the Primary Die is the d20. The feature also decides how it changes the die: it sets the die to a value that you pick, or it adds a number.

**Set to a value.** Click the feature. If the feature lets you pick the die, the dice of the roll open first: click the die to change. Then the value picker opens. It shows the old die, an arrow, and the new value between a **-** and a **+** button. You can also type a value from 1 to the die's max. The arrow keys move the value up or down. The **1 (lowest)** button goes to 1, and the highest button goes to the max, for example **8 (highest)** on a d8. Click **Set to 8** (the button shows the value) or press Enter to change the die. Click **Cancel** or press Escape to close the picker.

**Add a number.** Click the feature. If the feature lets you pick the die, click the die. The die gets the number at once. A die never goes below 1 or above its max.

**What happens next:**

- The other dice do not change. A kept die stays kept and a dropped die stays dropped: advantage and disadvantage are not worked out again.
- The crit, the miss and the total are worked out again. A Primary Die that becomes its max is a crit, and it explodes as usual. A crit that goes away loses its explosion dice. With Dice So Nice on, only the new explosion dice are thrown.
- The card then follows the new result, as after a reroll: **Apply Damage**, the charge refills on a hit or a crit, and the features that need a hit or a crit.
- A later reroll of that die discards the changed value.
- Features that add to a reroll do not add to a change.

**A number added to the Primary Die.** A number from **Add to Primary Die Result** or from a feature that adds to the Primary Die changes the face of the die. The feature decides what a set value does with that number:

- **Most features:** the value that you set is the final face. The number is not added. So a set to the max is a crit, and a set to 1 is a miss. The card then shows no "Primary Die: 5 + 1 = 6" line for the die.
- **A feature that adds the number:** the number is added to the value that you set, up to the max. For example, with +1, a d8 set to 5 shows 6, and a d8 set to 8 stays 8. The value picker shows the number as a badge on the new value.

An added change moves the face that the die shows, as it is. A later reroll of the die is a new roll, so it gets the number again.

**The line on the card.** After a change, the roll shows a line, as after a reroll. The line names the feature and shows the old die, paler, with an arrow to the new one. Above the arrow is a small label: "set" for a set value, or the number for an added one, such as "+1". When the new die is a crit or a miss, the line has a **Crit** or **Miss** tag. Hover the line to read it as a sentence, for example "Changed with Vicious Opportunist: 3 became 8, a crit".

## Rerolls and changes that cost an action

Some rerolls and changes cost 1 action. The menu shows "1 action" as the cost. Only a hero in combat spends the action:

- **On your own turn,** you spend the action at once. With no actions left, the feature does not show.
- **Off your turn,** your next turn starts with 1 fewer action.

This is not a Heroic Reaction, so there is no limit of 1 for each round. Out of combat, nothing is spent. The action follows the **Costs** toggle in the Automation settings, not **Action Spending**: with **Costs** off, nothing is spent or checked. When the reroll or change cannot be made, the cost is given back.

## Spending dice from a card

A feature that adds damage when an attack lands puts itself in the **Add Damage** menu on that attack's card rather than asking you to run it separately. Click **Add Damage**, click the feature, pick which dice to spend, and confirm: the bonus is added to the attack's own damage total, so the number in the roll box goes up and the GM still clicks **Apply Damage** exactly once.

This matters for more than convenience. Applying the bonus as a second, separate hit would make the target's armor, resistances and damage reduction count twice against one attack, which is why the card folds it in instead. Because the feature only appears when the attack landed the way the feature requires, a feature that works only on a critical hit will not offer itself on an ordinary hit.

Spend before the GM applies damage. The card raises its own total, so a spend confirmed after damage has already been applied will not go back and adjust HP that has already been removed.

## Targeting

Target tokens (default key: T) before you roll and they'll appear on the card automatically. Forgot? Use the card's target buttons to add the tokens afterwards. Damage application and save prompts work off the card's target list, not whatever is selected when the GM clicks Apply.

## Roll visibility

Two per-player settings shape what you see in chat:

- **Auto-Expand Rolls**: always show the dice breakdown under each roll total instead of requiring a click.
- **Hide Rolls by Default**: start every roll window with the GM's hide checkbox ticked.

Both are described in the [Settings Reference](../reference/settings.md).

## Related pages

- [The Character Sheet](../characters/character-sheet.md)
- [Conditions](conditions.md)
- [Settings Reference](../reference/settings.md)
