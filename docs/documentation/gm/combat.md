---
title: "Running Combat"
---

# Running Combat

Combat is where the system does the most work for you. This page walks through a fight from start to finish: rolling initiative, reading the tracker, taking turns, and the special handling for solo monsters and minion hordes.

For how combat works as a game (actions, heroic reactions, what initiative means), see the Nimble rulebook. This page covers what the software does.

## Starting a fight

Add your monsters and the party to the combat as you normally would in Foundry (select the tokens and toggle their combat state), then press **Begin Combat**.

When combat begins, the system automatically:

- Rolls initiative for every character who hasn't rolled yet.
- Sets every monster's actions to full. Monsters don't roll initiative. They simply act after the characters.
- Refreshes every character's heroic reactions.

A character's initiative roll decides how many actions they start their first round with, exactly as in the rulebook: a total of 20 or more grants 3 actions, 10 or more grants 2, and anything less grants 1. The tracker shows these as action pips on each character's card.

::: tip Players can roll their own initiative
A player can roll initiative from their character sheet before the fight starts, using the full roll window (advantage, disadvantage, situational modifiers, and roll visibility). If you enable the **Auto-Add Character To Combat On Initiative Roll** setting, rolling from the sheet also adds the character to the current scene's combat automatically, which is handy for ambushes and late arrivals.
:::

### What can modify initiative

Items built with the Rules Builder can change how initiative behaves, and several ship this way out of the box:

