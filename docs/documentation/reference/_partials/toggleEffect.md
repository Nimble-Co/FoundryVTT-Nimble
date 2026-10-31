**Example: Rage.** A toggle the Berserker switches on, which ends on its own.

- **Label** → `Rage`
- **Identifier** → `rage`
- **Turn off** → **When the creature dies**, **When the creature starts dying**, **When the encounter ends**, **After a rest**
- **Clear pools on end** → `fury`
- **End after inactive rounds** → `1`

**Turn off** takes any of these events:

- **When the creature dies.**
- **When the creature gets a Wound.**
- **When the creature is healed:** its hit points go up, from any source. Temporary hit points do not count, the hit points a level up adds do not count, and healing a character already at max HP heals nothing.
- **When the creature starts dying:** it drops to 0 HP with Wounds to spare.
- **After a rest:** a Field Rest or a Safe Rest.
- **When its turn starts** and **When its turn ends.**
- **When the encounter ends.**
- **When the round ends:** on any change of round, also when the GM goes back a round.

When the toggle turns off, a chat message gives the reason, for example "Rage ended: was healed."
