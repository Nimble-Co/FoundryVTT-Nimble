**Example: Unfailing Courage.** A Songweaver feature that gives Songweaver's Inspiration advantage.

- **Label** → `Unfailing Courage: the reroll has advantage`
- **Reroll identifier** → `songweavers-inspiration`
- **Advantage or disadvantage** → `Advantage`

**Example: Inspiring Presence.** Each use gives WIL temp HP to the one who rolled and their allies within 12 spaces.

- **Reroll identifier** → `songweavers-inspiration`
- **Temp HP for the one who rolled and allies** → `@will`
- **Reach** → `12`

Modify Reroll adds to a Reroll rule on the same character, found by that rule's identifier. Give the Reroll rule an identifier in the raw JSON view first. The Reroll rule does not change; this rule lets a later feature add to it.

**Changes to the new roll** count one time per attack or check, however many times the reroll is used. **Advantage or disadvantage** applies to the new roll; for a reroll of one die, that die is rolled two times. **Extra damage** is for attacks only: it is added to the attack's damage, named by this feature, when the result stands, also when a player keeps the old result. Values such as `@will` come from this character.

What creatures gain comes with each use, when the reroll is used. **Actions for the one who rolled** go only to a hero in combat. **Temp HP** goes to the one who rolled and their allies within **Reach** of this character's token (0 is any distance), not to this character. A creature with as much temp HP or more keeps its own. With no token for this character, nobody gains temp HP. With **Feature Effects** off, the card shows what to give by hand.
