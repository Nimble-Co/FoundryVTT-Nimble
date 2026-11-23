---
title: "Dice Rolls & Chat Cards"
---

# Dice Rolls & Chat Cards

## How Nimble attack dice work

An attack rolls all its damage dice at once. The first die, the **Primary Die**, decides the outcome. The rest only add to the total.

- **Crit:** the Primary Die rolls its max. It explodes: roll and add it again while it rolls its max.
- **Miss:** the Primary Die rolls a 1. Some targets make more faces a miss.
- **Advantage and disadvantage:** each step adds one die, and the lowest die drops (the highest with disadvantage). They cancel one for one. A 1 that drops is not a miss.
- **No crit and no miss:** an area attack, and an attack on 2 or more targets, with a tag such as "No miss: 2 targets". A feature such as Whirlwind hits, misses or crits each target against its own armor.
- **No crit:** a weapon you are not proficient with, and all minions.

## The roll window

A click on a skill, a save, an ability or Initiative opens a roll window.

![The check roll window](/images/documentation/roll-dialog-simple-attack.png)

- **The advantage slider** goes from Disadvantage ×6 to Advantage ×6. The formula under it shows what you roll.
- **Situational Modifiers:** a tick, on by default, for each condition that changes the roll, such as Poisoned. The slider counts them. See [Conditions that change a roll](conditions.md#conditions-that-change-a-roll).
- **Hide roll** *(GM only)* makes a blind roll.

A save can start with advantage or disadvantage from your class or ancestry. To change it, turn on **Edit** and click **Saves** on the Core tab.

### The attack roll window

An item that rolls damage or healing opens the same window, with ticks for the target's conditions too, and more fields:

- **Add to Roll:** a number or dice, such as `1d4`, added to the damage, not to the Primary Die.
- **Set Primary Die Result:** the Primary Die shows this number and is not rolled.
- **Add to Primary Die Result:** this number goes on the Primary Die, up to its max, so a d6 at 5 with +1 crits.

A line tells what the roll spends: "When you roll, it spends 1 action and 1 from Combat Dice (2 left after)." A use that goes beyond what you have asks you to confirm (**Costs** setting). A second attack in a turn starts with Rushed Attack disadvantage.

::: details More about the Primary Die fields
- With advantage, the dice drop first. The set or added number goes on the die that stays.
- A reroll loses **Set Primary Die Result** and keeps **Add to Primary Die Result**. Features that add to the Primary Die add up with it. An area attack gets none of these.
:::

### Ticks and held changes

Some features add a tick, such as **Max damage** or **Dual wield**. A tick that spends a charge adds it to the spend line. A tick with a limit, such as **(1/round)**, hides until the use comes back. One attack spends from a charge pool one time only: when a tick, the use or an **Add Damage** button spent a Combat Die, nothing else spends one.

Some features put a tick in the roll window that rolls different damage dice with one weapon, such as Versatile Bowmaster with a longbow. The tick starts off. Other weapons do not show the tick, and an attack that skips the roll window rolls the weapon's usual damage.

A feature such as Assess can hold a change for your next attack. The creature shows an icon, and the next attack window shows a line for it and ends it. With **Feature Effects** off, the line is a tick box that starts unticked. See [Hold a change for the next attack](../homebrew/held-changes.md#hold-a-change-for-the-next-attack).

::: details More about ticks and spell options
- **Dual wield** shows with 2 equipped weapons, or 1 with a quantity of 2 or more.
- A spell's cast window shows a dropdown for each option a feature gives, such as **Spellshaper (1/turn)**. When an option can replace the spell's cost, **Spend** buttons show. On a melee attack, an option with picks shows a counter for each pick.
:::

### Attacks with a weapon or divided dice

A feature that attacks with a weapon, such as Vital Shot, shows a **Weapon** dropdown of the right weapons you carry, equipped or not. A melee feature also lists Unarmed Strike. The attack does not equip the weapon. With no right weapon, a message tells why.

The attack uses the weapon's reach or range, rules and hit, miss and crit text, plus the feature's rules, so a feature that cannot miss still cannot. Half range shows as "Range 8 (half range)". Nothing checks the distance.

A feature that divides the dice, such as Grim Harrow, shows a row for each target with **−** and **+**. Give out every die, then roll once for the hit, miss or crit of all. Each target takes its dice through its own armor, and the first also takes the flat damage. The card groups the boxes by target: "Slashing to G1", "Necrotic to G1", then G2.

## Anatomy of a chat card

![An attack chat card](/images/documentation/apply-effect-chat-card.png)

- **Header:** the item and the result. The result names the weapon a feature attacked with, "Hit with Longsword", or the feature you attacked through, "Hit (Coordinated Strike!)". An opportunity attack says so: "Hit (opportunity attack)". A free cast with no roll says "Free (Coordinated Strike!)".
- **Cost:** what the use spent or sacrificed, such as **Cost: 2 mana (Stretch Time)**. A spent charge is one line at the bottom: "Combat Dice: spent 1, 2 of 3 left".
- **Roll boxes:** the total of each roll. Click the arrow, or hover the total, to see the dice.
- **Apply Damage** *(GM only)*: applies the damage to the card's targets. When the card stored none, it uses the tokens you have targeted now and lists them under **Targets**. **Reduced Damage** tells why a target took less.
- **Targets:** the tokens you targeted when you rolled. You can add or remove tokens. **Apply Healing** *(GM or the one who rolled)* heals these targets, and with none stored it uses the tokens targeted now.
- **Save:** rolls for the selected tokens.
- **Effects:** **Apply to Targets** puts an effect on the targets. An effect for the user goes on by itself (**Apply to You** with Feature Effects off). See [Conditions](conditions.md#three-ways-to-apply-and-remove-them).

A player sees only the rows of the characters they own. Names on the card and in **Events** are underlined when you may see that document. Click one to open its sheet.

**Tags at the roll** tell why when the die does not, such as **Crit: target Stunned** or **Cannot miss**. Hover or tap a tag to read it as a sentence. Dice that a crit adds, such as Sneak Attack, show as their own line.

### Where the damage comes from

Small lines under a damage box tell where it came from:

- One Primary Die line: "Primary Die: 4 + 1 (Juggernaut) = 5", or "Primary Die: set to 4".
- A line for each feature that added damage: "Juggernaut: +14".
- "From Withering Strike" on a box that a feature made.

A feature that spends dice or a charge to add damage after a hit or a crit is a button over **Apply Damage**, such as **Add Damage with Heavy Strike**. Click it before the damage is applied. Its damage becomes a line in the box, "Heavy Strike: +5", and anything else, such as a push, goes in **Events**.

After a hit, a weapon that can ricochet gets a line under **Apply Damage**. The card cannot tell a throw from a stab, so it says "if you threw the Dagger". Target another creature for a button such as **Apply 3 Damage to G2**: half the damage, rounded down, through its armor. Then the line says "G2 took 3 damage."

When an attack with **Half Damage on a Kill** drops a creature to 0 HP, **Apply Damage** asks whoever is applying it to pick another creature within reach of the attacker, or to decline. That creature takes half the damage that was rolled, rounded down. Armor does not reduce it. Declining, or a creature who survives, deals nothing further. Large - Go for the Throat! does this at Reach 4.

### Attacks from a feature

A feature such as Coordinated Strike! can give creatures an attack. The card gets a section headed by what it spends: **Free Attack**, **Attack (1 action)**, **Opportunity Attack (reaction)** or **Opportunity Attack (free)**. Each creature has its name, a weapon dropdown (with Cantrips when allowed) and an **Attack** button, which only the owner and the GM see. Hover the name to see the feature, a condition the table checks, and how many targets share one attack.

**Attack** opens the usual attack window, as an attack made through the feature. A free attack says "A free attack (Coordinated Strike!): it spends no action." It still counts toward Rushed Attacks unless the feature ignores them, and then the window says so. After, the line says "Cora attacked with Longsword."

A line that follows a move, such as Roll & Strike, shows when the move ends. A section shows one warning at most, and you can still attack: more creatures targeted than the feature reaches (it names them), or a failed check after the move ("Wren is not next to their quarry.").

::: details Lines from reactions and monsters
- **Interpose and Defend.** A feature that lets you attack when you Interpose, or an opportunity attack when your Defend blocks all the damage, goes on the attack card. When you cannot see that card, or you used the sheet, it goes on your Interpose or Defend card.
- **Opportunity attacks** roll at disadvantage and spend your reaction, unless the feature says otherwise. A ranged one reads **Ranged Opportunity Attack (reaction)**.
- **Monsters.** A monster's attack, such as the Control of the Ul'vek, Psionic Despot, can give a hero an attack that spends one of the hero's actions.
:::

## The result of a save or check

With a known DC, the line under the name reads "Failed - DC 14" or "Succeeded - DC 14". On a save or a skill check, a 1 always fails and a 20 always succeeds. The result applies nothing by itself.

## Change This Roll

Features that change a roll after it is made are rows under **Change This Roll (3)**, with what each does and costs. The rows open by themselves on a failure or a miss.

An ally's feature shows under the ally's name. Player characters are always allies; other tokens go by disposition, and a range needs the token within it. When an ally's row was left off, the GM sees "1 ally reroll left out", with **Add**.

### Rerolls

A **Reroll** row rolls again: one die (you click it), several dice, or with another stat (you click the stat). When you can keep either result, **Apply Damage** waits until you click **Keep**. A line shows the old and new Primary Die. A crit or a miss that comes or goes updates the whole card.

Features that add to a reroll, such as advantage, damage, an action or temp HP, are tags under the reroll line. With **Feature Effects** off, action and temp HP tags are dashed: give them by hand.

### Changing a die

A **Change Die** row sets one die to a value, or adds a number, with no roll. Pick it with **-** and **+**, then click **Set to 8** or press Enter. A Primary Die set to its max crits and explodes. A later reroll of that die discards the change.

### Changing a result

- **Succeed Instead:** the save or check succeeds.
- **Change to 10:** the total becomes that number. On Initiative, your actions in the combat tracker change too.
- **Add +3:** the number goes on the total, shown as **7 + 3 + 3 = 13**. A 1 on a save or a skill check still fails.

**Remove** takes a change off and gives the cost back (an action or a Heroic Reaction only in the same turn). A reroll removes the changes, and their costs stay spent.

### Other rows

- **Make It a Crit:** a hit becomes a crit, and the crit dice roll. Not on an area attack or an attack on 2 or more targets.
- **No Damage:** the target of a hit takes no damage from this attack.
- **Cost of 1 action:** on your turn, the action is spent at once. Off your turn, your next turn starts with 1 fewer action.

## Defend and Interpose

In combat, an attack card that hits a hero has a **Reactions** section: a button for each hero hit, and for each ally who can Interpose (one target only). It opens the Defend window. Each row shows its cost and the damage you take:

- **Defend:** your Armor comes off the damage. It costs 1 more action in armor or a shield you are not proficient with.
- **Interpose:** an ally within 2 spaces (or the range of an Interpose feature) becomes the target and takes the full damage. Move the tokens yourself.
- **Interpose and Defend:** you become the target, and your Armor comes off.

A window asks first when your reaction is spent, when you have no actions, or on your turn. Features that act when you Defend show there too. An attack back asks before the Defend is written. Choosing to attack rolls the damage on a card that targets the attacker. The GM applies it from that card, and the attacker's armor applies. Skipping the attack still lets the Defend happen. A move the feature still leaves to the table stays a line on the card.

After a Defend, the target row shows a green shield. Before the damage is applied, the GM can click it when the damage cannot be avoided, or **Undo** to give back the reaction and actions. An effect a feature put on the attacker stays.

The **Defend** and **Interpose** rows on the sheet's Actions tab and the hotbar buttons open this window on the newest attack the hero can react to.

::: details More about Defend features
- A Defend that covers every attack this round is an effect on the hero until the start of their next turn.
- A free Defend that is a spell, such as Flame Barrier, has its own row. Cast from that row, its effect that hurts attackers also counts the attack you answer.
- Medium Protect Me! asks whether the companion attacks the attacker for 1d4 plus your level. The attacker's armor applies.
:::

## The Initiative card

The line under the name tells the actions a hero starts combat with: 1, 2 at 10 or more, 3 at 20 or more or a natural 20. **Change to 10** and **Remove** also change the actions in the combat tracker.

## Events on a card

What a roll or a use causes shows as a line in the **Events** strip at the bottom of its card: an effect ends, a free use, a pool gains dice, a push or a free move. With no card to cause it, such as at the start of a turn, the chat gets one message for that moment.

![Events on a crit: Grug uses Rage for free](/images/documentation/events-free-use.png)

**Undo** on an ended effect puts it back. See [How an effect works](../homebrew/effects.md#how-an-effect-works). Some lines ask a creature's owner to choose or roll, with buttons only the owner and the GM see.

- **A save.** "Tessa saves to keep Concentration", with **Roll**. Rerolls work on its save card. A failure ends the effect, and a reroll to a success puts it back.
- **Temp HP.** Temp HP do not add up. When a creature would gain no more than it has, the line asks, such as **Keep 5** or **Take 3**.

::: details Where a line goes
A GM-only line goes on a card only the GM sees. A line that asks a player to act goes on a card that player sees, or on its own message for that player and the GMs. Lines of one moment share one message among the last 20.
:::

## Targeting and roll visibility

Target tokens (key T) before you roll. **Apply Damage** and **Apply Healing** use the targets stored on the card, not the tokens you have selected. When the card stored none, they take the tokens you have targeted now, show them in **Targets**, and then apply. A card that already lists targets keeps those. The crosshairs button still adds the tokens you have targeted.

**Auto-Expand Rolls** shows the dice under each total. **Hide Rolls by Default** makes your rolls blind, and only a GM can untick **Hide roll**. See the [Settings Reference](../reference/settings.md).

## Related pages

- [The Character Sheet](../characters/character-sheet.md)
- [Conditions](conditions.md)
- [Combat](../gm/combat.md)
