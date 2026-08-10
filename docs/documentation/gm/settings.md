---
title: "Settings"
---

# Settings

You'll find the system's settings in Foundry under **Game Settings → Configure Settings → Nimble**. This page is a short, opinionated guide to the handful that shape how your table feels. The complete list, with defaults and who each setting affects, lives in the [Settings Reference](../reference/settings.md).

## Automation

How much the system does on its own is controlled from one place: the **Configure Automation** button in the system settings tab (GM only). It opens a window with eight world toggles, all **on** by default, so a fresh world automates everything out of the box. Changes apply immediately; no reload is needed.

- **Apply Conditions and Effects from Rules.** When a feature's rule triggers (say, an attack that frightens on a hit), the condition lands on the target automatically, targets are marked, and timed effects end on their own. When off, conditions still appear as one-click buttons on the chat card. Activating toggle effects and spending pool dice always work regardless of this toggle. See [Conditions](../playing/conditions.md).
- **Derived Conditions.** Conditions implied by other conditions are applied and removed automatically, such as Hampered while Dazed, Grappled, Prone, Slowed, or Restrained.
- **Resource Recovery.** Charges and dice pools refill from their recovery triggers: turn start, rests, wounds, kills, and encounter end.
- **Resource Spending.** Mana is deducted when casting, and charges are validated and consumed on use. When off, casting and item use no longer deduct or check costs, so they must be tracked by hand. One exception: the spell upcast dialog still caps upcasting at the mana currently shown on the sheet.
- **Action Tracking.** Using an item during combat spends the combatant's actions.
- **Health-State Sync.** Bloodied is applied at half hit points and removed on recovery.
- **Combat Convenience.** Player characters roll initiative automatically when combat starts.
- **Chat Notifications.** Informational messages such as initiative bonus reminders, pool gain notices, and toggle effect start and end announcements.

Some behaviors are deliberately not toggleable because removing them would break basic play rather than reduce bookkeeping: Last Stand handling, defeat syncing to the tracker, the dice pool spend prompt, toggle effect activation, combat mana grants, pool syncing, and hit point clamping are always on.

::: info Flipping a toggle mid-combat
Toggles only stop future events. Effects that were already applied linger until removed by hand, and refills skipped while a toggle was off are not replayed when you turn it back on.
:::

Worlds upgrading from an earlier version keep their old choice: the stored value of the legacy Auto-Apply Conditions from Rules setting seeds the initial state of Apply Conditions and Effects from Rules.

## Custom conditions

The **Manage Conditions** button in the system settings tab (GM only) opens an editor for adding conditions the system doesn't ship with — useful when your table is running content that introduces its own statuses. Give each one a name, a description, and an icon from your Foundry files; the id is filled in from the name and is what gets stored on the effect, so keep it stable once anything is using it.

Saved conditions appear alongside the built-in ones in the token status panel, both Conditions tabs, and every rule that picks a condition. The token panel picks up changes right away; sheets that are already open show them after you reopen them. Custom conditions carry no built-in mechanics — see [Conditions](../playing/conditions.md#custom-conditions) for what that means and how to clean one up if you remove it.

## Settings to decide before your first session

**Hide Rolls by Default** is off by default. When on, skill check and weapon roll windows start with the roll hidden from other players, instead of public. Each user sets this for themselves, so turning it on for yourself as GM keeps your monster rolls private without touching the players' rolls.

**Auto-Expand Rolls** is off by default. When on, chat cards show the dice breakdown inline under every roll instead of waiting for a hover. Per-user; players who like seeing the dice can turn it on without cluttering anyone else's chat.

**Auto-Add Character To Combat On Initiative Roll** is off by default. When on, a player rolling initiative from their character sheet is added to the current scene's combat automatically if they're not in it yet. Great for tables where "roll initiative!" is the announcement itself; leave it off if you prefer to build the tracker by hand. World setting.

**Auto-Track Token Adjacency** is off by default, with the companion **Adjacency Includes Diagonals** (on by default). When enabled, the system tracks how many enemies are adjacent to each combatant during fights, so features whose conditions (the Condition box) depend on adjacency work automatically. Leave it off unless your party has such features: it's extra bookkeeping the system only needs when something actually reads it. Both are world settings and require a reload. Details in [Running Combat](combat.md).

::: tip A high-automation table
Want the system to carry as much as possible? Leave every Automation toggle **on** (the default), then turn **on** Auto-Add Character To Combat On Initiative Roll and Auto-Expand Rolls (each player sets this last one themselves). Add Auto-Track Token Adjacency if anyone's features care about flanking-style positioning. Result: conditions land on their own, resources spend and refill themselves, the tracker fills itself, and every roll is fully readable at a glance.
:::

::: tip A keep-it-manual table
Prefer to stay hands-on? Open Configure Automation and turn **off** Apply Conditions and Effects from Rules (conditions become one-click suggestions on chat cards instead), plus any other family you'd rather track yourself, such as Resource Spending or Action Tracking. Leave **off** Auto-Add Character To Combat On Initiative Roll and Auto-Track Token Adjacency. Consider turning **on** Hide Rolls by Default on your own client so GM rolls stay behind the screen. The system still rolls the dice and does the math. It just asks before changing anything.
:::

## The combat tracker has its own settings

The combat tracker at the top of the screen isn't configured from the settings menu. Instead, click the gear button on the tracker itself to open the **Combat Tracker Settings** window. Size, colors, hit point bar display, and what players are allowed to see all live there, and every option is listed in the [Settings Reference](../reference/settings.md).

## Everything else

The remaining settings (the Combat System panel toggle, debug mode, and the rest) are documented in the [Settings Reference](../reference/settings.md), each with its default and whether it affects the whole world or just one user.

## Related pages

- [Settings Reference](../reference/settings.md)
- [Running Combat](combat.md)
- [Conditions](../playing/conditions.md)
