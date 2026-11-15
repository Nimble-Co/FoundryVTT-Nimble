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
Compendium content is refreshed whenever the system updates. If you want to tweak something (a spell, a monster, a weapon), drag it into your world (or duplicate it there) and edit the copy. If a later update wants to change one of those copies, it asks first, and you can keep your edits. See [Core Concepts](core-concepts.md) for more on this habit.
:::

## How updates work

Updating the system is done from the Foundry setup screen (**Game Systems** tab, **Update** button), the same as any other system.

After an update, the first time a GM logs in, Nimble checks whether the world needs migrating. Only a GM can run a migration, so a player who gets in first sees a note asking them to wait.

Most updates migrate on their own and show a short note when they finish. If an update would change something you copied into your world from a compendium, such as a spell on a character or a monster on a scene, the **World Migration** window opens first and shows every copy it would touch.

- On the left, the copies are grouped **By Item** or **By Actor**. Click a group to see its copies on the right, where each one lives, and what changes. A ban icon marks a group where you kept some copies out.
- To keep a copy as it is, tick **Choose Copies** and untick that copy. It keeps its old rules, effects and text. Changes with a lock icon still run, because they fix how the data is stored and the copy breaks without them.
- **Start Migration** runs it. A progress bar fills, and each group gets a check when it's done. **Later** closes the window until your next login.

When it's done, the window shows the Migration Report. It lists each migration that ran and the copies it changed, the copies you kept out, any errors, and any popups that appeared along the way. **Copy Report** copies the text, which is handy for a bug report. Older reports are under **World Migration** in the system settings, newest first.

::: warning Back up first
You can't undo a migration. Back up your world from the Foundry setup screen before you click **Start Migration**.
:::

::: details If the migration stops
If Foundry closes partway through, or an error stops the run, the window comes back at the next GM login with a **Continue Migration** button. After an error, reload the world to carry on. The copies you kept out stay out, and that choice is locked by then. The report notes that the run picked up where an earlier one stopped.
:::

## Before your first session

Take five minutes to look through the system settings (**Game Settings**, then **Configure Settings**, under the **Nimble** heading). A few of them change how combat and automation behave for the whole table, and it's better to pick your preferences before play starts than mid-fight. The [Settings](gm/settings.md) page walks through the choices, and the [settings reference](reference/settings.md) lists every option.

## Related pages

- [Core Concepts](core-concepts.md)
- [Creating a Character](characters/creation.md)
- [Settings](gm/settings.md)
