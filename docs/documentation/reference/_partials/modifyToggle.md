**Example: Enduring Rage.** A feature that makes an earlier toggle switch itself on under a condition.

- **Label** → `Enduring Rage`
- **Toggle identifier** → `rage`
- **Turn on automatically on** → `onTurnStart`
- **Predicate** → `{ "self": "dying" }`

Modify Toggle changes how a Toggle Effect rule behaves, matched by that rule's identifier (or its id when it has no identifier). The toggle stays where it was defined; this rule lets a later feature bend its lifecycle.

**Suppress turn-off on** removes events from the toggle's automatic end list. A capstone that reads "your Rage no longer ends when you drop to 0 HP" is a single entry of `onActorDying` here.

**Turn on automatically on** does the reverse, switching the toggle on when one of these fires:

- `onTurnStart` at the start of the character's turn.
- `onActorDying` when they drop to 0 HP with wounds to spare.
- `onCritReceived` when damage from a critical hit is applied to them.

The rule's own **Predicate** gates the turn-on, which is what makes conditional wording work: with `{ "self": "dying" }` the toggle only switches itself on while the character is Dying, and does nothing on ordinary turns. A chat message announces it so the table can see it happened.

Automatic turn-on restores the toggle's *state* only. It does not run the owning item's activation effects, so a feature whose activation also rolls dice into a pool still needs the player to click it for that part. Say so in the feature's description to avoid surprise.
