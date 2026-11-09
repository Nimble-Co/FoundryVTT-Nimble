**Example: Wand of Scorching Rays.** A wand with 3 charges that refills on a safe rest.

- **Label** → `Wand Charges`
- **Scope** → `item`
- **Max charges** → `3`
- **Initial** → `max`
- **Recoveries** → one entry: **Trigger** → Safe Rest, **Mode** → Refill to max

**Example: Optimistic.** One use that comes back when the gnome is healed to max HP, and on a Safe Rest.

- **Label** → `Optimistic (1/healed to max HP)`
- **Max charges** → `1`
- **Recoveries** → two entries: **Trigger** → Healed, **Mode** → Refill to max, **Only while** → `{ "self": "fullHp" }`; and **Trigger** → Safe Rest, **Mode** → Refill to max

A **Healed** recovery applies each time the character's hit points go up, from any source. Temporary hit points do not count, the hit points a level up adds do not count, and healing a character already at max HP heals nothing. **Only while** is checked when the trigger happens, so `self` **is** `fullHp` makes the entry apply only when the healing brings the character to max HP.

**Temporary uses** on an Add recovery make the uses it adds last for the encounter only, as the Songweaver's Quick Wit does with Songweaver's Inspiration (a Modify Pool **Additional refills** entry has the same box). They are spent first and go away when the encounter ends. When the pool shows as a meter in the rail of the sheet, the meter names them, for example **+2 temporary**. An Initiative Rolled recovery applies one time for each combat, also when Initiative is rolled again.

**Hide from sheet** covers the other kind of pool: one that exists to gate a feature rather than to be managed. A feature limited to once per round *and* a few times per rest needs two pools, but only the second is a budget the player spends down. Hiding the round limiter keeps it enforced (it is still tracked, spent, refilled, and it still blocks the feature when empty) while the item's row on the sheet shows the uses of only the other pool, so the two limits are not read as one larger allowance. Chat cards still report the hidden pool when a use spends it.

**Show as a resource** also shows the pool as a meter on the character sheet, with the other meters, as well as the uses on the row of the granting item. Use it for a pool the player spends and plans around, like the Shadowmancer's Pilfered Power, and leave it off for one they only glance at when using the feature it belongs to. Hidden wins: a pool hidden from the sheet never gets a meter. The meter names the pool by its label. When the rail is too narrow for a long label, such as one that ends in `(2×WIL/Safe Rest)`, the name is cut: point to it to read the full label.

The Label names the pool wherever it is shown. A pool by itself never spends charges automatically; pair it with a Charge Consumer rule (or a Pool effect on the item's activation) to spend charges when the wand is used. **Max charges** takes formulas too: `@key + 1` scales with the character's key stat.
