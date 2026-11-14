---
title: "What You Can (and Can't) Change"
---

# What You Can (and Can't) Change

Everything in the Homebrewing section is point-and-click. You need no code, no modules and no file edits. If a page in this section describes it, you can build it in Foundry with sheets, fields and buttons, the same tools that the official content uses.

## You can do all of this without touching code

- Weapons, armor and gear with working attack rolls, damage and properties, which work at the table like pack items.
- Spells, with upcasting, that cast the same way as the official spells.
- Monsters: NPCs, minions and solo bosses, with their own attacks and abilities.
- Whole classes, subclasses, ancestries, backgrounds and boons, through the same character creator and level-up steps as the official ones.
- Passive bonuses to stats, armor, speed, skills, saving throws and max hit points, and more, such as damage, initiative and Wounds.
- An item or feature that grants other items, spells, proficiencies, or movement types such as flying or swimming.
- Custom conditions with their own name, description and icon. The GM adds them from **Game Settings → Configure Settings → Nimble → Manage Conditions**. They show in the token HUD and the condition lists next to the built-in ones, and rules can apply them like any other condition.
- Condition immunity, from a creature or an item that makes its owner immune to a condition.
- Conditions applied on a hit, such as a blade that dazes on a crit or a monster attack that poisons.
- Charges and dice pools for limited-use abilities that track and spend their own resource.
- Inline roll buttons in any description: skill checks, saving throws and condition links that you click in the text.

The automatic parts come from **rules** that you add to items with the Rules Builder. Each rule can have conditions in **the Condition box**, so that it applies only when you want, such as while Bloodied or while the item is equipped.

![The Rules Builder on a homebrew item, showing a couple of configured rules](/images/documentation/rules-builder-example-item.png)

## You can't (without a module or code changes)

These need a module or a change to the system's code:

- **New condition behavior.** Your own conditions are only markers. They do not get the built-in behavior of the official ones: which conditions count as others, which go on together, which stack, and which go on by themselves.
- **New rule types.** You combine the rule types that the system ships. You cannot make a new kind of rule inside Foundry.
- **Core dice math.** How attacks, saves and crits resolve is built in.
- **New sheet layouts.** You cannot rearrange or redesign the character sheet or the NPC sheet.
- **New actor kinds** beyond character, NPC, minion and solo monster.

If you need one of these, ask for it as a feature request on the [GitHub issues page](https://github.com/Nimble-Co/FoundryVTT-Nimble/issues) or in the Discord.

## Homebrew safely

Do not edit compendium packs. A system update replaces their contents, and your changes with them. Drag or duplicate the closest official example into your world and change the copy. Open a pack item's sheet, look at its rules and activation, and copy the pattern.

::: tip Reverse-engineer the packs
The shipped content uses every method on these pages. To learn how to build something, open an official item that does something similar.
:::

## Where to go next

| To make... | Read |
| --- | --- |
| A weapon, armor, shield, or piece of gear | [Items & Equipment](items.md) |
| An item or feature that *does* something when used | [Activations](activations.md) and [On Use Steps](activation-steps.md) |
| An effect that an item or a step gives | [Effects](effects.md) |
| An effect that ends at a turn, after a time, or when something happens | [Lasts Until, Stacks and Escape](lasts-until.md) |
| An effect that changes a later attack, or deals damage each turn | [Held Changes and Damage Each Turn](held-changes.md) |
| A spell (including upcasting) | [Spells](spells.md) |
| A monster, minion, or solo boss | [Monsters](monsters.md) |
| A class, subclass, ancestry, background, or boon | [Character Options](character-options.md) |
| Clickable roll buttons inside descriptions | [Inline Roll Buttons](enrichers.md) |
| Automatic effects on any of the above | [Rules Builder](../rules-builder/index.md) |
| A feature that changes the result of a save or a check after the roll | [Change a Result](../reference/rules-triggers.md#change-a-result) |
| A rule that only applies sometimes | [Conditions (the Condition box)](../rules-builder/predicates.md) |
| Values that scale, like `@level` | [Formulas](../rules-builder/formulas.md) |

## Related pages

- [Rules Builder](../rules-builder/index.md)
- [Items & Equipment](items.md)
- [Monsters](monsters.md)
- [Core Concepts](../core-concepts.md)
