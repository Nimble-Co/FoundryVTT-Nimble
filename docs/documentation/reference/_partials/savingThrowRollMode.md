**Example: Celestial.** An ancestry that cancels whichever save its owner's class leaves disadvantaged.

- **Label** → `Celestial`
- **Roll mode value** → `0`
- **Target save** → `disadvantaged`
- **How to apply** → `set`

**Target save** accepts a save key (`strength`, `dexterity`, `intelligence`, `will`) or one of the categories `all`, `advantaged`, `disadvantaged` and `neutral`. The three category names are evaluated against the roll modes computed so far, so rule priority decides what they match.

This rule changes the character's stored default roll mode, which is what the saving throw config's **Reset to Class Defaults** button writes. For an advantage that only applies in a circumstance the system cannot detect — "against poison", "against fear" — use `situationalRollMode` instead, which the roller opts into per roll and which never touches the stored default.
