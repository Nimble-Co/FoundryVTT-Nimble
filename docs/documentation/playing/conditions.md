---
title: "Conditions"
---

# Conditions

A condition, such as Prone or Frightened, is a status on a character or monster. It shows as an icon on the token. The system has every Nimble condition. The [Conditions Reference](../reference/conditions.md) tells what each one does, and the Nimble rulebook has the full rules. A GM can also [add conditions of their own](#custom-conditions). [How Long Effects Last](how-long-effects-last.md) tells when a condition ends, and [Concentration](concentration.md) covers the Concentration condition.

## Three ways to apply and remove them

1. **The token.** Right-click a token to open its controls. The status panel lists every condition by name. Click one to turn it on or off. The clear-all button removes them all.
2. **The sheet's Effects tab.** The character sheet and the NPC sheet both have an Effects tab. Under **All conditions**, a grid shows each condition that you set by hand. Click a condition to apply or remove it. A condition that is on is crimson, with a check. Charged, Distracted, Marked and Smoldering are small buttons under **Other conditions**. The system sets Bloodied, Dying, Dead, Wounded, Last Stand and Concentration itself, so they are not in the grid. The list above the grid shows every condition that is on, these six too. Click a row to remove its condition. The sheet asks first. The same tab lists the active and passive effects on the actor.
3. **The Effects part of a chat card.** A card that gives an effect has a row for it under **Effects**, with its Lasts Until. **Apply to Targets** puts the effect on the card's targets. An effect for the user goes on by itself when the item is used. With the **Feature Effects** automation setting off, the row has an **Apply to You** button instead. The user who rolled the card and the GM can click these buttons. Then the row shows who has the effect, such as "✓ On Goblin". For a creature you do not own, a GM must be connected.

![A chat card for Ice Lance: the cold damage, and an Effects part with Slowed and Apply to Targets](/images/documentation/apply-effect-chat-card.png)

## Blinded

Blinded uses Foundry's blindness. A Blinded token sees only its own space, so through that token you see no other token. A detection mode other than sight still works, if the GM adds one to the token. Nimble gives Blindsight no detection mode. A creature that fights in the dark is Blinded, unless a light or Darkvision lets it see. The GM applies that Blinded.

## Conditions that change a roll

Some conditions give advantage or disadvantage. The roll window lists each one under **Situational Modifiers** as a tick with its name and the creature, for example "Blinded (Goblin)". The tick is on when the window opens, and the slider already counts it. Take the tick off when the condition does not apply. A roll with no window uses every tick that would start on. A roll has no window when an item skips it, when you hold Alt, from a macro, for a minion group attack, and for initiative from the combat tracker.

Each condition is one step, and the steps stack and cancel as other advantage and disadvantage do.

**The target of an attack.** These count only when the attack has one target. A Multi-target or area attack ignores them (Core Rules).

- Blinded, Grappled or Restrained, Incapacitated (also Paralyzed, Stunned, Unconscious, Petrified): advantage. Grappled and Restrained together are one step.
- Prone: advantage on a melee attack, disadvantage on a ranged attack. A Reach attack is melee. A spell with no attack type is ranged with Range and melee with Reach. A weapon ability attacks as the weapon you pick. A monster attack with no attack type is melee, unless it is an area attack. When the attack is neither, the window shows both lines with their ticks off, and you pick one.
- Invisible: disadvantage.

**The one who attacks.** These count also on Multi-target and area attacks.

- Blinded, Prone, Taunted, Despair: disadvantage.
- Invisible: advantage.
- Taunted gives no disadvantage when the only target is the most recent taunter. The system knows the taunter when a feature applied Taunted. When someone applied it by hand, the tick is on, and you take it off for an attack on the taunter.
- Despair lasts until your next attack or until combat ends. Your next attack ends it, even when you take its tick off. Despair applied by hand ends the same way.

**Every roll.** Poisoned and Frightened give disadvantage on attacks, saves, checks and initiative. Only a character rolls for initiative, so a monster's initiative has no condition lines. The Frightened line says "source of fear nearby". Take its tick off when the source is not near.

The card names each condition that changed the roll as a tag, for example **Advantage: Blinded (Goblin)**. Hover or click the tag to read the rule. When a feature takes away all disadvantage, the card shows no disadvantage tag. A minion group attack shows the lines under each minion.

## Latched and Swallowed

These two conditions come from monsters. The GM removes them by hand.

- Latched goes on the creature that hit with Latch On, and the creature stores who it hit. Its attacks cannot miss. When an attack on it misses, the card has one button for the whole attack, **Apply N Damage to** that creature. N is the amount after the creature's armor, immunity, resistance and damage reduction. If nobody clicks, nothing happens. The system does not move the Latched creature with its target. The table does that.
- Swallowed goes on the target of a crit from Bite/Swallow. The creature takes 20 damage at the start of its turn. The line on the turn start card has **Undo**. Its attacks cannot miss and ignore armor.

With Feature Effects off, the GM applies them by hand. At the start of a Swallowed creature's turn, the line has a **Take Damage** button, and the creature takes no damage until someone clicks it. The attack effects and the Latched button still work.

## Linked conditions

Some conditions bring others with them. The system tracks these links:

- **Counts as.** As the book says, Paralyzed, Stunned and Unconscious each count as Incapacitated, and Grappled and Restrained count as each other. The Incapacitated link works one way. Incapacitated alone does not count as Stunned, Paralyzed or Unconscious, and Stunned counts only as Incapacitated. The token shows only the icon you applied, but a rule that looks for the implied condition finds it.
- **Applied together.** Petrified brings Incapacitated with it.
- **Automatic Hampered.** Dazed, Grappled, Prone, Slowed and Restrained each bring Hampered. When the last of them goes, the system removes Hampered.
- **Wounded stacks.** Unlike other conditions, Wounded can go on more than once, one stack per Wound.

## Negative conditions

A negative condition harms its holder. An End Conditions step (a reaction that "ends all negative conditions", for example) ends each effect that gives one. All conditions are negative except the states the system sets (Bloodied, Dying, Dead, Wounded, Last Stand, Concentrating) and the ones that help or do nothing on their own (Invisible, Riding, Latched). Grappled and Swallowed are negative. With **Linked Conditions** on, a Hampered beside Dazed, Grappled, Prone, Slowed or Restrained goes when that condition goes. With it off, the step ends that Hampered too. A custom condition is negative unless its **Negative** box is off. The [Conditions Reference](../reference/conditions.md) marks each negative condition.

## Custom conditions

A GM can add conditions of their own from **Game Settings → Configure Settings → Nimble → Manage Conditions**, for statuses from content that the system does not ship. Each one has:

- a name, an id, a plain-text description and an icon
- a **Minor Status** box. A Minor Status ends when combat ends.
- a **Negative** box, on at the start. An End Conditions step ends a [negative condition](#negative-conditions).

A custom condition then works like any other condition in the token panel, on the Effects tab and in the condition lists of the Rules Builder.

A custom condition is only a marker. None of the linked conditions above apply to it, and it never stacks. The generated [Conditions Reference](../reference/conditions.md) does not list it, because the system builds that page from the conditions it ships.

When you remove a custom condition that something still uses, a confirmation lists the creatures that have it, and the items whose rules or activation effects name it. **Remove Everywhere** deletes those effects and takes the condition out of those items. **Remove Only** deletes the condition and leaves the references in place. Nothing changes until you save the conditions list, so closing the editor cancels the removal.

After **Remove Only**, markers and rules point at an id that no condition has. Those rules stop working, and their card in the Rules Builder says why. The leftover markers are not in the condition grid of the Effects tab. Remove them from **Active effects** or **Passive effects** on the same tab, or from the conditions panel of the token. The system does not search or change items in compendiums, because a pack can be locked or belong to a module.

## Condition immunity

An item can make a character immune to a condition with a condition immunity rule (see the Rules Builder pages). The system then blocks every attempt to apply that condition, the automatic ones above too.

## The condition automation toggles

Two toggles in the GM's [Automation settings](../gm/settings.md#automation) control conditions. Both are world settings and both start on. A change works at once, with no reload.

**Feature Effects** controls what happens when a feature's rules say "on X, apply condition Y", such as a weapon that poisons on a hit. With it on, the system applies the condition to the target when the event happens, such as when damage is applied, a save fails or a turn starts. With it off, nothing happens by itself, but the condition shows as a button on the chat card so the GM can apply it.

**Linked Conditions** controls the automatic Hampered above. With it on, Dazed, Grappled, Prone, Slowed and Restrained bring Hampered, and Hampered goes when they do. The "counts as" links, Petrified bringing Incapacitated, and Wounded stacks always work, whatever these toggles are set to.

## Related pages

- [Conditions Reference](../reference/conditions.md)
- [How Long Effects Last](how-long-effects-last.md)
- [Concentration](concentration.md)
- [Dice Rolls & Chat Cards](dice-and-chat.md)
- [The Character Sheet](../characters/character-sheet.md)
