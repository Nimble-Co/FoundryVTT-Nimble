---
title: "Concentration"
---

# Concentration

When a caster casts a spell with the **Concentration** property ticked, the system puts the Concentration condition on the caster as the chat card posts. The card says **Concentration Applied**, so the player can see that it went on. No GM click is needed. The condition always goes on the caster, never on the targets, whether the spell targets an ally, several creatures or nobody. If the condition cannot go on, the card does not say **Concentration Applied** and the caster gets a warning instead.

## One concentration at a time

A caster holds one concentration at a time. When they cast a second concentration spell, the system removes the old condition and applies a new one, with the new spell as its source. If the new condition cannot go on, the old one stays.

The rulebook says a character can concentrate on only one activity at a time. It does not say what happens when they start a second. Replacing the first is the system's reading of that rule, not printed text.

## When concentration ends

The system ends Concentration when the caster drops to 0 HP or gains Incapacitated, or a condition that counts as Incapacitated, such as Stunned. It also ends it when the spell's Duration passes, if that Duration is in minutes or hours.

When a crit hits the caster, the attack card gets a line that asks for a DC 10 STR save, with a **Roll** button for the owner of the caster. The line appears when the GM clicks **Apply Damage**. On a crit that deals 0 damage, **Apply Damage** stays active so the GM can still click it to get the line. A failure ends Concentration. With **Feature Effects** off, a failure puts a line with **End** on that card instead. On a success, the line says the caster keeps it, such as "Tessa keeps Concentration". The roll posts a save card, so save rules (advantage on STR saves, for example) and rerolls apply to it.

To end concentration on purpose is a free action. A hero gets one free action per turn, and the system does not spend it for you.

## More than one concentration

A feature can give a spell school its own concentration. Stormshifter's Master of Storm does this for Lightning and Wind. Casting a Wind spell leaves a Lightning concentration alone, and the reverse.

Each of these concentrations is a track, and a track follows the school of a spell. A magic item has no school, so a Wand of Fly or a Cloak of Lesser Windform concentrates on the default track. Using one ends a tracked concentration that the caster holds.

Which of two concentrations to end is a choice, not bookkeeping. So when someone removes Concentration from the token panel or the Effects tab, the system asks which one to end. When the caster holds only one, it ends with no prompt.

::: details A school that the feature does not name
Master of Storm names two schools and grants two concentrations. It does not say what happens when the caster concentrates on a spell of a third school. The system reads the feature as a split of the one concentration into two, not as more concentrations:

- A spell of a school that the feature does not name ends every concentration the caster holds.
- A spell of a named school ends that school's concentration, and any concentration from a school that the feature does not name.

This keeps the caster at the two concentrations the feature grants. It is the system's reading of the feature and the one-at-a-time rule, not printed text. A homebrew feature gets the same with the [Concentration Track](../reference/rules-conditions.md#concentration-track) rule.
:::

## Spells, objects and features

Only the **Concentration** property matters, not anything else on the spell. A homebrew spell with **Concentration** ticked works like a spell that the system ships. A spell scroll has the Concentration property of its spell, so it works the same way.

Only spells and objects have the **Concentration** property. A feature whose text says it needs concentration, such as Shadowmancer's Gaze of Two Minds, gets nothing from the system. Apply and remove the condition by hand for it.

With **Feature Effects** off in the Automation settings, casting a spell applies and ends no Concentration. You place it by hand. Its ends wait for **End**, as described in [When an effect ends](how-long-effects-last.md#when-an-effect-ends).

## Related pages

- [Conditions](conditions.md)
- [How Long Effects Last](how-long-effects-last.md)
- [Spells](../homebrew/spells.md)
