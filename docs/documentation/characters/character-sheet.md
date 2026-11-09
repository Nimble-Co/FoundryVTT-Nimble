---
title: "The Character Sheet"
---

# The Character Sheet

The character sheet puts everything you touch during play (HP, Hit Dice, mana, rolls, items, spells) one click away. The rail on the left shows your hero at all times. The tabs on the right hold the rest. This page tours the sheet from left to right.

![The character sheet with the rail on the left and the Core tab open](/images/documentation/full-character-sheet.png)

## The rail

The rail is always visible, whatever tab is open:

- **Portrait, name and summary line.** Your ancestry, size, class, subclass, and level.
- **Inspiration seal.** The star seal in the top-right corner of the portrait. A crimson seal means that you have Inspiration, and a ghost ring means that you do not. Click the seal to grant Inspiration or to end it. Inspiration is an optional rule: the GM grants it, and you can spend it to reroll any single die. It ends after a Safe Rest.
- **Hit Points.** Your current, temporary, and maximum HP. Type in the HP number to set your HP. The plate shows when you are Bloodied (half HP or less) or Dying (0 HP).
- **Wounds.** One mark per wound that your character can take. Click a mark to add or remove a wound.
- **Armor and speed.** Your armor value and your walking speed.
- **Roll Initiative.** Rolls initiative. If a combat is running, this also handles joining it. The roll posts an [Initiative card](../playing/dice-and-chat.md#the-initiative-card) that tells how many actions you start with.
- **Field Rest** and **Safe Rest.** Only out of combat. See [Rest & Recovery](../playing/rest-and-recovery.md).
- **Actions.** During combat, a box shows if it is your turn and your actions left. See [The action tracker](#the-action-tracker).
- **Meters.** Hit Dice, mana (only if your class uses mana), dice pools, and the resource pools of your features. See [Dice pools and charges](#dice-pools-and-charges).
- **Level Up** and **Edit.** At the bottom of the rail. See [Leveling Up](advancement.md) and [Edit mode](#edit-mode).

If the system finds a level choice that you did not make, a warning button shows above **Level Up**. Click it to correct the level.

### Edit mode

The sheet opens out of edit mode, so you cannot change your hero by accident. Click **Edit** at the bottom of the rail to turn on edit mode. The parts that you can configure get an outline: click an outline to open its window (Hit Points, Hit Dice, mana, size, ability scores, saves, skills, movement, damage defenses, and proficiencies). In edit mode you can also change the portrait and the name, revert your last level up, create features and spells, delete items, and type the uses of an item. Click **Edit** again to stop.

### The action tracker

When you are in a combat, the **Actions** box in the rail shows your actions as pips. Click a pip to spend or recover an action. When it is not your turn, a reaction spends 1 action, and you start your next turn with the actions that are left. If you end your turn with actions left, the box asks first.

### The narrow form

Make the window narrower than 560 px, and the rail becomes a header at the top with a strip of tabs under it. Each tab keeps a short label under its icon. Drag the edge of the window to make it wide again.

## Tabs

A click on a row uses the thing: it attacks with a weapon, casts a spell, or posts a feature to chat. The arrow at the start of a row shows its full text. The pen at the end of a row opens its window. The line under the name shows the facts first (the damage, reach and properties of a weapon, the range of a spell), then the first sentence of the text. Point to the uses, the mana cost, or the green action bars of a row to see what they mean.

### Core

Your numbers, and the place you roll from:

- **Abilities and saves**: click an ability score to roll an ability check, and click a save to roll it. Saves can carry a default advantage or disadvantage (from your class or ancestry). In edit mode, the outline on the saves opens a window where you can adjust each save's default roll mode and bonus, or reset them to what your class and items say they should be.
- **Skills**: click a skill to roll a skill check.
- **Speed**: each movement type that you have, for example Fly and Climb, and the bonus that changes it.
- **Proficiencies and defenses**: languages, armor, weapons, and your damage defenses.

All of these open a roll window first. See [Dice Rolls & Chat Cards](../playing/dice-and-chat.md) for what its options mean.

### Actions

Everything you can do on your turn, in groups: your equipped weapons, the features and spells that you use, the heroic actions (for example Move, Assess and Unarmed Strike), and your reactions (Defend, Interpose, Help and Opportunity Attack). The arrow text of each heroic action holds its rules text.

Some rows ask you to choose first. Then a choice step opens under the row: Assess shows its three options and then a skill list, and Opportunity Attack lists your equipped melee weapons and Unarmed Strike. The reactions show the name of your current target. This only tells you the target. It never stops you.

You can drag an action from here to the macro hotbar for one-click access; see [Macros & the Hotbar](../gm/macros.md).

### Inventory

Your equipment and loot. Click a row to use the item (attack with a weapon, drink a potion); this posts a chat card. Weapons, armor and shields have an **EQUIP** tag: click it to equip or unequip the item. You can create new items here with **Create Object**, or drag them in from the compendiums. The coins and, if your table tracks them, your inventory slots are at the top of the tab. When you are over your slot limit, the slots show a warning.

Items set up as containers, such as a chest, a backpack, a pouch or a quiver, show their contents indented under them. The row of a container shows how much of its capacity is in use, or **Empty**.

- **To put something in**, drag it onto the container's row.
- **To take something out**, drag it onto the list.
- **In edit mode**, each row has a **Store in** select: pick a container, or **Loose** to take the item out.

A container keeps its own slot cost; what its contents cost you depends on how the container is set up, and the slot total reflects that. If a container has a capacity, a drop that would not fit is refused, and so is raising a stored stack past the limit.

You cannot equip something that is packed away, so stored items have no **EQUIP** tag. Storing an item you have equipped asks you to confirm before unequipping it.

Some items cost more packed away than they do in use. Armor is the one the rulebook names: worn it takes 1 slot, and stowed it takes 2. Unequipping a suit of armor, or putting it in a container, raises the slot total to match.

To delete an item, turn on edit mode and click the trash button of its row. The sheet asks first. Deleting a container leaves its contents in the inventory at their own slot cost.

### Features

Your class features, subclass features, ancestry, background, and boons, grouped by category. Click a feature to use it, or to post its details to chat.

Everything a class gives you sits under that class. The features it hands you automatically come first, then your subclass and the features it brings, then each named set of choices the class offers under a heading of its own, taken from the name of the set. A Shadowmancer sees **Lesser Invocations** and **Greater Invocations** as separate headings under their class rather than one long list, and a class offering no such choices shows no extra headings at all. Ancestry and background keep their own sections below. In each group, the features are in the order of the level at which you got them.

### Spells

Your known spells. **Group the spells** sorts them **By tier** or **By school**. Click a spell to cast it. Spells that can be upcast open a window asking how much mana to spend, with a preview of what the extra mana buys.

Dropping a spell from a compendium onto the sheet asks whether to add it to your spell list or to add it as a single-use spell scroll. If the spell's tier is above your highest unlocked spell tier, the spell list option shows a warning: the spell would be added to your list, but you would not be able to cast it.

Each spell row shows what casting it costs. For most classes that is the spell's tier in mana. Some classes pay from a pool of uses instead, and their rows show that pool by name.

![The Spells tab with the spells grouped by tier](/images/documentation/character-sheet-spells-tab.png)

#### Casting without enough left to pay

A class that pays from a pool may also declare what happens when you cast anyway with the pool empty. The Shadowmancer is the example that ships with the system: Pilfered Power is a pool of uses equal to your Dexterity, spells always cast at your highest unlocked tier for one use, and casting on an empty pool asks you to confirm and then costs you half your maximum hit points.

::: warning Greedy Pact is not automated
From Shadowmancer level 12 Greedy Pact replaces that fixed penalty with a saving throw that has three different outcomes, one of which changes the tier the spell is cast at. The system cannot express that yet, so from Shadowmancer level 12 it stops applying the penalty instead of applying the wrong one. Levels in other classes do not count toward this. The confirmation still offers the overdraw and says the cost is settled at the table. Roll Greedy Pact by hand and apply the result yourself.
:::

::: warning Hollow One and free casts are not automated
The system does not know when a use of Pilfered Power should not be spent. The Reaver subclass's Hollow One cuts you off from your patron, so you can no longer cast tiered spells using Pilfered Power; the sheet still shows the pool and still lets you cast. Three features grant a cast without Pilfering Power: We'll ALL Burn! (Pact of the Red Dragon) for Pyroclasm when you include yourself in the damage, Shadowfrost (Pact of the Abyssal Depths) for Cryosleep or Rimeblades when you expend 10 temp HP, and the Hungering Shadows invocation for the next tiered spell after one of your shadows would crit. The sheet spends a use for those casts anyway. Handle both at the table: a Reaver does not cast tiered spells from the pool, and after a free cast add the use back by hand.
:::

### Effects

The conditions and effects on you. The tab count shows how many there are.

- **Conditions on you**: each condition that is on you now. The system sets Bloodied, Dying, Dead, Wounded, Last Stand and Concentration itself, so they show here while they are on.
- **The condition grid**: the conditions that you set by hand. A condition that is on is crimson, with a check. Click a condition to turn it on or off. Charged, Distracted, Marked and Smoldering are small buttons under **Other conditions**.
- **Active effects** and **passive effects**: the other effects on your character. While you have Inspiration, it is in **Active effects** too: click its row to end it when you spend it. An effect that an item gives shows the name of the item: change it through the item. To remove an effect of your own, click **Remove**, and the sheet asks first.

A group with nothing in it does not show. See [Conditions](../playing/conditions.md).

### Bio

Your character details: age, height, weight, gender, and notes. They read as text. Turn on edit mode to type them and to write the notes.

### Settings

Per-character sheet options: portrait positioning and scale, whether item macros run when you use an item, inventory slot tracking, your initiative bonus, and passive skill scores. The settings work at all times; you do not need edit mode. Each setting has one line that tells what it does. The buttons at the bottom export your character to PDF or to JSON (see [Importing & Exporting](../gm/import-export.md)).

This tab also shows your **Highest Unlocked Spell Tier**. The sheet works this out from the spell grants on your class, subclass, and features, so it normally needs no attention. If your table plays it differently, type the tier by hand. A tier you set stays until you click **Reset spell tier**, which hands the value back to the sheet.

## Dice pools and charges

Some features give you a resource that lives on the sheet rather than on a chat card.

**Charges** are a simple count, like 1 use per turn or 3 per safe rest. The row of the feature shows what you have left, and the count refills on whatever the feature says. Using a feature that costs a charge spends it for you, and if you have none left the use is blocked with a message explaining why. To correct the count by hand, turn on edit mode and type the uses on the row.

Some features spend an amount you choose instead of a fixed cost. An Oathsworn's Lay on Hands is the clearest example: the pool holds 5 x LVL points of healing power and refills on a safe rest, and using the feature asks how much of it to spend before healing your target for exactly that much. The roll window cannot be skipped for these, because the amount is yours to name. The chat card reports what you spent and what the pool is down to.

**Dice pools** hold rolled dice, and each die remembers the number it came up with. A Berserker's Fury Dice are the clearest example: you Rage, dice go into the pool, and they add to your attacks until the Rage ends. Each dice pool is a meter in the rail:

- **Roll** rolls a die into the pool.
- **Click a die** to open its menu: **Set value** or **Discard**, when something at the table needs to be corrected by hand.
- **Discard all** empties the pool. The sheet asks first.

A feature that draws on a pool opens a choice step under its row: pick the dice you want, then click **Spend**. What that does depends on the feature: most **spend** the dice you picked and post the result (damage reduced, spaces you may move), while a few **change** a die instead, raising it to its highest value and leaving it in the pool. For those, dice already at their maximum are off, and you only get as many picks as the feature allows, so choosing another die swaps your selection. When the pool is empty, the step says so.

The choice step opens when you use the feature, and also when the system asks you to spend dice: the sheet opens on the tab of the feature, with the step open. If your sheet is closed, it opens for you.

Some features raise Judgment Dice by themselves, after the dice roll. Maximum Judgment raises the lowest die on each attack against you. Avenger raises one die per Wound on you or on an ally within your aura (Improved Aura makes it larger), then lets you move half your speed for free, also with no dice held. A hero or ally with no token on the scene has no effect. With Feature Effects off, you can use each of these items from the sheet and pick the die.

## Drag to the hotbar

Drag any row (weapon, spell, feature) or any heroic action onto Foundry's macro hotbar to create a macro that uses it directly. See [Macros & the Hotbar](../gm/macros.md).

## The old character sheet

The old character sheet is still in the system as a backup. To use it for one character:

1. Open the sheet of the character.
2. In the window, open the menu and click **Configure Sheet**.
3. In **This Sheet**, select **Character sheet (old)**, then click **Save**.

To go back, do the same steps and select **Character sheet**. A GM can change the sheet for all characters in **Default Sheet** in the same window. If your world saved the old sheet as its default before this update, characters keep opening in the old sheet until a GM selects **Character sheet** there.

## Related pages

- [Creating a Character](creation.md)
- [Leveling Up](advancement.md)
- [Dice Rolls & Chat Cards](../playing/dice-and-chat.md)
- [Rest & Recovery](../playing/rest-and-recovery.md)
