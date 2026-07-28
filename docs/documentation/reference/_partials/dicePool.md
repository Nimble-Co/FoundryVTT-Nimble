**Example: Fury Dice.** The pool a Berserker builds up while Raging.

- **Label** → `Fury Dice`
- **Scope** → `item`
- **Die size** → `d4`
- **Max dice** → `@key`
- **Initial** → `zero`
- **Refills** → one entry: **Trigger** → `onTurnStart`, **Mode** → `add`, **Value** → `1`, **Condition** → `{ "self": "raging" }`

A dice pool holds rolled die faces, not a count: each die keeps the number it came up with, and features read those numbers. **Max dice** takes formulas, so `@key` grows the pool as the character's key stat does.

**Initial** decides what the pool looks like the moment the feature is granted: `max` pre-rolls a full pool, `zero` starts it empty and waits for a refill or an activation to put dice in.

Each **Refill** entry says when dice come back and how many:

- **Mode** `add` rolls new dice up to the maximum, `set` rebuilds the pool to exactly that many, `refresh` tops it up to full, `setIfEmpty` only acts when the pool is empty, and `clear` empties it.
- **Value** accepts formulas plus two pool-specific references: `@poolMax` and `@poolCurrent`.
- **Condition** is optional and is checked at the moment the trigger fires, so state that changes mid-combat works correctly. `{ "self": "raging" }` on an `onTurnStart` refill means the die only arrives on turns where the character is actually Raging.

Not every trigger in the list is wired up yet. The ones that fire today are `onTurnStart`, `onTurnEnd`, `onAttacked`, `onCritReceived`, and `encounterEnd`. The others are accepted but never fire, so avoid building a feature that depends on them.

A pool by itself is only storage; it never spends or grants anything. Pair it with a **Dice Consumer** rule to spend from it or add its faces to attacks, and use **Modify Pool** on a later feature to grow the die size, raise the maximum, or add more refill triggers.
