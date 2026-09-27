**Example: Battle Trance (homebrew).** A feature that reads "Whenever you gain Fury Dice, your next melee attack deals extra damage equal to your STR."

- **Label** → `Battle Trance`
- **Pool identifier** → `fury`
- **Formula** → `@strength`
- **Message** → `Battle Trance: your next melee attack deals +{value} damage.`

This posts a chat message whenever the named dice pool *gains* dice, whatever caused it: an activation that rolls a die in, a refill trigger, or a manual edit on the sheet. Losing dice does not fire it, and neither do spent dice that go back to the pool, for example after a reroll removes the crit they were spent on.

**Formula** is resolved against the character, and `{value}` in the **Message** is replaced with the result, so the reminder carries the actual number rather than making the player work it out. Leave the formula blank if the message has nothing to calculate.

Use this for features whose effect the system cannot carry out on its own, where the useful automation is telling the player it applies and how much. A feature that grants a Free Move when a pool gains dice, such as Swift Fury, uses the Free Move rule instead: it offers the move on a card, and the token carries the offer. The rule's **Predicate** gates it normally, and the message is posted once, by the client whose action changed the pool.
