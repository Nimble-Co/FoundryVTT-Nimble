---
title: "Monsters, Minions & Solo Monsters"
---

# Monsters, Minions & Solo Monsters

The system gives you three kinds of monster actor, each matching one of the roles monsters play in Nimble. Pick the right type when you create the actor and the combat tracker, sheets, and automation all behave correctly on their own.

## Which type do I use?

| Type | Use it for | What the system does differently |
| :--- | :--- | :--- |
| **NPC** | Ordinary monsters and foes | The standard monster: hit points, one turn per round after the characters. |
| **Minion** | Weak monsters that swarm | No hit point bar on the sheet; can attack in groups and share a single tracker turn (see [Running Combat](combat.md)). |
| **Solo Monster** | Boss fights | Takes a turn after *every* character's turn, and has dedicated slots for Bloodied and Last Stand features. |

You choose the type in the actor creation window. If you're not sure, use NPC.

::: tip Legendary monsters ship ready-made
The **Nimble Legendary Monsters** compendium contains the legendary monsters from the rulebook as fully built solo monsters. Several bring their own companion minions too. Check there before building a boss from scratch.
:::

## A tour of the NPC sheet

All three types share the same sheet. The monster's name and a line such as *"Level 3 Medium Goblin"* are at the top. The rail on the left shows the portrait, the hit points, the saves, the armor, the speeds, and the damage defenses (Resist, Immune and Vulnerable), with the tabs under them. Click a save to roll it. NPCs and solo monsters have an **HP** and a **Temp HP** plate; click a number to type a new one. Minions have no hit points: in place of the plate, the rail tells you that any damage kills a minion and that a minion cannot crit (see the Nimble rulebook for how minions handle damage).

![The NPC sheet of a solo monster, with the rail on the left and its abilities as cards](/images/documentation/monster-sheet.png)

The sheet has four tabs, in the menu at the bottom of the rail:

- **Abilities**: the monster's features and actions, as cards in columns like a stat block. This is where you'll spend the fight.
- **Effects**: the conditions and effects on the monster, with the same condition grid as the character sheet. Toggle conditions on and off here or from the token. See [Conditions](../playing/conditions.md).
- **Notes**: the monster's description and any notes of your own. For an imported monster, the credit line is at the bottom.
- **Settings**: the monster's level, size, creature type and monster type (to read), the controls for how the portrait sits in its frame (offset and scale), whether item macros run, and the coins the creature carries.

### Edit mode

The sheet opens out of edit mode. Click **Edit**, the last row of the menu at the bottom of the rail, to change the monster. In edit mode you can change the portrait and the name, type the maximum HP, and select the armor (None, Medium or Heavy). The parts that you can configure get an outline:

- The outline on the line beside the name opens the monster window: level, creature type, size, monster type, whether an NPC is a *flunky* (see the Nimble rulebook for what that means at the table), and the damage defenses. The outline on the damage defenses opens the same window. The Apply Damage button honors resistances (half damage) and immunities (no damage) automatically.
- The outlines on the saves and the speeds open their windows.

Click **Edit** again to stop.

### The narrow form

A GM opens many NPC sheets in an encounter. Make the window narrower than 560 px, and the rail becomes a header with the HP and a strip of tabs. In the narrow form, **Edit** is the pen in the header. With the setting **Open NPC sheets narrow** on, NPC sheets open 390 px wide, in the narrow form. Each user sets it for their own screen, in **Configure Settings** on the Nimble tab. It is off at the start.

## Using features and actions

Everything a monster can do lives on the Abilities tab as a *monster feature*, sorted into groups:

- **Features**: passive abilities. Their text is there when you need it.
- **Actions**: attacks and activated abilities. A monster's attack routine can appear as an *attack sequence*: a parent card describing the routine, with its individual attacks nested beneath it.
- **Bloodied** and **Last Stand**: solo monster phase abilities, kept in their own groups so they're impossible to miss when the fight turns.

The text of each card starts open. The arrow at the start of a card closes or opens its text, and the pen opens the feature's window. Click the name of an action to use it: the system rolls its attack and damage and posts a chat card, where hits, misses, and an apply-damage button are handled for you, the same flow as player attacks (see [Dice & Chat](../playing/dice-and-chat.md)). A click on the name of a feature posts it to chat. In edit mode, **Create Feature** adds a new feature, you can type the uses of a feature, and each card has a trash button. The sheet asks before it deletes.

Drag a card to change the order, or drop an action on an attack sequence to nest it. On a touch screen you can drag only in edit mode.

::: tip Don't open sheets mid-fight if you don't have to
During combat, the **Combat System** panel can roll monster and minion actions straight from the canvas: select the token, pick the action, roll. See [Running Combat](combat.md).
:::

## Solo monsters

Solo monsters are built for the boss-fight math: the tracker automatically gives them a turn after every character's turn, so a lone dragon keeps pace with a whole party. Their Bloodied and Last Stand features sit in their own groups on the Abilities tab so the phase change is right in front of you when their hit points cross the line.

## Minions

Minions are deliberately lightweight: no hit point tracking on the sheet, and they shine in groups. Select several minion tokens during combat and the Combat System panel rolls all their attacks as one group attack with a single combined damage total. Minions that attack together share one turn in the tracker for the rest of the round. The full workflow is on the [Running Combat](combat.md) page.

## The monster compendiums

The system ships with everything from the rulebook, ready to drag onto a scene:

- **Nimble Monsters**: the standard bestiary, organized into folders by family (bandits, goblins, kobolds, horrors, and so on). Contains NPCs and minions.
- **Nimble Legendary Monsters**: the legendary monsters as solo monster actors, plus the companion minions some of them summon.
- **Nimble Tables**: roll tables used by game content, including the Chaos Table, the Control Table, and Lodging Boons.

Drag a monster from a compendium into the sidebar or straight onto a scene. Imported monsters are regular actors: edit them freely without affecting the compendium copy.

Want to build your own, or tweak a stat block beyond a few numbers? [Homebrew Monsters](../homebrew/monsters.md) covers creating monsters and their features from scratch, and [Importing & Exporting](import-export.md) shows how to pull monsters in from Nimble Nexus.

## Related pages

- [Running Combat](combat.md)
- [Homebrew Monsters](../homebrew/monsters.md)
- [Importing & Exporting](import-export.md)
- [Conditions](../playing/conditions.md)
