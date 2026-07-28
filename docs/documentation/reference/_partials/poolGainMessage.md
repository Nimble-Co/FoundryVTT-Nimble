**Example: Swift Fury.** A reminder that fires whenever the character gains Fury Dice.

- **Label** → `Swift Fury`
- **Pool identifier** → `fury`
- **Formula** → `@dexterity`
- **Message** → `Swift Fury: move up to {value} spaces for free, ignoring difficult terrain.`

This posts a chat message whenever the named dice pool *gains* dice, whatever caused it: an activation that rolls a die in, a refill trigger, or a manual edit on the sheet. Losing dice does not fire it.

**Formula** is resolved against the character, and `{value}` in the **Message** is replaced with the result, so the reminder carries the actual number rather than making the player work it out. Leave the formula blank if the message has nothing to calculate.

Use this for features whose effect the system cannot carry out on its own, where the useful automation is telling the player it applies and how much. Moving a token is the usual case. The rule's **Predicate** gates it normally, and the message is posted once, by the client whose action changed the pool.
