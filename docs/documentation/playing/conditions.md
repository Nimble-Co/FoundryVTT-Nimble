---
title: "Conditions"
---

# Conditions

Conditions are status markers (Prone, Frightened, Grappled, and friends) that sit on a character or monster and show as icons on its token. The system ships with the full set of Nimble conditions; for what each one does, see the [Conditions Reference](../reference/conditions.md) (and the Nimble rulebook for the underlying rules). GMs can also [add conditions of their own](#custom-conditions).

## Three ways to apply and remove them

1. **The token.** Select a token and open its overhead controls (right-click the token). The status panel lists every condition by name. Click one to toggle it on or off, and use the clear-all button to wipe them.
2. **The sheet's Conditions tab.** Both the character sheet and the NPC sheet have a Conditions tab listing every condition with a search box and an "active only" filter. Toggle a condition there to apply or remove it. Other temporary and passive effects on the actor are listed on the same tab.
3. **Chat card buttons.** When an attack, spell, or feature inflicts a condition, the condition appears as a button on its chat card. Select the affected tokens and click the button to apply the condition to all of them. Hover the button for the condition's description.

![A chat card with a condition button, next to the token status panel showing named conditions](/images/documentation/condition-chatcard-with-button.png)

## Linked conditions

Some conditions come bundled together, and the system tracks the relationships for you:

- **Counts as.** Some conditions imply others: Grappled also counts as Restrained (and the reverse), and Stunned counts as Incapacitated, Restrained, Paralyzed, and Unconscious for anything that checks those. You'll only see the icon you applied, but rules that look for the implied condition will find it.
- **Applied together.** Petrified automatically carries Incapacitated with it.
- **Automatic Hampered.** Applying Dazed, Grappled, Prone, Slowed, or Restrained automatically applies Hampered as well. When the last of those trigger conditions is removed, Hampered goes away on its own.
- **Wounded stacks.** Unlike other conditions, Wounded can be applied multiple times, one stack per wound.

## Custom conditions

A GM can add conditions of their own from **Game Settings → Configure Settings → Nimble → Manage Conditions** — handy for statuses from content the system doesn't ship with. Each one takes a name, an id, a description, and an icon, and from then on it behaves like any other condition in the token panel, the Conditions tab, and the Rules Builder's condition lists.

Custom conditions are markers only: none of the linked-condition behavior above applies to them, they never stack, and they aren't listed in the generated [Conditions Reference](../reference/conditions.md), which is built from the conditions that ship with the system.

Deleting a custom condition from the settings does not strip it from actors that already have it, so clear it off them first: while the definition still exists it sits in the Conditions tab's list like any other condition. If you've already deleted the definition, the leftover marker drops out of that list — remove it from the same tab's Temporary Effects or Passive Effects section instead, or from the token conditions panel on the canvas.

## Condition immunity

Items can make a character immune to specific conditions through a condition immunity rule (see the Rules Builder pages). Attempts to apply a condition the actor is immune to are blocked, including the automatic applications described above.

## The condition automation toggles

Two toggles in the GM's [Automation settings](../gm/settings.md#automation) govern conditions. Both are world settings, both default to **on**, and changes take effect immediately without a reload.

**Apply Conditions and Effects from Rules** controls what happens when a feature's rules say "on X, apply condition Y" (for example, a weapon that poisons on a hit):

- **On (the default):** when the trigger fires (damage is applied, a save is failed, a turn starts), the condition is applied to the target automatically.
- **Off:** nothing happens automatically, but the condition still appears as a button on the chat card so the GM can apply it manually.

**Derived Conditions** controls the automatic Hampered behavior described above: whether applying Dazed, Grappled, Prone, Slowed, or Restrained automatically brings Hampered along, and whether Hampered leaves when they do. The counts-as implications, Petrified carrying Incapacitated, and Wounded stacking are always active regardless of these toggles.

## Related pages

- [Conditions Reference](../reference/conditions.md)
- [Dice Rolls & Chat Cards](dice-and-chat.md)
- [The Character Sheet](../characters/character-sheet.md)
