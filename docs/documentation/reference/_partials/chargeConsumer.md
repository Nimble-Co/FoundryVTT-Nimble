**Example: Wand of Scorching Rays.** Spend one of the wand's charges every time it is used.

- **Pool** → `wand-charges`
- **Pool scope** → `item`
- **Cost mode** → `fixed`
- **Cost** → `1`

The consumer goes on the item that spends the charges. It does not have to be the item that holds the pool: point **Pool** at any Charge Pool rule on the character. If too few charges are left, the item cannot be used. The chat card reports what the use cost.

**Example: a pool you spend any amount of.** Set **Cost mode** to `variable` and the item asks the player how many charges to spend. **Cost** is the smallest amount they can pick, **Maximum cost** the largest. Leave **Maximum cost** blank to let them spend whatever the pool has.

The item's own damage and healing formulas read that amount as `@spent`, so a healing effect of `@spent` heals what was spent. Lay on Hands works this way: a pool of `5 * @level` that refills on a safe rest, and a variable consumer that heals what it spends.

An item with a variable consumer always opens its roll window, even when it is set to skip it.

An item can have a fixed cost and a variable one on the same pool. The fixed cost comes out first and the player picks from what is left, so a pool of 10 with a fixed cost of 3 offers up to 7. If the pool cannot cover both, the item cannot be used.

A variable consumer will not work in these cases. The item cannot be used, and the message names the pool.

- **Two variable consumers on one pool.** The item asks once per pool, so the second has no answer of its own. Give it another pool, or make it a fixed cost.
- **Maximum cost below Cost.** Nothing is left to pick.
- **A hidden pool.** It has no control on the sheet, so there is nowhere to enter an amount.
- **A variable consumer on a spell.** Casting opens the upcast window, which asks for a tier. Put it on a feature or an item instead.
