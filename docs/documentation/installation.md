---
title: "Installation & First Steps"
---

# Installation & First Steps

This page gets you from a fresh Foundry install to a playable Nimble world.

## Requirements

The current release of the Nimble system requires **Foundry VTT version 13**. Earlier versions of Foundry will not run it.

## Installing the system

1. Launch Foundry VTT and go to the setup screen.
2. Open the **Game Systems** tab and click **Install System**.
3. Search for **Nimble** and click **Install**.

That's it. The system and all of its content packs download together. There are no required modules.

## Creating a world

1. On the setup screen, open the **Game Worlds** tab and click **Create World**.
2. Give your world a title and choose **Nimble** as the game system.
3. Launch the world and log in as the Gamemaster.

## What's in the box: the compendium packs

Open the **Compendium Packs** tab in the sidebar and you'll find the full Nimble content library, ready to drag into your world:

| Pack | What's inside |
| --- | --- |
| **Nimble Classes** | Every class, ready to drag onto a character sheet. |
| **Nimble Subclasses** | The subclass options for each class. |
| **Nimble Class Features** | The individual features each class delivers as you level. You rarely browse this pack directly, since the character creator and level-up flow pull from it for you. |
| **Nimble Ancestries** | The playable ancestries. |
| **Nimble Backgrounds** | The playable backgrounds. |
| **Nimble Boons** | Minor, major, and epic boons, plus lodging boons. |
| **Nimble Spells** | The spells for every school of magic. |
| **Nimble Secret Spells** | The secret spells of each school (see the Nimble rulebook). |
| **Nimble Items** | Mundane equipment: weapons, armor, consumables, and miscellaneous gear. |
| **Nimble Magic Items** | Magic items from the core rules and GM guide, including wands and spell scrolls. |
| **Nimble Monsters** | The standard bestiary, including minions. |
| **Nimble Legendary Monsters** | Solo boss monsters, built on their own sheet type. |
| **Nimble Monster Abilities** | The flavorful monster abilities and the legendary optional actions from the GM guide, as monster features. |
| **Nimble Hazards** | Room and travel hazards from the GM guide adventures, as monster features. |
| **Nimble Tables** | Roll tables used by certain features and boons, such as the chaos table. |

::: tip Copy before you customize
Compendium content is refreshed whenever the system updates. If you want to tweak something (a spell, a monster, a weapon), drag it into your world (or duplicate it there) and edit the copy. An update can change your world's copies too, but it asks you first, and you can keep a copy out (see below). See [Core Concepts](core-concepts.md) for more on this habit.
:::

## How updates work

Updating the system is done from the Foundry setup screen (**Game Systems** tab, **Update** button), the same as any other system.

The first time a Gamemaster logs into a world after an update, the system checks if the world's data is from an older version. Only the GM can migrate a world, so a player who logs in first sees a note that the world waits for the GM.

When an update changes none of the items and monsters you copied from a compendium, it runs by itself, and you see a short note when it finishes. When it changes some of them, such as a spell on a character or a monster on a scene, the **World Migration** window opens first and lists each Compendium Copy that changes:

- **By Item** and **By Actor** sort the same list two ways. Open a group to see where each copy is and which changes it gets.
- Tick **Choose Copies** to keep a copy out. A copy you keep out keeps its old rules, effects and text. Changes with a lock icon fix the shape of the data. They always run, because the copy stops working without them.
- **Start Migration** writes the changes, and a bar shows the progress. **Later** closes the window, and it opens again at your next login.

When the migration finishes, the window shows the Migration Report: what changed, the copies you kept out, and any errors. **Copy Report** copies it as text, for a bug report. To read old reports, open **World Migration** in the system settings.

::: warning Back up before you start
A migration cannot be undone. Make a backup of your world from the Foundry setup screen before you click **Start Migration**.
:::

::: details If the migration stops
If Foundry closes during a migration, the window opens again at the next GM login with **Continue Migration**. It keeps the copies you kept out, and you cannot change them. The report says that the run continued an earlier one.
:::

## Before your first session

Take five minutes to look through the system settings (**Game Settings**, then **Configure Settings**, under the **Nimble** heading). A few of them change how combat and automation behave for the whole table, and it's better to pick your preferences before play starts than mid-fight. The [Settings](gm/settings.md) page walks through the choices, and the [settings reference](reference/settings.md) lists every option.

## Related pages

- [Core Concepts](core-concepts.md)
- [Creating a Character](characters/creation.md)
- [Settings](gm/settings.md)
