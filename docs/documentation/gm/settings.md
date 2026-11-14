---
title: "Settings"
---

# Settings

You'll find the system's settings in Foundry under **Game Settings → Configure Settings → Nimble**. This page is a short, opinionated guide to the handful that shape how your table feels. The complete list, with defaults and who each setting affects, lives in the [Settings Reference](../reference/settings.md).

## Automation

How much the system does on its own is controlled from one place: the **Configure Automation** button in the system settings tab (GM only). It opens a window with ten world toggles in five groups, all **on** by default, so a fresh world automates everything out of the box. Changes apply immediately; no reload is needed.

**Features and Effects**

- **Feature Effects.** When a feature's rule triggers (say, an attack that frightens on a hit), the condition lands on the target automatically, targets are marked, and rerolls happen. Casting a Concentration spell starts Concentration. An effect that an item gives to its user goes on when the item is used, and features that use an item for free do so. Held Changes go on the next roll by themselves. Effects end by themselves at their Lasts Until, when an Escape succeeds, and when a save to keep them fails. When off, the chat card shows a button for each one instead, such as **Apply to You** or **End**, the roll window shows each Held Change as a tick box, and nothing is used for free. Using an item and spending pool dice always work regardless of this toggle. See [Conditions](../playing/conditions.md#when-an-effect-ends).
- **Linked Conditions.** A condition adds and removes the conditions that come with it, such as Hampered while Dazed, Grappled, Prone, Slowed, or Restrained.

