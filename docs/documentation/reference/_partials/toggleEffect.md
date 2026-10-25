**Example: Rage.** A toggle the Berserker switches on, which ends on its own.

- **Label** → `Rage`
- **Identifier** → `rage`
- **Turn off on** → `onActorKilled`, `onActorDying`, `onEncounterEnd`, `onRest`
- **Clear pools on end** → `fury`
- **End after inactive rounds** → `1`

**Turn off on** takes any of these events:

- `onActorKilled` when the character dies.
- `onActorWounded` when they gain a Wound.
- `onActorHealed` when their hit points go up, from any source. Temporary hit points do not count, and healing a character already at max HP heals nothing.
- `onActorDying` when they drop to 0 HP with Wounds to spare.
- `onRest` when they finish a Field Rest or a Safe Rest.
- `onTurnStart` and `onTurnEnd` at the start or the end of their turn.
- `onEncounterEnd` when combat ends.

When the toggle turns off, a chat message gives the reason, for example "Rage ended: was healed."
