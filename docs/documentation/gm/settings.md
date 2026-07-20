---
title: "Settings"
---

# Settings

You'll find the system's settings in Foundry under **Game Settings → Configure Settings → Nimble**. This page is a short, opinionated guide to the handful that shape how your table feels. The complete list, with defaults and who each setting affects, lives in the [Settings Reference](../reference/settings.md).

## Settings to decide before your first session

**Auto-Apply Conditions from Rules** is off by default. When a feature's rule triggers (say, an attack that frightens on a hit), this setting decides whether the condition is applied to the target automatically or merely offered on the chat card for you to apply with a click. Off keeps you in the loop; on removes a click from every trigger. World setting; changing it requires a reload. See [Conditions](../playing/conditions.md).

**Hide Rolls by Default** is off by default. When on, skill check and weapon roll windows start with the roll hidden from other players, instead of public. Each user sets this for themselves, so turning it on for yourself as GM keeps your monster rolls private without touching the players' rolls.

**Auto-Expand Rolls** is off by default. When on, chat cards show the dice breakdown inline under every roll instead of waiting for a hover. Per-user; players who like seeing the dice can turn it on without cluttering anyone else's chat.

**Auto-Add Character To Combat On Initiative Roll** is off by default. When on, a player rolling initiative from their character sheet is added to the current scene's combat automatically if they're not in it yet. Great for tables where "roll initiative!" is the announcement itself; leave it off if you prefer to build the tracker by hand. World setting.

**Auto-Track Token Adjacency** is off by default, with the companion **Adjacency Includes Diagonals** (on by default). When enabled, the system tracks how many enemies are adjacent to each combatant during fights, so features whose conditions (the Condition box) depend on adjacency work automatically. Leave it off unless your party has such features: it's extra bookkeeping the system only needs when something actually reads it. Both are world settings and require a reload. Details in [Running Combat](combat.md).

::: tip A high-automation table
Want the system to carry as much as possible? Turn **on**: Auto-Apply Conditions from Rules, Auto-Add Character To Combat On Initiative Roll, and Auto-Expand Rolls (each player sets this last one themselves). Add Auto-Track Token Adjacency if anyone's features care about flanking-style positioning. Result: conditions land on their own, the tracker fills itself, and every roll is fully readable at a glance.
:::

::: tip A keep-it-manual table
Prefer to stay hands-on? Leave **off**: Auto-Apply Conditions from Rules (conditions become one-click suggestions on chat cards instead), Auto-Add Character To Combat On Initiative Roll, and Auto-Track Token Adjacency. Consider turning **on** Hide Rolls by Default on your own client so GM rolls stay behind the screen. The system still rolls the dice and does the math. It just asks before changing anything.
:::

## The combat tracker has its own settings

The combat tracker at the top of the screen isn't configured from the settings menu. Instead, click the gear button on the tracker itself to open the **Combat Tracker Settings** window. Size, colors, hit point bar display, and what players are allowed to see all live there, and every option is listed in the [Settings Reference](../reference/settings.md).

## Everything else

The remaining settings (the Combat System panel toggle, debug mode, and the rest) are documented in the [Settings Reference](../reference/settings.md), each with its default and whether it affects the whole world or just one user.

## Related pages

- [Settings Reference](../reference/settings.md)
- [Running Combat](combat.md)
- [Conditions](../playing/conditions.md)
