**Example: Wand of Scorching Rays.** A wand with 3 charges that refills on a safe rest.

- **Label** → `Wand Charges`
- **Scope** → `item`
- **Max charges** → `3`
- **Initial** → `max`
- **Recoveries** → one entry: **Trigger** → `safeRest`, **Mode** → `refresh`

**Hide from sheet** covers the other kind of pool: one that exists to gate a feature rather than to be managed. A feature limited to once per round *and* a few times per rest needs two pools, but only the second is a budget the player spends down. Hiding the round limiter keeps it enforced (it is still tracked, spent, refilled, and it still blocks the feature when empty) while leaving a single charge badge on the card, so the two limits are not read as one larger allowance. Chat cards still report the hidden pool when a use spends it.

**Show as a resource** promotes the pool to the sheet header, next to mana, as well as its badge on the granting item. Use it for a pool the player spends and plans around, like the Shadowmancer's Pilfered Power, and leave it off for one they only glance at when using the feature it belongs to. Hidden wins: a pool hidden from the sheet never reaches the header.

The Label names the pool wherever it is shown. A pool by itself never spends charges automatically; pair it with a Charge Consumer rule (or a Pool effect on the item's activation) to spend charges when the wand is used. **Max charges** takes formulas too: `@key + 1` scales with the character's key stat.
