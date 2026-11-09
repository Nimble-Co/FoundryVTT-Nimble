---
title: "Dice Rolls & Chat Cards"
---

# Dice Rolls & Chat Cards

This page tells how attack dice work, what the roll windows ask, and what you can do on a chat card.

## How Nimble attack dice work

An attack rolls all its damage dice at once, but one die decides the outcome: the **Primary Die**, the first die of the attack's damage. The other dice and the modifiers only add to the total.

- **Crit:** the Primary Die rolls its max. It explodes: roll it again and add it, as long as it rolls its max.
- **Miss:** the Primary Die rolls a 1. Some targets make more faces a miss.
- **Advantage and disadvantage:** each step adds one die, and the lowest die drops (the highest with disadvantage). Advantage and disadvantage cancel one for one. A 1 that drops is not a miss.
- **No crit and no miss:** an area attack, and an attack on 2 or more targets. The card shows a tag, such as "No miss: 2 targets", when the die shows a face that does not count.
- **No crit:** a weapon you are not proficient with, and all minions.

## The roll window

A click on a skill, a save, an ability or Initiative opens a roll window.

![The check roll window with the advantage slider and the formula preview](/images/documentation/roll-dialog-simple-attack.png)

- **The advantage slider** goes from Disadvantage ×6 to Advantage ×6. The formula under it shows what you roll.
- **Situational Modifiers:** a tick for each condition that changes the roll, such as Poisoned. The ticks are on when the window opens, and the slider counts them. See [Conditions that change a roll](conditions.md#conditions-that-change-a-roll).
- **Hide roll** *(GM only)* makes a blind roll. The **Hide Rolls by Default** setting ticks it at the start.

A save can start with advantage or disadvantage from your class or ancestry. To change it, turn on **Edit** and click **Saves** on the Core tab.

### The attack roll window

An item that rolls damage or healing opens the same window. The ticks also list the conditions of the target that change the roll. The window has more fields:

- **Add to Roll:** a number or dice, such as `2` or `1d4`, added to the first damage formula. It does not change the Primary Die.
- **Set Primary Die Result:** the Primary Die shows this number and is not rolled. The max is a crit, 1 is a miss.
- **Add to Primary Die Result:** this number is added to the face of the Primary Die, from 1 up to its max. The new face decides: a d6 at 5 with +1 crits.

In combat, a line tells what the roll spends. Your second attack in a turn starts with the disadvantage of a Rushed Attack. Move the slider when a feature or the GM says otherwise.

Some features add a tick to the window, for example **Max damage** or **Dual wield**. A feature can also hold a change for your next attack, for example Assess. The creature shows an icon, and the window shows a line for each held change.

::: details More about the Primary Die fields
- With advantage, the dice drop first. The set or added number then goes on the die that stays.
- A reroll rolls the Primary Die again and loses **Set Primary Die Result**. It keeps **Add to Primary Die Result**.
- Features that add to the Primary Die (for example +1 on melee attacks) work as **Add to Primary Die Result** and add up with it. The card shows a line for each, such as "Primary Die: 5 + 1 = 6".
- An area attack gets none of these.
:::

## Anatomy of a chat card

![An attack chat card with a damage total, the Apply Damage button, the targets and a save button](/images/documentation/condition-chatcard-with-button.png)

- **Header:** the item, and **Critical Hit** or **Miss** when the Primary Die decided one.
- **Roll boxes:** the total of each damage or healing roll, with its type. Click the arrow, or hover the total, to see the dice.
- **Apply Damage** *(GM only)*: applies the damage to the targets of the card. When a target takes less (armor, resistance, a reduction), the card lists why under **Reduced Damage**.
- **Targets:** the tokens you targeted when you rolled. Buttons add the selected or targeted tokens, or remove one. Hostile targets are marked.
- **Save:** a d20 button. Select the tokens that save and click it. With no token selected, it warns you and rolls nothing.
- **Conditions:** a button for each condition of the item. Click it to apply the condition to the selected tokens. See [Conditions](conditions.md).
- **Change This Roll:** rerolls and changes from features. See below.
- **Reactions:** Defend and Interpose on an attack that hits a hero. See [Defend and Interpose](#defend-and-interpose).

A player sees only the rows of the characters they own. The GM sees all.

**Tags at the roll.** When the die does not explain the result, a tag tells why, for example **Crit: target Stunned** (a melee hit on an Incapacitated creature is a crit) or **Cannot miss**. Dice that a crit adds, such as Sneak Attack, show as their own line. Hover a tag or a line to read it as a sentence. On a touch screen, click it.

## The result of a save or check

With a known DC, the line under the name tells the result: "Failed - DC 14" or "Succeeded - DC 14". On a save or a skill check, a 1 always fails and a 20 always succeeds. With no DC, compare the total at the table. The result applies nothing by itself.

## Change This Roll

Features that change a roll after it is made are rows under one button on the card: **Change This Roll (3)**. The number tells how many rows you see. With no rows, you see no button.

The rows open by themselves on a failed save or check and on a miss. Each row shows the feature, what it does and its cost at the right: uses, Mana, Wounds, an action or a Heroic Reaction. The button alone spends nothing. A click on a row uses the feature. A row goes away when the feature cannot be used.

A feature of an ally shows under the ally's name. Two player characters are always allies. For other tokens, the token disposition decides, and a feature with a range needs the token within that range. When a disposition or a range kept an ally's row off a card, the GM sees a line such as "1 ally reroll left out", with an **Add** button.

### Rerolls

A **Reroll** row rolls again. Some features reroll only one die (you click the die), several dice (cost per die), or with another stat (you click the stat). Some let you keep either result: two **Keep** buttons show, and **Apply Damage** waits until you pick one.

After a reroll, a line shows the old Primary Die, paler, an arrow and the new one. A reroll that happened by itself has an **Automatic** tag. A crit or a miss that comes or goes after a reroll changes the card: the crit dice, **Apply Damage** and the features that need a hit.

Some features add to the reroll of another feature, for example advantage, damage, an action or temp HP. Each shows as a small tag under the reroll line. With **Feature Effects** off, the tags for actions and temp HP are dashed, and a note tells what to give by hand.

### Changing a die

A **Change Die** row gives one die a new value. No die is rolled. The feature tells which die (the Primary Die, or one you click) and how: it sets the die to a value you pick, or it adds a number. The value picker shows the old die, an arrow and the new value, with **-** and **+** buttons. Click **Set to 8**, or press Enter.

The other dice stay as they are, and advantage is not worked out again. The crit, the miss and the total are, so a Primary Die set to its max crits and explodes. A later reroll of that die discards the change.

### Changing a result

These rows change the result, not the dice:

- **Succeed Instead:** the save or check succeeds. The total stays.
- **Change to 10:** the total becomes that number. On Initiative, it also changes your actions in the combat tracker.
- **Add +3:** the number goes on the total. You can click it again while you can pay.

A box above the history shows how the total came from the roll, such as **7 + 3 + 3 = 13**. A 1 on a save or a skill check still fails after an add, so the add row stays but you cannot click it. Some changes happen by themselves, for example a total of 1 or less that counts as a 20.

Each change has a **Remove** button that takes it off and gives the cost back. An action or a Heroic Reaction comes back only in the same turn. A reroll replaces the total, so the changes come off, and their costs stay spent.

### Making an attack a crit

A **Make It a Crit** row makes a hit a crit after the roll. The Primary Die keeps its face, and the crit dice are rolled. A later reroll changes only the damage dice. The row does not show on a crit, an area attack or an attack on 2 or more targets.

### Other rows

- **Add Damage:** a feature that spends dice to add damage. The dice go on the total of the attack, so armor counts one time. Spend before the GM clicks **Apply Damage**.
- **No Damage:** the target of a hit takes no damage from this attack. The other targets do.
- **Cost of 1 action:** on your turn, the action is spent at once. Off your turn, your next turn starts with 1 fewer action. Out of combat, nothing is spent.

## Defend and Interpose

In a combat that started, an attack card that hits a hero has a **Reactions** section. It has a button for each hero the attack hits, and for each ally who can Interpose for them (only on an attack with one target). A player sees only their own heroes.

The button opens the Defend window. Its heading tells the attack, the hero and the damage, for example "Fire Breath hits Pip for 14". Each row shows its cost and the damage you take:

- **Defend:** your Armor comes off the damage. It costs 1 more action in armor or a shield you are not proficient with.
- **Interpose:** an ally within 2 spaces (or the range of an Interpose feature) becomes the target and takes the full damage. Move the tokens yourself.
- **Interpose and Defend:** you become the target, and your Armor comes off.

Pick a row and click the button. When the reaction is spent, you have no actions or it is your turn, a window asks first. Features that do something when you Defend show as ticks or rows in the same window, with their cost. A move or an attack back is a line on the card for the table to do.

After a Defend, the target row shows a green shield and the damage after Armor. Until the damage is applied, the GM can click the shield when the damage cannot be avoided (no Armor comes off), or click **Undo** to give back the reaction and its actions.

The **Defend** and **Interpose** rows on the Actions tab of the sheet, and the hotbar buttons, open the same window on the newest attack that the hero can still react to.

## The Initiative card

The line under the name tells how many actions a hero starts combat with: 1, 2 with a total of 10 or more, 3 with 20 or more or a natural 20. A monster's card has no line. A change from **Change This Roll**, such as **Change to 10**, also goes to the combat tracker: the Initiative, the starting actions, and your current actions if you did not spend them yet. **Remove** does the reverse.

## Targeting and roll visibility

Target tokens (key T) before you roll, and they show on the card. **Apply Damage** uses the targets of the card, not the selected tokens. The save button rolls for the selected tokens.

Two settings for each player change what you see: **Auto-Expand Rolls** always shows the dice under each total, and **Hide Rolls by Default** makes your rolls blind rolls. A GM can untick **Hide roll** in the window. A player has no **Hide roll** tick, so a player who turns this on makes only blind rolls. See the [Settings Reference](../reference/settings.md).

## Related pages

- [The Character Sheet](../characters/character-sheet.md)
- [Conditions](conditions.md)
- [Combat](../gm/combat.md)
- [Settings Reference](../reference/settings.md)
