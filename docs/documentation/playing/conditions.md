---
title: "Conditions"
---

# Conditions

Conditions are status markers (Prone, Frightened, Grappled, and friends) that sit on a character or monster and show as icons on its token. The system ships with the full set of Nimble conditions; for what each one does, see the [Conditions Reference](../reference/conditions.md) (and the Nimble rulebook for the underlying rules). GMs can also [add conditions of their own](#custom-conditions).

## Three ways to apply and remove them

1. **The token.** Select a token and open its overhead controls (right-click the token). The status panel lists every condition by name. Click one to toggle it on or off, and use the clear-all button to wipe them.
2. **The sheet's Effects tab.** Both the character sheet and the NPC sheet have an Effects tab. Under **All conditions**, a grid shows each condition that you set by hand. Click a condition to apply or remove it. A condition that is on is crimson, with a check. Charged, Distracted, Marked and Smoldering are small buttons under **Other conditions**. The system sets Bloodied, Dying, Dead, Wounded, Last Stand and Concentration itself, so they are not in the grid. Each condition that is on, also these six, shows in the list above the grid. Click its row to remove it: the sheet asks first. The active and passive effects on the actor are listed on the same tab.
3. **The Effects part of a chat card.** A card that gives an effect has a row for it under **Effects**, with its Lasts Until. **Apply to Targets** puts it on the card's targets, **Apply to You** on the user. The user who rolled the card and the GM can click. Then the row tells who has it: "✓ On Goblin". For a creature you do not own, a GM must be connected.

![A chat card for Ice Lance: the cold damage, and an Effects part with Slowed and Apply to Targets](/images/documentation/apply-effect-chat-card.png)

## Blinded

Blinded uses Foundry's blindness. The vision of a Blinded token reaches only its own space, so through that token you see no other token. A detection mode that is not sight, which the GM adds to the token, still works. Nimble does not give Blindsight a detection mode. Fighting in the dark imposes Blinded, unless a light or Darkvision lets the creature see. The GM applies it.

## Conditions that change a roll

Some conditions give advantage or disadvantage. The roll window lists each one under **Situational Modifiers** as a tick with its name and the creature, for example "Blinded (Goblin)". The tick is on when the window opens, and the slider already counts it. Take the tick off when the condition does not apply. A roll with no window (an item set to skip it, Alt, a macro, a minion group attack, initiative from the combat tracker) uses every tick that would start on.

Each condition is one step, and the steps stack and cancel as other advantage and disadvantage do.

**The target of an attack.** These count only when the attack has one target. A Multi-target or area attack ignores them (Core Rules).

- Blinded, Grappled or Restrained, Incapacitated (also Paralyzed, Stunned, Unconscious, Petrified): advantage. Grappled and Restrained together are one step.
- Prone: advantage on a melee attack, disadvantage on a ranged attack. A Reach attack is melee. A spell with no attack type is ranged with Range and melee with Reach. A weapon ability attacks as the weapon you pick. When the attack is neither (most monster attacks have no attack type), the window shows both lines with their ticks off, and you pick one.
- Invisible: disadvantage.

**The one who attacks.** These count also on Multi-target and area attacks.

- Blinded, Prone, Taunted, Despair: disadvantage.
- Invisible: advantage.
- Taunted gives no disadvantage when the only target is the most recent taunter. The system knows the taunter when a feature applied Taunted. When you applied it by hand, the tick is on and you take it off for an attack on the taunter.
- Despair ends after the attack that used it. When you take its tick off, Despair stays.

**Every roll.** Poisoned and Frightened give disadvantage on attacks, saves, checks and initiative. Only a character rolls for initiative, so a monster's initiative has no condition lines. The Frightened line says "source of fear nearby": take it off when the source is not near.

The card names each condition that changed the roll as a tag, for example **Advantage: Blinded (Goblin)**. Hover or click the tag to read the rule. When a feature takes away all disadvantage, the card shows no disadvantage tag. A minion group attack shows the lines under each minion.

## Latched and Swallowed

These two conditions come from monsters. The GM removes them by hand.

- **Latched** goes on the creature that hit with Latch On, and the creature stores who it hit. Its attacks cannot miss. When an attack on it misses, the card has one button for the whole attack, **Apply N Damage to** that creature. N is the amount after the creature's armor, immunity, resistance and damage reduction. With no click, nothing happens. Moving with the target stays with the table.
- **Swallowed** goes on the target of a crit from Bite/Swallow. The creature takes 20 damage at the start of its turn. Its attacks cannot miss and ignore armor.

With Feature Effects off, the GM applies them by hand and there is no damage at the start of the turn. The attack effects and the button stay.

## Linked conditions

Some conditions come bundled together, and the system tracks the relationships for you:

- **Counts as.** Some conditions imply others: Grappled also counts as Restrained (and the reverse), and Stunned counts as Incapacitated, Restrained, Paralyzed, and Unconscious for anything that checks those. You'll only see the icon you applied, but rules that look for the implied condition will find it.
- **Applied together.** Petrified automatically carries Incapacitated with it.
- **Automatic Hampered.** Applying Dazed, Grappled, Prone, Slowed, or Restrained automatically applies Hampered as well. When the last of those trigger conditions is removed, Hampered goes away on its own.
- **Wounded stacks.** Unlike other conditions, Wounded can be applied multiple times, one stack per wound.

## How long a condition lasts

A condition, or any other effect, can have a **Lasts Until**: one or more moments that end it, in the book's words.

- **A turn.** "Until the end of their next turn" follows the turns of the creature with the effect. "Until the start of your next turn" follows the turns of the creature that applied it. "Their next turn" is the first turn that starts after the effect goes on, so an effect applied in their own turn lasts through their next one.
- **A time.** "For 1 minute" follows world time. "For 1 round" lasts until the same place in the turn order one round later; applied at Initiative, it lasts all of round 1.
- **An event.** "Until they attack", "until they drop to 0 HP", "until Rage ends" and others end it when that happens. An attack is a use with a damage roll, or one that asks another creature for a save. A move is any change of the token's place.

When an effect has more than one moment, the first one to happen ends it. A turn or round moment also ends when combat ends, and out of combat it ends when world time moves on. **Minor Statuses** (Charged, Distracted, Smoldering, and the custom conditions you mark) end when combat ends. A GM must be connected for an effect to end.

On the Effects tab, the row reads the Lasts Until and the source: "Until the end of your next turn - Snowblind".

**Escape.** An effect such as Grappled can have an Escape button on its row, for example **Escape DC 13**. It rolls the save (you pick when more than one is allowed), spends 1 action in combat, and ends the effect on a success.

When effects end, the chat gets one message for that moment, such as "Start of Tessa's turn", with a row for each effect that ended. **Undo** on a row puts that effect back. The owner of the creature and the GM can use it. The effect keeps its old start, so it ends again at the next matching moment. Going back a turn in the combat tracker does not bring effects back.

![The message for one moment: three effects ended, one put back with Undo](/images/documentation/effects-ended-message.png)

**The same condition again.** When a creature that has a condition gets it again, the one that lasts longer stays. A second Taunted always takes the place of the first, so the most recent taunter counts.

::: details How the system compares two Lasts Until
It estimates each in rounds and keeps the first moment: the end of the current turn is half a round, the start of the next turn or the current round one, the end of the next turn one and a half, the next round two, "for N rounds" N, and a time what is left of it. An event, or no moment at all, has no end. When the two are equal, the one already on the creature stays.
:::

## Concentration

Concentration applies itself. Casting a spell whose **Concentration** property is ticked puts the Concentration condition on the caster as the chat card posts, and the card says **Concentration Applied** so the player can see it took. No GM click is involved, and it happens whether the spell targets an ally, several creatures, or nobody at all. The condition always lands on the caster, never on the targets. If the condition cannot be applied, the card says nothing and the caster gets a warning instead.

A caster holds one concentration at a time. Casting a second concentration spell ends the first: the old condition is removed and a new one applied, credited to the new spell. If the new one is refused, the first is left where it was.

The rulebook says a character can only concentrate on one activity at a time, but it does not say what happens when they start a second. Replacing the first is the system's reading of that, not printed text.

**Casters who concentrate on more than one thing.** A feature can give a spell school a concentration of its own. Stormshifter's **Master of Storm** does this for Lightning and Wind, so casting a Wind spell leaves a Lightning concentration alone and the other way round.

Master of Storm names two schools and grants two concentrations. What it does not say is what happens when that caster concentrates on a third school, so the system reads the naming as splitting their single concentration rather than adding to it: casting in a school the feature does not name ends every concentration they hold, and casting in a named school ends that school's concentration along with anything held in an unnamed school. That reading keeps them at the two the feature grants. It is the system's reading of the printed line plus the one-at-a-time rule, not printed text. Homebrewers get the same through the [Concentration Track](../reference/rules-conditions.md#concentration-track) rule.

Tracks follow a spell's school, and a magic item carries no school. So a Wand of Fly or a Cloak of Lesser Windform concentrates on the default track, and using one ends a tracked concentration the caster is holding.

Ending one of two held concentrations is a choice rather than bookkeeping, so removing Concentration from the token panel or the Effects tab asks which one should end. A caster holding only one is ended without a prompt.

This is driven by the property, not by anything authored on the spell, so a homebrew spell that ticks **Concentration** behaves exactly like one the system ships. The same goes for a spell scroll, which carries the inscribed spell's Concentration property.

What the system does *not* do is break concentration for you. Losing it when crit (a DC 10 STR save), at 0 HP, or when Incapacitated is still yours to track. Remove the condition by hand when it ends. Ending concentration deliberately is a free action, and a hero gets one free action per turn, which the system does not spend for you either.

Only spells and objects carry the **Concentration** property, so a feature that holds concentration in its text, such as Shadowmancer's **Gaze of Two Minds**, is not covered. Apply and remove the condition by hand for those.

Turning off **Feature Effects** in the Automation settings turns this off with it: casting then applies nothing and ends nothing, and Concentration is yours to place by hand.

## Custom conditions

A GM can add conditions of their own from **Game Settings → Configure Settings → Nimble → Manage Conditions**. This is handy for statuses from content the system doesn't ship with. Each one takes a name, an id, a plain-text description, an icon, and a **Minor Status** box (a Minor Status ends when combat ends), and from then on it behaves like any other condition in the token panel, the Effects tab, and the Rules Builder's condition lists.

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
- [Dice Rolls & Chat Cards](dice-and-chat.md)
- [The Character Sheet](../characters/character-sheet.md)
