**Example: Skullringer Maul.** A heavy maul that dazes whoever it critically hits.

- **Label** → `Skullringer: daze on crit`
- **Condition** → `dazed`
- **Trigger** → `onCrit`
- **duration → rounds** → `1`

The condition lands on the attack's target when the crit is confirmed. Self-directed triggers like `onTurnStart` or `onRest` apply the condition to the character carrying the item instead.

A duration counts down like the duration of any Foundry effect, and when it ends the condition is removed. In combat, it ends at the start of the turn that was active when the condition landed, once the rounds or turns have passed. Here the maul's wielder crits on their own turn, so Dazed is removed from the target when the wielder's next turn starts, and Hampered goes with it if nothing else still causes it. Out of combat, a rounds or turns duration ends the next time game time moves forward, and a seconds duration ends when game time moves past it.