::: details More about Feature Effects off
- An effect stays on until someone clicks **End** on its line or removes it.
- Only a Held Change you tick goes on the roll, and only a ticked one is used up. A roll with no window (Alt-click) uses none. See [Hold a change for the next attack](../homebrew/effects.md#hold-a-change-for-the-next-attack).
- An Empty Pools at End rule does not empty its pools when its effect ends. The card of the end gets an **Empty** button for each pool that holds dice.
- After the save of a Save for Max Crit Dice rule, the save card gets an **Apply** button. It sets the dice to their max after a failed save, or gives the use back after a passed one.
:::

**Resources**

- **Refills.** Charges and dice pools refill at their set times: turn starts, rests, wounds, kills, and encounter end.
- **Costs.** Spells, items and rerolls spend their mana and charges, and stop when there is not enough. Charges that an attack refills on a hit or a crit count as costs too, so they follow this toggle and not **Refills**. When off, nothing is spent or checked except heroic reactions, which are spent as always, so track the other costs by hand. The spell upcast dialog follows the same rule: with the toggle off it lets you upcast to your highest unlocked tier regardless of the mana on your sheet.

**Combat**

- **Action Spending.** Using an item during combat marks the combatant's actions as spent.
- **Bloodied Status.** Bloodied is applied at half hit points or less and removed when the creature is healed above half.
- **Initiative for Heroes.** Player characters roll initiative automatically when combat starts.

**Movement**

- **Movement Count.** The system reports each finished token move to features and, during combat, counts the spaces moved this turn, so features can react, in a started combat, when a creature finishes moving or moves adjacent to someone. It never moves a token and never blocks a drag. When off, the system counts nothing, and features that react to movement or let a creature move for free on their own post nothing. Foundry still keeps its own movement history. See [Running Combat](combat.md#movement-tracking) and [Features that react to movement](combat.md#features-that-react-to-movement).
- **Pushes, Pulls and Moves for Free.** This toggle sits under Movement Count, and the window disables it while Movement Count is off. When a card pushes or pulls a creature, or lets it move for free, the creature's next drag counts as that move: it never draws on the creature's own speed, and the ruler shows how far it can go. Nothing stops a longer drag, there is nothing to click, and the player still picks the path and the final space. It needs Movement Count, because only a recorded move can update the card. When either toggle is off, the card shows the distance as text, the token is dragged as usual, and a feature that lets a creature move for free on its own, for example when a creature gains dice in a pool, posts no card. Turning either toggle on or off stops the card from watching every waiting move, and its tag then shows only the distance. See [Running Combat](combat.md#forced-movement-and-moves-for-free).

**Chat**

- **Chat Notes.** Short notes in chat, such as initiative bonus reminders and pool gain notices.

Some behaviors are deliberately not toggleable because removing them would break basic play rather than reduce bookkeeping: Last Stand handling, defeat syncing to the tracker, the dice pool spend prompt, combat mana grants, pool syncing, and hit point clamping are always on. The Moves on the ruler are always on too, because they only show distance. See [Running Combat](combat.md#moves-on-the-ruler).

::: info Flipping a toggle mid-combat
Toggles only stop future events. Effects that were already applied linger until removed by hand, and refills skipped while a toggle was off are not replayed when you turn it back on.
:::

Worlds upgrading from an earlier version keep their old choice: the stored value of the legacy Auto-Apply Conditions from Rules setting seeds the initial state of Feature Effects.

## Custom conditions

The **Manage Conditions** button in the system settings tab (GM only) opens an editor where you add conditions that the system does not have. Use it for content that brings its own statuses. Give each condition a name, a description, and an icon from your Foundry files. The **Negative** box is on at first, and while it is on, an End Conditions step can end the condition. The id fills in from the name, and you can type your own before the first save. After that the id is locked, because every effect and rule that uses the condition stores it. Descriptions are plain text, and a blank line starts a new paragraph.

Saved conditions appear with the built-in ones in the token status panel, the Effects tab of both sheets, and every rule that picks a condition. The token panel and any open conditions list show changes at once. Sheets and rule dropdowns that are already open show them after you reopen them. When you remove a condition that is still in use, a confirmation lists the creatures that have it and the items that name it, so you can remove it from them in the same step. Custom conditions have no built-in mechanics. See [Conditions](../playing/conditions.md#custom-conditions) for what that means.

## Settings to decide before your first session

**Hide Rolls by Default** is off by default. When on, skill check and weapon roll windows start with the roll hidden from other players, instead of public. Each user sets this for themselves, so turning it on for yourself as GM keeps your monster rolls private without touching the players' rolls.

**Auto-Expand Rolls** is off by default. When on, chat cards show the dice breakdown inline under every roll instead of waiting for a hover. Per-user; players who like seeing the dice can turn it on without cluttering anyone else's chat.

**Auto-Add Character To Combat On Initiative Roll** is off by default. When on, a player rolling initiative from their character sheet is added to the current scene's combat automatically if they're not in it yet. Great for tables where "roll initiative!" is the announcement itself; leave it off if you prefer to build the tracker by hand. World setting.

**Auto-Track Token Adjacency** is off by default. When enabled, the system tracks how many enemies are adjacent to each combatant during fights, so features whose conditions (the Condition box) depend on adjacency work automatically. Leave it off unless your party has such features: it's extra bookkeeping the system only needs when something actually reads it. World setting, requires a reload. Details in [Running Combat](combat.md).

Whether a diagonal counts as adjacent is Foundry's own **Grid Diagonals** setting (under Core Settings). The rulebook offers three table options and each has a matching choice there: *Equidistant* means diagonals are adjacent (the default), *Rectilinear* means they are not, and either *Alternating* choice counts every other diagonal. *Rectilinear* counts every diagonal step as 2 spaces, so a diagonal neighbour is 2 spaces away and tokens can still move diagonally. *Illegal* measures the same distances, but tokens cannot move diagonally at all. With *Alternating (1/2/1)* the first diagonal costs 1 space, so a diagonal neighbour is 1 space away and is adjacent. With *Alternating (2/1/2)* the first diagonal costs 2 spaces, so a diagonal neighbour is 2 spaces away and is not adjacent. Along a path the cost alternates, so four diagonal steps count 6 spaces with either choice. Foundry also lists *Exact* and *Approximate*, which the rulebook does not describe. They give a fractional distance, and the system rounds it to the nearest whole space (a half rounds up), so with *Approximate* a diagonal neighbour is 2 spaces away. The system reads the setting everywhere it measures spaces, for example adjacency, Interpose range and the spaces a token moves.

When Grid Diagonals is *Illegal*, *Exact* or *Approximate*, the GM sees a popup when the world loads and when the setting changes. It explains what the value does to ranges and offers *Equidistant* (and *Rectilinear*, for *Illegal*). **Keep** hides the popup until the value changes again. Players never see it. A world that had the old Nimble setting "Adjacency Includes Diagonals" turned off moves to *Rectilinear*.

::: tip A high-automation table
Want the system to carry as much as possible? Leave every Automation toggle **on** (the default), then turn **on** Auto-Add Character To Combat On Initiative Roll and Auto-Expand Rolls (each player sets this last one themselves). Add Auto-Track Token Adjacency if anyone's features care about flanking-style positioning. Result: conditions land on their own, resources spend and refill themselves, the tracker fills itself, and every roll is fully readable at a glance.
:::

::: tip A keep-it-manual table
Prefer to stay hands-on? Open Configure Automation and turn **off** Feature Effects (conditions become one-click suggestions on chat cards instead), plus any other toggle you'd rather track yourself, such as Costs or Action Spending. Leave **off** Auto-Add Character To Combat On Initiative Roll and Auto-Track Token Adjacency. Consider turning **on** Hide Rolls by Default on your own client so GM rolls stay behind the screen. The system still rolls the dice and does the math. It just asks before changing anything.
:::

**Show Chaos Table rolls** is for a hero with Force of Chaos. It is off by default, because the book keeps the table secret: the player sees only the number, and you get the text in a whisper. Turn it on to show the text to all.

## 3D dice

If your table uses the **Dice So Nice** module, the **Configure 3D Dice** button in the system settings tab opens a window where each player chooses how the primary die of their damage rolls looks. The primary die is drawn in its own colors so it reads apart from the rest of the pool, and the colors travel with the roll: everyone at the table sees the roller's choice, not their own.

- **Distinct Primary Die** is on by default. Turn it off to have the primary die use your normal Dice So Nice theme.
- **Primary Die Color** and **Primary Die Number Color** set the body and the numerals. **Reset Colors** puts both back to the crimson and gold defaults.

All three are per-user, so every player sets their own. Without Dice So Nice installed and enabled, the button is greyed out: these settings only change 3D dice, and there is nothing for them to affect.

## The combat tracker has its own settings

The combat tracker at the top of the screen isn't configured from the settings menu. Instead, click the gear button on the tracker itself to open the **Combat Tracker Settings** window. Size, colors, hit point bar display, and what players are allowed to see all live there, and every option is listed in the [Settings Reference](../reference/settings.md).

## Everything else

The remaining settings (the Combat System panel toggle, debug mode, and the rest) are documented in the [Settings Reference](../reference/settings.md), each with its default and whether it affects the whole world or just one user.

## Related pages

- [Settings Reference](../reference/settings.md)
- [Running Combat](combat.md)
- [Conditions](../playing/conditions.md)
