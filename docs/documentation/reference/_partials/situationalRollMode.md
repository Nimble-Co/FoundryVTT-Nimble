**Example: Haunted Past.** The background gives "Advantage against fear". Only the table knows if a WIL save is against fear.

- **Label** → `Against fear`
- **Roll mode value** → `1`
- **Offer on** → `Saving Throw`
- **Apply to saves** → `Will`

The WIL save window now shows an "Against fear" checkbox in the **Situational Modifiers** panel, below the roll mode slider. Unchecked, the save rolls as normal. Checked, the slider moves to advantage for that roll only. The character's default WIL roll mode does not change, so the option never affects another save.

The option's icon is the image of the item that gives it, so there is nothing to set. Haunted Past's background image shows beside the checkbox.

Use this rule when the feature depends on something the system cannot see: what a save is against, what a skill check is for, or who the target is in the story. A condition the system knows, such as bloodied, unarmored, an empty charge pool or a toggle that is on, goes in the rule's Condition box instead. The option then shows only when the condition is true. A rule can use both. It then shows only when the Condition box matches, and applies only when checked. The system also knows the tags of the roll itself, such as `save:keep:concentration` on a save that keeps Concentration. An option with such a condition starts checked. See [The Condition Box](../rules-builder/predicates.md).

On an effect with [Stacks](../homebrew/lasts-until.md#stacks) on, turn on **For each stack** to give the value once for each stack: a value of `-1` with 3 stacks is three levels of disadvantage.

Use **Skill Roll Mode**, **Save Roll Mode** or **Initiative Roll Mode** instead when the advantage always applies. Those rules change the character's default roll mode and need no click on each roll. For attack rolls, use **Conditional Bonus**, which offers its choice in the item activation dialog.
