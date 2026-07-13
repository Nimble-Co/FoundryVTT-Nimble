**Example: Wand of Scorching Rays.** A wand with 3 charges that refills on a safe rest.

- **Label** → `Wand Charges`
- **Scope** → `item`
- **Max charges** → `3`
- **Initial** → `max`
- **Recoveries** → one entry: **Trigger** → `safeRest`, **Mode** → `refresh`

The Label names the pool wherever it is shown. Pair the pool with a Charge Consumer rule (or the item's activation) to spend charges when the wand is used. **Max charges** takes formulas too: `@key + 1` scales with the character's key stat.
