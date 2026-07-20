**Example: Skullringer Maul.** A heavy maul that dazes whoever it critically hits.

- **Label** → `Skullringer: daze on crit`
- **Condition** → `dazed`
- **Trigger** → `onCrit`
- **duration → rounds** → `1`

The condition lands on the attack's target when the crit is confirmed. Self-directed triggers like `onTurnStart` or `onRest` apply the condition to the character carrying the item instead.