- **Initiative bonuses** add a flat modifier to the roll.
- **Initiative roll modes** make the character roll with advantage or disadvantage by default.
- **Initiative messages** whisper a reminder to the player the moment they roll, perfect for "don't forget your feature triggers at the start of combat" notes.
- **Combat mana** grants are also triggered by the initiative roll (see [Combat mana](#combat-mana) below).

## The combat tracker

The Nimble combat tracker sits across the top of the screen and shows one card per combatant, in turn order. Hovering a card highlights its token on the canvas. Character cards show action pips, heroic reactions, and resources; monster cards can show hit point bars and be expanded for a closer look.

![The combat tracker at the top of the screen during an active combat, with a character card's resource drawer open](/images/documentation/combat-tracker.png)

The tracker is heavily customizable: width, card size, colors, hit point bar display, what players are allowed to see, and more. Click the gear button on the tracker to open the **Combat Tracker Settings** window, and see the [Settings Reference](../reference/settings.md) for the full list of options rather than hunting for them here.

::: info The Combat System panel
Alongside the tracker there is a separate **Combat System** panel for GMs, used to run monster and minion attacks quickly. You can show or hide it with the crosshairs button in the token controls, or turn it off entirely with the **Enable Combat System** setting. It's covered in [Minions and hordes](#minions-and-hordes) below.
:::

## Turn order and turns

Turn order in Nimble is simple: all characters act first, then the monsters. Within each group, the order is whatever the tracker shows, and you can drag cards to reorder them. As GM you can reorder anyone; trusted players can reorder their own character.

As the round progresses, the system keeps the bookkeeping straight:

- **Defeated combatants are skipped.** They drop out of the turn order automatically.
- **End of a character's turn:** their actions refill and their heroic reactions become available again, ready for the next round of reactions.
- **End of the round:** every monster's actions reset, and any temporary minion groups dissolve.
- **Stepping backwards:** if you go back a turn or a round, the system restores the actions of the monster whose turn you return to.

Heroic reactions can be spent straight from the tracker. When a player uses one outside the normal flow (no actions left, already spent this round, or on their own turn), they get a confirmation prompt instead of a hard stop. The rulebook's edge cases stay at the table, not in a settings menu.

## Solo monsters get extra turns

A **solo monster** doesn't take one turn per round. Instead, it takes a turn after *every character's turn*, automatically. The tracker interleaves these extra turns for you: character, solo monster, character, solo monster, and so on, with any regular monsters and minions acting at the end of the round.

There is nothing to configure. If the actor is a solo monster, it gets the extra turns. See [Monsters, Minions & Solo Monsters](monsters.md) for when to use each actor type.

## Minions and hordes

Rolling eight goblin attacks one at a time is nobody's idea of fun. The **Combat System** panel rolls them all at once:

1. During an active combat, select several minion tokens on the canvas. The panel appears, listing them under **Minions**.
2. Pick each minion's attack from its dropdown (the panel remembers your choice for other minions of the same kind).
3. Target one or more character tokens (use targeting, not selection).
4. Press **Roll**, or **Roll + End Turn** to advance the tracker afterwards.

![The Combat System panel open with several minions selected, actions chosen, and a target picked](/images/documentation/combat-system-minion-hordes.png)

The result is a single chat card: one row per minion showing hit or miss, the total damage at the bottom, and an **Apply Damage** button so the whole horde's damage lands in one click. Minions with no actions left, or with no action selected, are skipped and listed on the card so nothing silently disappears.

Minions that attacked together are grouped into a single tracker entry that shares one turn for the rest of the round; the group dissolves automatically when the round ends, so next round you're free to split them differently. Grouped minions share the same badge on their canvas tokens.

The panel also has a **Monsters** section: select a regular monster or solo monster token and you can pick and roll one of its actions directly from the panel, without opening its sheet.

::: warning GM only
The Combat System panel and group attacks are GM tools. Players won't see the panel.
:::

## Combat mana

Some features, such as the Spellblade's, grant a character mana *per combat* rather than a permanent pool. These are built with the Rules Builder's combat mana rule, and the system handles the full lifecycle:

- When the character rolls initiative, their mana is set to the granted amount.
- The grant is recorded per combat, so re-rolling or rejoining the same fight won't grant it twice.
- When the combat ends or is deleted, the mana is cleared again.

Nothing for you to track: it appears when the fight starts and vanishes when it's over.

## Movement tracking

With the **Movement Tracking** automation toggle on (the default), the system watches every token move, in and out of combat. It uses Foundry's own movement record, so nothing new is stored on your actors:

- Each time a token finishes moving, the system notes how far it went, which spaces it crossed, and whether that was regular movement, a Free Move, or Forced Movement (a push or pull). A Teleport (any teleporting movement action, including a place swap done with one) is never counted as movement, following the rulebooks.
- **Spaces Moved This Turn** is kept for every combatant and resets when that creature's own turn begins. An ally moving you during someone else's turn still counts until your next turn starts. Features can read it in their conditions, for example "if you have not moved this turn".
- Every finished move is reported to features, in and out of combat. The count of spaces moved this turn exists only while a combat is running, because that is when Foundry keeps a movement history.

The system never moves a token for anyone and never stops a drag. It measures what happened and tells the features that care.

## Moves on the ruler

On a character's own turn, dragging its token shows its **Moves** on the ruler. No setting turns this off.

- In the rules, each Move action lets a hero move up to their Speed, and a Move can be broken up with other actions. So the first Speed spaces the character moves in a turn are Move 1, the next Speed spaces Move 2, and so on, and a later drag goes on in the Move where the last one stopped. Difficult terrain counts double. A Free Move, Forced Movement or a Teleport never counts.
- The grid spaces of the second and third Moves have colours of their own, and spaces past the third Move are red.
- The label on the path shows a die for the Move the drop lands in: one pip for the first Move, two for the second and three for the third. These are the dice the character sheet shows for the actions. Past the third Move, a red **!** follows the die.
- The Moves only show the distance. They do not know how many actions the character has left, nothing stops the drag, and no action is spent for you. The table keeps track of actions.

## Forced and Free Movement

With the **Forced and Free Movement** and **Movement Tracking** automation toggles on (the default), a card that pushes or pulls a creature, or gives it a Free Move, also watches that creature's next drag. There is nothing to click. The distance is worked out once, when the feature is used.

The card shows one line that says what the feature does, for example that each target is pushed up to 2 spaces away from the feature's user. Each creature that moves gets a small tag with its distance: on its row under **Targets**, or in a list under that line when the card has no such row, as for a Free Move for the feature's user. Hold the pointer on a tag to read what it means.

The creature's next drag counts as that movement:

- The ruler shows how far the creature can go. Past that distance, the path is drawn the way Foundry draws a path out of reach.
- Nothing stops the drag. Drop further and the token moves the whole way. What the extra spaces mean is for the table to decide.
- The move is recorded as a Free Move or as Forced Movement, so it never draws on the creature's own speed for the turn.

Whoever owns the token still does the moving and picks the path and the final space. The label under the path says which movement the drag uses, for example **Free Move: 2 of 3**. To move the creature with its own movement instead, press **Tab** during the drag, and press it again to switch back; the label shows the key. On a character's own turn, its own movement shows its Moves (see [Moves on the ruler](#moves-on-the-ruler)). A GM with Foundry's **Unconstrained Movement** setting on is placing the token, so the drag is not counted as the push or the Free Move.

A push ignores difficult terrain; a Free Move follows the feature's wording, and the card says when a Free Move ignores it. The card shows the direction the feature names: "away from" or "toward" the feature's user, or "in any direction" for Forced Movement. Nothing enforces it, and the rules give a push no particular shape.

When the creature finishes moving, its tag shows what happened:

- **2/2**: it moved the full distance. A Free Move that stopped early by choice shows the spaces it covered, for example **1/3**.
- **1/3** with a warning sign: a push covered fewer spaces. A creature or the environment can stop a push early, so the card carries the rulebook reminder: 1d6 bludgeoning damage for every space shortened, split between both creatures if it hit one. The table decides whether an obstacle stopped it. A Free Move whose path was blocked shows the same sign, with no damage.
- **Not pushed**, **Not pulled**, **Not moved** or **Not used**: the creature moved a different way first, or the turn ended first. The text on the tag says which.

In the books, every push and every Free Move happens as part of the effect that causes it. So in combat, a move still waiting when the turn ends is not used. Out of combat, it waits until the creature next moves. If a creature waits on two moves, its next drag uses the newest one, and the other card shows that it was not used. Adding a target to the card gives that creature the move too, and removing a target takes back a move it has not made. A feature whose distance comes to zero moves nobody.

The card does not record the saving throw of each target. Under a save result, the tag shows the distance with a die sign and the save that decides it, and the drag is not watched. Move the token by hand when the save calls for it.

This toggle needs Movement Tracking, because only a recorded move can update the card. When either toggle is off, the card shows the distance as text and the token is dragged as usual. Turning either toggle on or off stops the card from watching every waiting move, so no creature keeps a move from the old setting. The tag of that move then shows only the distance, as when a toggle is off.

Some features grant a Free Move without being used, for example when a creature gains dice in a pool, rolls Initiative, starts its turn or is crit. These post a small Movement Offer card of their own, which says why the offer was made. It works the same as the offer on a feature's card: the creature carries it, the drag is labelled, and the card records the result or the lapse. A feature that moves allies too offers one move to each ally in range, and each player moves their own token.

## Features that react to movement

With **Movement Tracking** on, a feature can react when its creature finishes a move, or when another creature finishes a move near it: an enemy that moves next to you, or the enemies you moved toward. The system never uses the feature for you. It posts a card that names the creatures the move found:

- For a feature you use in reply, such as a Reaction, the card has a **Use** button for the feature's owner. It targets the creatures the card names and then uses the feature as normal, so the player can still change the targets or cancel. Nothing is spent until the feature is used.
- For a feature that only changes what happens next, the card is a reminder, for example that your next melee attack against that enemy has advantage. A feature limited to some uses per round or per encounter spends the use when the reminder posts.

A move counts from where it began to where it stopped. A move broken into two drags is two moves, but a feature that needs "at least 4 spaces" counts all the spaces moved this turn unless it says otherwise. Each stop that meets the condition posts a new card; whether the feature applies again is the table's call.

## Token adjacency tracking

Some abilities care about how many enemies are next to a creature. If you enable the **Auto-Track Token Adjacency** setting, the system keeps count for you during active combats: every time a token moves or a turn changes, it records how many enemies are adjacent to each combatant, and which combatant currently has the *most* adjacent enemies.

Feature rules can then use this in their conditions (the Condition box), with tests like "while two or more enemies are adjacent" or "while I have the most enemies adjacent to me", and the features light up and switch off on the sheet as the battlefield shifts.

Details worth knowing:

- "Enemies" is decided by token disposition: hostile tokens count non-hostile tokens as enemies, and vice versa.
- Whether corner-to-corner counts as adjacent follows Foundry's **Grid Diagonals** core setting, so it matches the ruler and every other measurement.
- Adjacency is measured between token footprints, so a Large or bigger creature is adjacent when any of its spaces is.
- The setting is a world setting, applies to the whole table, and requires a reload when changed.
- The tracking data is cleared when the combat is deleted, or when you turn the setting off.

## Related pages

- [Monsters, Minions & Solo Monsters](monsters.md)
- [Settings](settings.md)
- [Conditions](../playing/conditions.md)
- [Dice & Chat](../playing/dice-and-chat.md)
