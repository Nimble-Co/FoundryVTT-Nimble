**Example: +1 Max Combat Die.** The Commander's Fit for Any Battlefield offers, at several levels, either another Combat Ability or one more maximum Combat Die. The die is granted as an item carrying this rule.

- **Pool identifier** → `combat-dice`
- **Amount** → `1`

The bonus lives on the item, so a Commander who takes the option three times holds three items and has three more maximum Combat Dice. Removing one item removes exactly its share.

This is why the bonus is an item rather than a number on the character: it makes the pick behave like every other granted item. It is recorded against the level that granted it, so levelling down removes it cleanly, and the level-up dialog grants it through the same path as any other option.

The die is part of the same option pool as the Combat Abilities it is offered beside, so **Option Swap** can trade a held die for an ability, or an ability for a die. The limit is that the pool sees the die as one pick. While you hold a copy, it shows as selected and cannot be taken a second time. Only when no copy is held can a swap take the die back.

The pool identifier must match the `identifier` of a **Charge Pool** rule somewhere on the character. A bonus naming a pool that does not exist does nothing. To change a pool's die size or its current value rather than its maximum, use **Modify Pool**.
