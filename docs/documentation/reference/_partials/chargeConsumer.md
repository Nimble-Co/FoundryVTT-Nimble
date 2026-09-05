**Example: Wand of Scorching Rays.** Spend one of the wand's charges every time it is used.

- **Pool** → `wand-charges`
- **Pool scope** → `item`
- **Cost mode** → `fixed`
- **Cost** → `1`

The consumer sits on the item that spends the charges, which need not be the item that declares the pool: point it at the identifier of a Charge Pool rule anywhere on the actor and it spends from there. A use with too few charges left is blocked, and the chat card reports what the use cost.

**Example: a pool you spend any amount of.** Set **Cost mode** to `variable` and the activation asks how much to spend instead of taking a fixed amount. **Cost** becomes the smallest legal spend and **Maximum cost** the largest, with a blank maximum meaning whatever the pool has left. The amount the player picks is available to the item's own damage and healing formulas as `@spent`, so a healing effect of `@spent` restores exactly what was spent. This is how Lay on Hands works: a pool of `5 * @level` that refills on a safe rest, and a variable consumer that heals what it spends.

Because the amount is player input, an item with a variable consumer always opens its roll window, whatever its skip setting says.

One variable consumer per pool, per item. The activation asks for one amount per pool, so a second variable consumer pointing at the same pool has no amount of its own: the system refuses to use the item rather than guess which spend you meant. Give each one its own pool, or make all but one a fixed cost.
