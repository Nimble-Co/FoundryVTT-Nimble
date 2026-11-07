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
- **Attacks on 2 or more targets** can neither crit nor miss either. One roll applies to all the targets, and the targets' own reactions do not apply. The card shows "No miss: 2 targets" when the die shows a miss face, and "No crit: 2 targets" when it shows its max. Other rolls show nothing.
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

Some features add a tick to the window:

- **Max damage.** No die is rolled. The total is the max of the formula, after upcast. The tick says the cost. A card from this tick has no reroll or die change rows, because no die was rolled. A feature can also make the attack a hit or a crit with this tick, and a tag on the card tells why.
- **Dual wield (1/round).** It shows with 2 equipped weapons, and on an Unarmed Strike. The system does not check the Light property or your STR: that is for the table. With the same damage formula, the tick is advantage. With a different formula, both weapons roll and the card asks which result you keep. If you keep the second weapon, its damage type and item bonuses apply. Effects on a hit stay with the weapon you used. With other advantage, the window asks which weapon gets the extra die. A reroll of the attack rolls both weapons again, and you choose again.
- **Spend 1 less mana.** See [The Chaos Table](#the-chaos-table).
- **Use without a charge.** It shows on Beastshift, starts off, and spends no charge when ticked: for Swiftshift and Friend of Beasts. Swiftshift says a free Beastshift gives no temp HP. The system does not track that: it is for you.

The chat card shows what happened below the dice. A set result appears as **Primary Die Set To**. An added number appears with the face before it and the result, for example "Primary Die: 5 + 1 = 6". When the die stops at its maximum, the line says so, for example "Primary Die: 6 + 1 = 6, the max". Hover it to see who added the number, for example "Unerring Judgment +1". The die on the card always shows the result. When a feature sets the Primary Die and adds the number to the set value, the value picker shows a small badge with the number on the corner of the new value, such as **+1**. Hover the badge to see who added it.

## Anatomy of a chat card

An attack or spell card is built from a few recurring pieces:

- **Header and outcome.** The card names the item used, and the subheading calls out **Critical Hit** or **Miss** when the primary die decided one.
- **Roll summaries.** Each damage or healing roll shows its total in a box, with a damage type label. Click the arrow beside it to expand the individual dice; hovering the total shows the same breakdown as a tooltip. On a Vicious crit, the Vicious dice show on their own line after the Primary Die, for example "1d4 [Vicious]", with their own total. A Vicious die never gets the green crit mark, because only the Primary Die can crit. If the roll window set the primary die or added to it, that is shown below the dice, with the roll before the added number.
- **Apply Damage** *(GMs only)*. Applies the damage to the card's targets. If a target takes less than the rolled total, from a damage reduction rule, a monster's resistances or immunities, or a pending one-shot reduction from a feature like the Berserker's "That all you got?!", the reduced number is what lands, and the card lists each reason per target under **Reduced Damage**. The button stays available even when reduction absorbs the whole hit, and is disabled only when there's nothing to apply, for example on a miss.
- **Targets.** Tokens targeted when the roll was made are listed on the card. Buttons in this section let you add the currently selected or currently targeted tokens as targets, or remove targets, so a GM can fix up targeting after the roll. Hostile targets are highlighted so it's obvious when you're about to damage the wrong side.
- **Save prompts.** If the item forces a saving throw, the card shows the save with a d20 button: select the tokens that need to save and click it to roll the save for each of them. The card lists what happens on a failed and a successful save.
- **Condition buttons.** Conditions the item inflicts appear as buttons. Click one to apply the condition to all selected tokens. See [Conditions](conditions.md).
- **Rerolls and changes.** See [Change This Roll](#change-this-roll) for how to use them. After a reroll, the roll shows one line for each reroll of the last action: the reroll you made and each reroll that happened by itself after it, in roll order, the first at the top. Each line names the feature that rerolled, for example "Pocket Sand", and shows the old Primary Die, paler, with an arrow to the new one. Hover the line to read it as a sentence, for example "Rerolled with Pocket Sand". A reroll that happened by itself, with no click, starts with an **Automatic** tag, and its sentence says so, for example "Rerolled automatically by Warding Bond". This is also true for a reroll that happened before the card was posted, and features that add to a reroll also add to an automatic one. A crit die is green and a miss die is red. A smaller line under it tells who used it, the uses left and any Wounds gained. When a feature can reroll again, it keeps its row, and the row says **Reroll Again**. The lines of that feature then keep only what the row and the card's header do not already say. Each new use from a row starts a new list. With Dice So Nice on, the roll on the card turns into a tumbling die while the dice are in the air, for everyone at the table, and the new result shows when they land. When the feature keeps the triggers of a crit it rerolled and the new roll misses, the target's when-crit abilities trigger at once. When the new roll hits, they trigger when the damage is applied. They trigger one time for each card.
- **Reactions.** On an attack that hits a hero, the heroes who can Defend or Interpose get a button. See [Defend and Interpose](#defend-and-interpose).
- **Other features that act on the card.** They are rows of **Change This Roll** too, such as **Add Damage**. Offensive ones belong to the attacker: a feature that spends dice to add damage, like the Berserker's Death Blow, shows as a row once the attack lands the way the feature needs. Each feature can be used once per card. Once used, the card records what it did after **Apply Damage**, so the table can see where the extra damage came from.

A player sees only the features of the characters they own. The GM sees all of them.

![An attack chat card showing a damage total, the Apply Damage button, a targets list, and a saving throw prompt](/images/documentation/condition-chatcard-with-button.png)

## Defend and Interpose

In a combat that has started, an attack card that hits a hero has a **Reactions** section under the damage. It has one button for each hero who can react: each hero the attack hits, and each ally who can Interpose for them. Interpose is there only when the attack has one target. The GM sees all the buttons. A player sees only their own heroes. A player with one hero there gets one wide **React as** button with the hero's name.

The button opens the Defend window. Its heading tells the attack, the hero it hits and the damage, for example "Fire Breath hits Pip for 14". Each row is one thing you can do, with its cost and the damage you take:

- **Defend**: for a hero the attack hits. The cost shows the actions and your Armor. The damage you take shows the damage without the Defend, struck through, and the damage after your Armor.
- **Interpose**: for an ally within 2 spaces of the hero, or within the range of an Interpose feature. A feature changes only the range: the Interpose still costs 1 action, and you can Interpose one time each round. You become the target and take the full damage. Move the tokens yourself. As the new target, you get your own rows under Change This Roll, such as a reroll that a feature gives the target.
- **Interpose and Defend**: you become the target and your Armor comes off the damage.

Pick a row, then click the button at the bottom. **Cancel** does nothing. When the reaction is already spent, you have no actions left, or it is your turn, a window asks one time if you want to use it anyway. Defend costs 1 more action when you wear armor or a shield that you are not proficient with.

After a Defend, the hero's target row shows a green shield and the damage after the Armor. **Apply Damage** takes the Armor off one time for the whole attack. Damage that ignores armor keeps its full value. Vulnerable damage doubles first, and then the Armor comes off. Until the damage is applied, the GM has two buttons on that target row:

- **The shield**: click it when the damage cannot be avoided, at the GM's discretion. The shield goes grey and no Armor comes off. Click it again to take the Armor off again.
- **Undo** (the arrow): takes the Defend back and gives back the reaction and the actions it spent.

A hero's button goes away when their damage is applied. On a minion group attack, one Defend covers the whole attack, so the Armor comes off the total. A creature that is Latched On cannot be Defended or Interposed against: the GM sees a line that says so, and no buttons show.

The **Defend**, **Interpose** and **Interpose and Defend** buttons on the character sheet and on the hotbar open the same window, on the newest attack card of the combat that the hero can still react to. With no such card, they post the reaction card as before.

### When you Defend

Features that do something when you Defend show in the window too:

- **When you Defend** ticks show under the rows, for example Pocket Sand, Decoy or Misdirection. Most ticks work only with a row that Defends. A tick that cannot go with the row you picked is gray. Tick as many as you want; the damage you take changes with each tick. They go in a fixed order: the attack misses or you take no damage, then half the damage or the Armor, then the rest. Half the damage replaces the Armor and rounds up.
- **Free Defend** rows Defend with no action, for example Slipstream or a "Reaction: Defend for free" spell. A spell row casts the spell, with its own mana and action. A free Defend still uses your Defend for the round; when it is already used, a window asks first.
- **A second Defend**: with a feature such as Shield Expert, the Defend rows say so when your Defend is already used this round. No window asks.
- **A Defend for the whole round** (Whirling Defense) gives a row on each later attack on you until your next turn, with nothing more to spend.

What a tick costs (charges, mana, Wounds) is spent when you click the button. A tick that uses a feature's reroll (Pocket Sand) rerolls the attack after the Defend; its row does not show under Change This Roll. With Interpose and Defend, the reroll comes when you become the target. When the attack does not give that reroll, a warning tells you and the tick is not used. Some ticks also go with Interpose alone, for example Fearsome ("Whenever you Interpose or Defend") and Bunny Legs ("Before Interposing"). With Interpose alone, the tick pays its cost or uses its reroll, and its line shows as a message to you; it does not change the damage. A condition on the attacker (Pocket Sand blinds) is put on by the GM's client; it can end by itself at the start of the attacker's next turn. A move, an attack back or damage back is not done for you: the card shows a line, for example "Decoy: Move up to half your speed away.", and the table does it.

A feature that is "1/turn" (Burst of Speed, Vicious Opportunist) has one use each turn, of any creature, for all its rows. When it is already used this turn, its rows do not show. The turns are the turns of the combat tracker: a minion group has one turn for all its minions, each other monster has its own turn, and a solo monster has a turn after each hero.

A feature that reacts when an ally Defends (Exploit) gives its hero a button on the card after an ally within range Defends. The button spends the cost and adds the feature's line.

When the GM turns the shield off for damage that cannot be avoided, half the damage stops too; a miss or no damage stays. The shield on the target row names the features used. **Undo** also gives back what each feature spent. A reroll and a condition stay; the GM removes a condition by hand.

## The result of a save or check

When a save, skill check or ability check has a known DC, the small line under its name tells the result, such as "Failed - DC 14" or "Succeeded - DC 14". A total that meets the DC succeeds. On a save or a skill check, a natural 1 always fails and a natural 20 always succeeds, so the card says "Failed" or "Succeeded" also with no DC. With no DC and no natural 1 or 20, the card tells no result: compare the total at the table. The line only reports. It applies no damage and no effect by itself. A feature of the creature that made the save can react to a failed save with the Apply Condition rule. If the same card later says Succeeded, that condition goes away again. A condition from another source stays.

## Change This Roll

All roll cards (attack, save, skill check and ability check) have one control for what features can do to the roll. It is a full-width button under the roll, **Change This Roll (3)**. The number tells how many rows you see. You see the rows that you can click. You also see an add that a natural 1 stops, but you cannot click it (see [Changing a result](#changing-a-result)). A user with no rows sees no button and a plain card. On an attack card, these include rows for the one who was attacked and for allies.

The button opens the rows. It opens by itself when a save or check card says **Failed**, and on an attack that misses. On a card that says **Succeeded**, on an attack that hits, and on a card with no result, it starts closed. You can open or close it at any time, and it stays as you left it when the card updates.

Each row is one button, for example **Reroll** with Lucky, **Change Die** with Soothsayer, **Succeed Instead** with Elusive, **Make It a Crit** with Vicious Opportunist or **Add Damage** with Death Blow. The cost is at the right (uses left, Mana, Wounds, 1 action or a Heroic Reaction). Click the row to use the feature. The button alone never uses anything, so you see the feature and its cost before you spend a use. When a row needs a choice, the choice opens under the row: a die to pick or a value to set. When a character other than the one who rolled gives rows, their name is above them. Some rows show a short note, such as a limit that the table checks. A row is gone when the feature has no uses left.

With the keyboard, Enter or Space works the button. The arrow keys, Home and End move through the rows, and Escape closes them and goes back to the button. When a row goes away after you use it, the focus goes to the button. When the last row goes away, the focus goes to the card.

## Rerolling a save or check

Only the owner of the one who rolled, the owner of an ally with such a feature, and the GM see the rerolls and changes of a save, skill check or ability check card. They are in [Change This Roll](#change-this-roll), under the roll.

A change that sets a value opens the value picker in place, on the line of the roll. See [Changing a die](#changing-a-die).

A row shows only while a feature can be used on the roll and has a use left. It comes back or goes away by itself when the character's uses, Mana or Wounds change. While the Dice So Nice dice are in the air, the roll on the card is a tumbling d20, as on an attack card. After a reroll, the same lines as on an attack card show under the roll, with the old d20 and the new one. Cards posted before rerolls show no button.

Some rows are only for a failed roll. When the card says **Succeeded**, such a row goes away, and it comes back when the result goes back to **Failed**. When the card has no DC, it has no result, so the row shows and you decide.

### Rerolling with another stat

Some features reroll with another stat. The row says **Reroll With Another Stat**. Click it to open the three other stats under the row, with their modifiers, for example **DEX +2**, **INT +0** and **WIL −1**. Click a stat to reroll, or click **Cancel** or press Escape to close the stats and go back to the row. No other menu opens. The new roll keeps the advantage or disadvantage of the first roll.

- **A save** uses the save modifier of the new stat.
- **A skill or ability check** swaps the stat part and keeps the other bonuses.
- **An attack** swaps the stat part of the formula. An attack with no stat part has no row.

The reroll line has a tag, such as **With DEX**. The card keeps its name, so a STR save that was rerolled with DEX still says STR.

## Rerolls from an ally

Some features let a character reroll an ally's roll, such as the Songweaver's Inspiration and the gnome's Optimistic. When an ally makes a roll, the character's feature shows as a row on the ally's card, under the character's name, for the character's owner and the GM. Two player characters are always allies. For other tokens, the token disposition decides. A feature with a Reach shows only when its token is within that many spaces of the ally's token when the roll is made. An attack with an area has no reroll or change rows.

When a disposition or a Reach kept an ally's reroll off a card, the GM sees one quiet line under **Change This Roll**, for example "1 ally reroll left out". Open it to see each reroll and why it was left out. Click **Add** to give the ally's owner the feature on that card. An enemy of the creature that rolls is never in this list: a Friendly token is not listed for a Hostile roll, and a Hostile token is not listed for a Friendly roll.

### Rerolling one die

Some features reroll one die and keep the others. When the player picks the die, a click on the row opens the dice of the roll under it, with the Primary Die marked. Click a die to reroll it, or click **Cancel** or press Escape to close the dice and go back to the row. The arrow keys move between the dice. On a save or a check rolled with advantage or disadvantage, you can also pick the d20 that was dropped. The roll then keeps the highest or lowest again and works out the hit, the crit and the total again. A Primary Die that rolls its maximum explodes, and one that no longer rolls its maximum loses its explosion dice. With Dice So Nice on, only the rerolled die is thrown. With manual dice entry on in Foundry's Dice Configuration, the new die and each explosion die are asked for, as for a whole reroll. A player's reroll is rolled on the GM's client, so the GM's dice settings apply to it.

### Rerolling several dice

A feature can let you pick more than one die, such as Elemental Destruction after a spell hit. Click the row, click each die you want, and look at the count and the cost under the dice. The cost is per die. Click **Reroll** to pay and roll. **Cancel** costs nothing. You can pick the Primary Die, and the system reads the crit and the miss again.

### Keeping either result

Some features let a player keep the new result or the old one. After the dice roll, two **Keep** buttons show under the reroll line, for example **Keep 9** (Miss) and **Keep 12** (Hit). The player who keeps a result and the GM see them; everyone else sees who keeps it. Until a result is kept, the card keeps the old roll, no other reroll can be used, and **Apply Damage** says "Keep a result first". Hover the reroll line to read the kept total, for example "Rerolled with Songweaver's Inspiration, kept 12". The feature's use is spent either way.

### Features that add to a reroll

Some features add to another feature's reroll, such as the Songweaver's Unfailing Courage, Heroic Ballad, Fire in my Bones and Inspiring Presence on Songweaver's Inspiration. What they did shows as small tags under the reroll line. Hover a tag to see the feature.

- **Advantage** or **Disadvantage:** the reroll was rolled with it. On a reroll of one die, that die is rolled two times and the higher (or lower) stays. The tag's tooltip tells both results.
- **Extra damage,** for example **+3 Heroic Ballad:** added to the attack's damage when its result stands, also when a player keeps the old result. It is part of the total in the roll box and on the **Keep** buttons.
- **Actions,** for example **Wren +1 action:** the one who rolled gains them at once. Only a hero in combat gains actions. Otherwise the tag says why no action was given.
- **Temp HP,** for example **3 temp HP to 2 creatures** or **3 temp HP to Wren:** the one who rolled and their allies near the feature's owner gain temp HP. Click the tag to see who. Temp HP does not add up, so each creature keeps the larger amount: a creature that already has as much temp HP or more keeps its own. The list tells both amounts, for example "Bram keeps 5, not 3" or "Tam had 1, now has 3". The rules let each creature choose which amount it keeps, so a player who wants the other amount changes it on the sheet. When the owner has no token on the scene, nobody gains temp HP.

- **Cannot fail:** on a save or a check, the new roll succeeds. The history says **Succeeded Instead** with the feature, with no **Remove**. No **Keep** buttons show. On an attack, the reroll line has a **Cannot miss** tag, and the attack hits. It is a crit only when the die makes a crit.

Advantage and extra damage count one time for each attack, however many times the reroll is used. Actions and temp HP come with each use. They are given when the reroll is used, not when a result is kept. With **Feature Effects** off in the Automation settings, the action and temp HP tags are dashed, with a hand, and a note under them says what to give by hand.

## Changing a die

Some features put a new value on one die that was already rolled. No die is rolled again. They are **Change Die** rows in [Change This Roll](#change-this-roll). The feature decides which die it changes: the Primary Die, or one die that you pick. On a save or a check, the Primary Die is the d20. The feature also decides how it changes the die: it sets the die to a value that you pick, or it adds a number.

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

After a set with a feature that makes the set value final, a Primary Die bonus line on the card shows "+1 bonus not added". Its tooltip says why.

## Changing a result

Some features change the result of a save, a skill check, an ability check or [Initiative](#the-initiative-card), after the roll. One changes what an attack does to its target. They are rows of [Change This Roll](#change-this-roll). A row shows also when the card knows no DC, because the system cannot tell if the roll failed. The dice on the card do not change. Open the dice to see what they gave.

- **Succeed Instead** with Elusive. The card says **Succeeded**, or **Succeeded - DC 14** with a DC. The total stays. The row goes away while the change stands. The other rows stay under the closed button, because a reroll can still replace the result. The history line says **Succeeded Instead** with Elusive.
- **Change to 10** with Cheat!. The total becomes that number. The history line says **Changed 7 to 10** with Cheat!. The row does not show when the total is already that number. Some features show the row only when the total is below that number.
- **Add +3 STR** with Mighty Soul. The number goes on the total. A negative number shows as **Add −1 STR**, and lowers the total. The row stays, so you can click it again while you can pay its cost. You can click it to gain your last Wound. Repeated clicks make one history line that grows: **Added +6 STR, Gained 2 Wounds** with Mighty Soul.

A box above the history shows how the total came from the roll, such as **7 + 3 + 3 = 13** or **7 changed to 13**. It shows only when the total is different from the roll.

A known DC is read again after each change, and the small line under the name follows it. A natural 1 on a save or a skill check still fails after an add, and a natural 20 still succeeds. So on a natural 1, an add row such as **Add +3 STR** stays in the list, but you cannot click it. Its note says **A roll of 1 always fails**. A reroll that replaces the 1 makes it usable again. A change to a number replaces the roll, so only that number and the DC count. When the card goes to **Succeeded** on a save, a condition that the save added goes away again.

**Counts as a natural 20.** Some features count a total of 1 or less as a natural 20. This happens by itself and costs nothing, and the dice on the card do not change. The total is 20 plus the modifier of the roll, and the save or check succeeds. The box says **Rolled 1, counts as 20 − 1 = 19**. The history says **Counts as a Natural 20** with Bumblewise, with no **Remove**. It is read again after a reroll. With **Feature Effects** off in the Automation settings, a row **Count as a Natural 20** shows instead, and you click it.

An Assess also reads **Counts as a Natural 20**. A total of 1 or less on a skill that the feature covers succeeds, for example Insight with Bumblewise. The card then says **Counts as a Natural 20** with Bumblewise. The Assess card has no row, so with **Feature Effects** off the card shows a failure, and the table settles the result.

**No damage.** Some features let the target of an attack take no damage from it. After a hit, the target's owner and the GM see a row, for example **No Damage** with Epic Resistance, with its uses left. Click it, and that target takes no damage from any part of this attack when you click **Apply Damage**. The other targets take their damage as usual. The target shows a **No Damage** tag on the card. The history says **No Damage for** the target **with** the feature. **Remove** gives the cost back until the damage is applied.

**Remove.** Each of these lines has a **Remove** button, for the user who can click the row and for the GM. A click takes that change off the card and reads the result again. The uses, Mana and Wounds it cost come back. An action or a Heroic Reaction it cost comes back only in the same turn. After the turn ends it stays spent, and the line says so under its text. A line that grew removes all its clicks and gives back all its Wounds. The other changes stay in their order, and the total is worked out again. Rerolls and changes of a die have no **Remove**. A change that happened by itself has none, and neither does **No Damage** after the damage is applied.

**A reroll replaces the result.** The new roll is the new total, and the added, set and succeed changes come off. Their costs stay paid, and any Wounds stay. Their lines stay in the history, with no **Remove**. The box starts again from the new roll. A change of a die is not a new roll, so the changes stay on the total.

## The Initiative card

An Initiative roll posts a card in the same layout as a check card. The small line under the name tells how many actions a hero starts combat with: **Start with 1 action**, **Start with 2 actions** or **Start with 3 actions**. A total of 10 or more gives 2. A total of 20 or more, or a natural 20, gives 3. A monster's card does not show this line. While the dice of a reroll are in the air, the line is hidden, so it cannot tell the result early. Initiative has no DC, so the card never says Failed or Succeeded. Initiative messages that were posted before this card stay as they were.

A feature can change the total with a row of [Change This Roll](#change-this-roll), such as **Change to 10** with Cheat!. The right side of the row tells the gain, **Start with 2 actions**, when the feature has no other cost to show. The button stays closed until you click it. A row with **Only if the total is lower** does not show at that total or above it. A change to a number replaces the roll, so a natural 20 does not count after it. An added number keeps the natural 20. The history line says **Changed 7 to 10** with Cheat!.

The change also goes to the combat tracker, for the combat and the combatant that made the roll:

- The combatant's Initiative becomes the new total, and the starting actions follow it.
- If you did not spend your actions yet, your current actions become the new number.
- If you click later, the difference between the old and the new number goes on your current actions. Current actions never go below 0.
- An action adjustment that waits for your next refill stays waiting.
- **Remove** does the reverse, and gives the cost back.

The change stays on the card only, and the tracker does not change, when that combat or combatant is gone, when the roll was made outside a combat, or when the combatant has a different Initiative now (a new roll, or a number the GM set by hand).

### Surge dice

Elemental Surge rolls on the Initiative card, the first time you roll Initiative in a combat. The card shows the total and the dice, and you get the mana. The mana can go above your max. At the end of combat, the mana above what you had before the surge goes away. Mana you spent counts as surge mana first.

With Steel Will, each 1 on a surge die rolls again one time by itself, and a line on the card says so.

With Feature Effects off, the card shows the dice, a **Reroll a 1** row for each 1 when you have Steel Will, and a **Regain mana** button. The one who rolled, the GM and a player who owns the hero can click them.

## Why an attack is a crit, or a hit

A feature can change how the roll is read. When the die does not explain the result, a tag at the roll names the cause:

- **"Crit: Deathbringer's Touch"** when a feature made a face below the max a crit. The tag does not show when the die rolled its max.
- **"Cannot miss: Slashing"** when a feature made a miss face a hit.

**Incapacitated targets.** A melee hit against an Incapacitated, Paralyzed, Petrified, Stunned or Unconscious creature is a crit. The tag says "Crit: target Stunned". A miss stays a miss, and a roll that cannot crit stays that way. With **Feature Effects** off, the card has a free **Make It a Crit** row for the one who attacked.

The expanded roll details mark a Primary Die face that is a crit or a miss in the same way.

## Crit dice

A crit can roll more dice by itself. They show as a labelled line on the attack card, for example "Sneak Attack: +7". Hover the line to read the dice.

- **Sneak Attack dice** roll on a crit, 1/turn. An attack on the turn of another creature can use them too. A reroll or a Make It a Crit row that gives the crit adds the dice. A reroll that takes the crit away removes them and gives the use back. These dice do not explode and are not Vicious, and a die at its max here does not make a crit. With Feature Effects off, they are a row in Change This Roll.
- **Twist the Blade** is a row that picks a Sneak Attack die and sets its value. With no action left, the row still works and the card says so. Rank 2 is free, 1/turn, and takes the place of the paid row until you use it.
- **Cunning Strike** is a row that spends a use, then the target makes a save with the roll window, on a normal save card. A player who owns the target and is online rolls it. If not, the GM rolls it. Closing the window gives the use back. A failed save sets the Sneak Attack dice to their max. A passed save gives the use back. Until the save has a result, nothing changes.
- **Epic Criticals** makes the first crit die a d20 by itself, with a tag. A 20 explodes again with the die of the weapon. With Feature Effects off, it is a **Use a d20** row.
- **Hollow Bones** makes a crit against the one with this rule Vicious, with a tag. With Feature Effects off, it is a row for the owner of that target.

**Any die crits.** A rule such as Shatter makes a crit from any die at its max. A change of one die reads this again, and adds or removes the crit dice. Shatter has one **+1 to a die** row per upcast step, and you can use more than one on the same die.

## Shadow Rush

Shadow Rush is a feature you use from the sheet, once per shadow minion. The card deals the max of the minion's attack, 12 necrotic damage. It hits and does not crit. Remove that minion yourself: the system does not track shadow minions yet.

## Judgment Dice when you are attacked

Radiant Judgment and Maximum Judgment run when an attack card has you as a target, hit or miss. A reroll of that card does not run them again, and neither does its damage. If damage from a card that did not target you hits you, they run then.

## The Chaos Table

A hero with Force of Chaos has a tick in the spell window, **Spend 1 less mana**. It does not show when the spell costs no mana. The tick or a crit on any attack rolls on the Chaos Table by itself, one roll per attack card, also after a reroll. With Feature Effects off, a crit shows a **Roll on the Chaos Table** button.

Chaos Lash rolls on the Chaos Table each time you use it. With Feature Effects off, its card shows the **Roll on the Chaos Table** button.

Each roll has its own Chaos card. The world setting **Show Chaos Table rolls** tells what the card shows. It is off by default, because the book says that the table is secret. Off: the player sees only the number, and the GM gets the text in a whisper. On: the text is on the card.

With Thrive in Chaos, the card shows three buttons before the roll: **Roll once**, **Roll twice, both happen**, and **Roll twice, choose one**, which costs 1 use per Safe Rest. With Master of Chaos, each table roll has advantage.

The system shows the text of the table only. It applies no effect of the table.

## Making an attack a crit

Some features let a creature make an attack a crit after the roll. The card has a **Make It a Crit** row in [Change This Roll](#change-this-roll). The Primary Die keeps its face and the crit dice are rolled. The crit stays for the card: a later reroll or change alters only the damage dice. A line in the card's history tells who made the crit.

The button does not show on an attack that is already a crit, an attack on 2 or more targets, an area attack, or a roll that cannot crit.

## Attacks from a row on a card

A feature such as Coordinated Strike puts a row on its card, for each ally you target and, when the feature says so, for you too. The attack from a row remembers the item, and a feature can read it. Juggernaut adds damage equal to your armor and +1 to the Primary Die on your attack from a Coordinated Strike row, with a tag. The damage has the type of the attack. With Feature Effects off, this is a row in Change This Roll.

## Damage given back

Some features give damage back to the one who attacked. When the GM applies the damage, the attacker takes the same amount, ignoring armor, and a line on the card tells it. When the feature lets you pay a Wound to double it, the owner of the creature and the GM see a button under the line. With **Feature Effects** off, the line has a **Deal** button.

## Rerolls and changes that cost an action

Some rerolls and changes cost 1 action. The row shows "1 action" as the cost. Only a hero in combat spends the action:

- **On your own turn,** you spend the action at once. With no actions left, the feature does not show.
- **Off your turn,** your next turn starts with 1 fewer action.

This is not a Heroic Reaction, so there is no limit of 1 for each round. Out of combat, nothing is spent. The action follows the **Costs** toggle in the Automation settings, not **Action Spending**: with **Costs** off, nothing is spent or checked. When the reroll or change cannot be made, the cost is given back.

## Spending dice from a card

A feature that adds damage when an attack lands puts an **Add Damage** row on that attack's card rather than asking you to run it separately. Click the row, pick which dice to spend, and confirm: the bonus is added to the attack's own damage total, so the number in the roll box goes up and the GM still clicks **Apply Damage** exactly once.

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

## Changes held for the next attack

A feature can hold a change for a later attack. The creature that holds it shows an icon, and the attack roll window shows a line for each change. A change is spent when you roll, so Cancel costs nothing.

- Assess holds nothing outside combat, and with Feature Effects off its card only has the text.
- **Assess: Create an Opening** needs a target. On a success, the next attack roll on that target, by any attacker, has the change. Two Openings add up. It ends with that roll, or when the round changes.
- **Assess: Anticipate Danger** changes every attack roll on you until the round changes.
- A Primary Die change changes the kept face. So 5+1 on a d6 crits, 1+1 hits, and 2-1 misses.
- An area attack adds nothing and spends nothing.

## Keeping the amount of a hit

In combat, Rampage is a row on the card of a hit. Click it to keep the full damage of that hit. Your next attack window has a tick, ticked at the start, that shows the amount. With the tick, no die is rolled and no modifier is added: the attack is a hit and no crit, with the damage type of the new attack. Armor applies as normal. Untick it to roll as normal and end the kept amount. An area attack is also your next attack: it rolls as normal, does not use the amount, and ends it. A spell with only a save that is not an area is an attack too: it uses the amount, and a save halves it as normal.

## Demand Control

Force of Will, Deny Fate, Supreme Control and Nullify open a window when you use them. Each row is a choice from the feature, and the window tells you what you already used. A save card that this caused has its own row.

I INSIST opens the normal window of the cantrip, so you can set advantage. Disadvantage is ignored, and the cast is free. Close that window and nothing is spent or chosen.

Nullify lasts for your next action this turn: an attack, a cast, Assess or Move. It removes all disadvantage, and a minus on your Primary Die, such as from Anticipate Danger, on the roll that uses it. Other negative effects are for the table. It holds nothing outside combat.

With Supreme Control, the window has a tick to use your Reaction when it is not your turn. It costs 1 action, once each round. It does not use up Defend, Interpose or your other reactions.

## Thrill of the Hunt

The Thrill of the Hunt pool starts at 0 and is lost when combat ends. Charges come when your quarry dies, on a melee hit or a ranged crit on your quarry, and from the features that add to the pool. An attack that spent a charge gains none, also on a kill. A kill counts when the damage is applied from the card: a change of HP by hand gives no charge, so use + on the pool. With Feature Effects off there are no automatic gains: use + and - on the pool.

Each attack ability opens the roll window with a weapon field, the Hunter's Mark choice and a line that tells what it spends. The charge goes on the roll. With no charge, or no weapon of that kind, Roll is off and tells why. These attacks cannot miss. "Half range", "if you have not moved" and "Hampered" are for the table to check.

The sheet and the card show the count of the pool with no maximum, because the book gives no cap.

- **Multishot:** target your quarry first, then the 2nd target. It is one attack on your quarry, and **Apply Damage** gives both the same amount.
- **Sharpshooter:** the roll window has a tick that doubles the damage. It starts off. Tick it if you did not move this turn and your quarry is 4 or more spaces away. The system does not check.
- **Heavy Shot and Snare Trap:** the target has a move on its token: a push of 4, 2 or 1 spaces by size for Heavy Shot, 1 space back for Snare Trap.
- **Addling Arrow:** the next attack of the target shows who it must attack, on its roll window and its card. You choose the creature.
- **Grease Trap:** the target is vulnerable to the first fire damage that it takes, then this ends.

## Final Takedown

Final Takedown opens the same window, with melee weapons. It is a crit that cannot miss. The Hunter's Mark choice starts on the damage, shown doubled. If you pick advantage, nothing doubles. Bloodied is for the table to check.

When the damage is applied and the quarry lives, the GM gets a card with its attacks. The chosen attack is free, targets the Hunter and is a crit. With Feature Effects off, the attack has a Make It a Crit row and the crit back stays as text.
