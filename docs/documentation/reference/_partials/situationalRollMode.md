**Example: Haunted Past.** The background grants "Advantage against fear", and only the table knows whether a given WIL save is against fear.

- **Label** → `Against fear`
- **Roll mode value** → `1`
- **Offer on** → `Saving Throw`
- **Apply to saves** → `Will`
- **Icon** → `fa-solid fa-ghost`

Rolling a WIL save now shows an "Against fear" checkbox in the Situational Modifiers panel below the roll mode slider. Leave it unchecked and the save rolls as normal; check it and the slider moves to one stack of advantage, for that roll only. Nothing is written to the character's default WIL roll mode, so the option never leaks into an unrelated save.

The icon is optional: leave it blank and the option shows the system's advantage or disadvantage icon, matching the sign of the roll mode value. Set it to any Font Awesome class pair (`fa-solid fa-ghost`, `fa-solid fa-snowflake`) to name the situation at a glance.

Use this rule whenever a feature's condition is something the system cannot see: what a save is against, what a skill check is being used for, who the target is out of fiction. For conditions the system does know about (bloodied, unarmored, a charge pool being empty, a toggle being on), put them in the rule's predicate instead and the option is only offered when they hold. The two compose: a predicate-gated rule that is also situational is offered only when the predicate passes, and still only applies when checked.

Reach for **Skill Roll Mode**, **Save Roll Mode**, or **Initiative Roll Mode** instead when the advantage is unconditional, since those adjust the character's default roll mode and need no per-roll click. For attack rolls, use **Conditional Bonus**, which offers its choice in the item activation dialog.
