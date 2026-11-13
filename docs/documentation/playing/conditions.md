---
title: "Conditions"
---

# Conditions

Conditions are status markers (Prone, Frightened, Grappled, and friends) that sit on a character or monster and show as icons on its token. The system ships with the full set of Nimble conditions; for what each one does, see the [Conditions Reference](../reference/conditions.md) (and the Nimble rulebook for the underlying rules). GMs can also [add conditions of their own](#custom-conditions). For how long a condition stays on, see [How Long Effects Last](how-long-effects-last.md). For the Concentration condition, see [Concentration](concentration.md).

## Three ways to apply and remove them

1. **The token.** Select a token and open its overhead controls (right-click the token). The status panel lists every condition by name. Click one to toggle it on or off, and use the clear-all button to wipe them.
2. **The sheet's Effects tab.** Both the character sheet and the NPC sheet have an Effects tab. Under **All conditions**, a grid shows each condition that you set by hand. Click a condition to apply or remove it. A condition that is on is crimson, with a check. Charged, Distracted, Marked and Smoldering are small buttons under **Other conditions**. The system sets Bloodied, Dying, Dead, Wounded, Last Stand and Concentration itself, so they are not in the grid. Each condition that is on, also these six, shows in the list above the grid. Click its row to remove it: the sheet asks first. The active and passive effects on the actor are listed on the same tab.
3. **The Effects part of a chat card.** A card that gives an effect has a row for it under **Effects**, with its Lasts Until. **Apply to Targets** puts it on the card's targets. An effect for the user goes on by itself when the item is used. With the Feature Effects automation setting off, the row has an **Apply to You** button. The user who rolled the card and the GM can click. Then the row tells who has it: "✓ On Goblin". For a creature you do not own, a GM must be connected.

![A chat card for Ice Lance: the cold damage, and an Effects part with Slowed and Apply to Targets](/images/documentation/apply-effect-chat-card.png)

## Blinded

Blinded uses Foundry's blindness. The vision of a Blinded token reaches only its own space, so through that token you see no other token. A detection mode that is not sight, which the GM adds to the token, still works. Nimble does not give Blindsight a detection mode. Fighting in the dark imposes Blinded, unless a light or Darkvision lets the creature see. The GM applies it.

## Conditions that change a roll

Some conditions give advantage or disadvantage. The roll window lists each one under **Situational Modifiers** as a tick with its name and the creature, for example "Blinded (Goblin)". The tick is on when the window opens, and the slider already counts it. Take the tick off when the condition does not apply. A roll with no window (an item set to skip it, Alt, a macro, a minion group attack, initiative from the combat tracker) uses every tick that would start on.

Each condition is one step, and the steps stack and cancel as other advantage and disadvantage do.

**The target of an attack.** These count only when the attack has one target. A Multi-target or area attack ignores them (Core Rules).

- Blinded, Grappled or Restrained, Incapacitated (also Paralyzed, Stunned, Unconscious, Petrified): advantage. Grappled and Restrained together are one step.
- Prone: advantage on a melee attack, disadvantage on a ranged attack. A Reach attack is melee. A spell with no attack type is ranged with Range and melee with Reach. A weapon ability attacks as the weapon you pick. A monster attack with no attack type is melee, unless it is an area attack. When the attack is neither, the window shows both lines with their ticks off, and you pick one.
- Invisible: disadvantage.

**The one who attacks.** These count also on Multi-target and area attacks.

- Blinded, Prone, Taunted, Despair: disadvantage.
- Invisible: advantage.
- Taunted gives no disadvantage when the only target is the most recent taunter. The system knows the taunter when a feature applied Taunted. When you applied it by hand, the tick is on and you take it off for an attack on the taunter.
- Despair lasts until your next attack or until combat ends. Your next attack ends it, also when you take its tick off. Despair applied by hand ends the same way.

**Every roll.** Poisoned and Frightened give disadvantage on attacks, saves, checks and initiative. Only a character rolls for initiative, so a monster's initiative has no condition lines. The Frightened line says "source of fear nearby": take it off when the source is not near.

The card names each condition that changed the roll as a tag, for example **Advantage: Blinded (Goblin)**. Hover or click the tag to read the rule. When a feature takes away all disadvantage, the card shows no disadvantage tag. A minion group attack shows the lines under each minion.

## Latched and Swallowed

These two conditions come from monsters. The GM removes them by hand.

- **Latched** goes on the creature that hit with Latch On, and the creature stores who it hit. Its attacks cannot miss. When an attack on it misses, the card has one button for the whole attack, **Apply N Damage to** that creature. N is the amount after the creature's armor, immunity, resistance and damage reduction. With no click, nothing happens. Moving with the target stays with the table.
- **Swallowed** goes on the target of a crit from Bite/Swallow. The creature takes 20 damage at the start of its turn. The line on the turn start card has **Undo**. Its attacks cannot miss and ignore armor.

With Feature Effects off, the GM applies them by hand. At the start of a Swallowed creature's turn, the line has a **Take Damage** button and no damage is dealt until someone clicks it. The attack effects and the Latched button stay.

## Linked conditions

Some conditions come bundled together, and the system tracks the relationships for you:

- **Counts as.** Some conditions imply others, as the book says: Paralyzed, Stunned and Unconscious each count as Incapacitated, and Grappled and Restrained count as each other. It works one way: Incapacitated alone does not count as Stunned, Paralyzed or Unconscious, and Stunned counts only as Incapacitated. You'll only see the icon you applied, but rules that look for the implied condition will find it.
- **Applied together.** Petrified automatically carries Incapacitated with it.
- **Automatic Hampered.** Applying Dazed, Grappled, Prone, Slowed, or Restrained automatically applies Hampered as well. When the last of those trigger conditions is removed, Hampered goes away on its own.
- **Wounded stacks.** Unlike other conditions, Wounded can be applied multiple times, one stack per wound.

## Negative conditions

A negative condition harms its holder. An End Conditions step (a reaction that "ends all negative conditions", for example) ends each effect that gives one. All conditions are negative except the states the system sets (Bloodied, Dying, Dead, Wounded, Last Stand, Concentrating) and the ones that help or do nothing on their own (Invisible, Riding, Latched). Grappled and Swallowed are negative. With **Linked Conditions** on, a Hampered beside Dazed, Grappled, Prone, Slowed or Restrained goes when that condition goes. With it off, the step ends that Hampered too. A custom condition is negative unless its **Negative** box is off. The [Conditions Reference](../reference/conditions.md) marks each negative condition.
## Custom conditions

A GM can add conditions of their own from **Game Settings → Configure Settings → Nimble → Manage Conditions**. This is handy for statuses from content the system doesn't ship with. Each one takes a name, an id, a plain-text description, an icon, a **Minor Status** box (a Minor Status ends when combat ends) and a **Negative** box (an End Conditions step ends a [negative condition](#negative-conditions); it starts on), and from then on it behaves like any other condition in the token panel, the Effects tab, and the Rules Builder's condition lists.

Custom conditions are markers only: none of the linked-condition behavior above applies to them, they never stack, and they aren't listed in the generated [Conditions Reference](../reference/conditions.md), which is built from the conditions that ship with the system.

Removing a custom condition that something still uses opens a confirmation listing what would be left behind: the creatures currently carrying it, and the items whose rules or activation effects name it. From there you can **Remove Everywhere**, which deletes those effects and strips the condition out of those items, or **Remove Only**, which drops the definition and leaves the references in place. Either way nothing changes until you save the conditions list, so closing the editor cancels it.

**Remove Only** leaves markers and rules pointing at an id nothing resolves. Rules in that state stop running and say why on their card in the Rules Builder; leftover markers drop out of the condition grid on the Effects tab, so remove them from **Active effects** or **Passive effects** on the same tab, or from the token conditions panel on the canvas. Items inside compendiums are not searched or rewritten, since packs can be locked or owned by a module.

## Condition immunity

Items can make a character immune to specific conditions through a condition immunity rule (see the Rules Builder pages). Attempts to apply a condition the actor is immune to are blocked, including the automatic applications described above.

## The condition automation toggles

Two toggles in the GM's [Automation settings](../gm/settings.md#automation) govern conditions. Both are world settings, both default to **on**, and changes take effect immediately without a reload.

**Feature Effects** controls what happens when a feature's rules say "on X, apply condition Y" (for example, a weapon that poisons on a hit):

- **On (the default):** when the trigger fires (damage is applied, a save is failed, a turn starts), the condition is applied to the target automatically.
- **Off:** nothing happens automatically, but the condition still appears as a button on the chat card so the GM can apply it manually.

**Linked Conditions** controls the automatic Hampered behavior described above: whether applying Dazed, Grappled, Prone, Slowed, or Restrained automatically brings Hampered along, and whether Hampered leaves when they do. The counts-as implications, Petrified carrying Incapacitated, and Wounded stacking are always active regardless of these toggles.
## Related pages

- [Conditions Reference](../reference/conditions.md)
- [How Long Effects Last](how-long-effects-last.md)
- [Concentration](concentration.md)
- [Dice Rolls & Chat Cards](dice-and-chat.md)
- [The Character Sheet](../characters/character-sheet.md)
