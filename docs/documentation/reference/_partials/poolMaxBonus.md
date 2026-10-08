**Example: +1 Max Combat Die.** The Commander's Fit for Any Battlefield offers, at several levels, either another Combat Ability or one more maximum Combat Die. The die is granted as an item carrying this rule.

- **Pool identifier** → `combat-dice`
- **Amount** → `1`

The bonus lives on the item, so a Commander who takes the option three times holds three items and has three more maximum Combat Dice. Removing one item removes exactly its share.

This is why the bonus is an item rather than a number on the character: it makes the pick behave like every other granted item. The level-up dialog grants it through the same path as any other option, levelling down removes it with the level that granted it, and the option swap and the level choices audit count it by holding it.

The die is part of the same option pool as the Combat Abilities it is offered beside, so **Option Swap** can trade a held die for an ability, or an ability for a die. Each die item on the sheet is its own pick: a Commander who holds two of them sees one die card marked **x2**, and can give up one while keeping the other. Because the die's grant rule allows duplicates, the swap keeps offering it while a copy is held, so a Commander with one die can trade an ability for a second. Trading one die away removes one item and one point of the bonus.

The pool identifier must match the `identifier` of a **Charge Pool** rule somewhere on the character. A bonus naming a pool that does not exist does nothing. To change a pool's die size or its current value rather than its maximum, use **Modify Pool**.
