**Example: Intensifying Fury.** A level-up feature that upgrades the Berserker's existing Fury Dice.

- **Label** → `Fury Dice to d6`
- **Pool type** → `dice`
- **Pool identifier** → `fury`
- **Die size override** → `d6`
- **Predicate** → `{ "level": { "min": 6 } }`

Modify Pool changes a pool that some *other* feature created, matched by its identifier. This is how progression works without editing the original feature: the level 1 item defines the pool, and each later item carries a modifier that upgrades it. Put one modifier per breakpoint on the same feature, each with its own level predicate, and give the later ones a higher **Priority** so they win.

The fields are all optional; leave blank the ones you are not changing.

- **Die size override** replaces the pool's die (`d4` to `d6` and so on). Dice already sitting in the pool keep the number they rolled.
- **Max delta** is a signed formula added to the maximum: `+1`, `-1`, `+@level`.
- **Minimum face** raises any die rolled into the pool that comes up below it. A value of `6` on a d12 pool means every new die is at least a 6. It applies to refills, activation rolls, and the initial fill, but not to a value typed in by hand on the sheet. When several modifiers set one, the highest wins.
- **Additional refills** contributes refill entries to the target pool, in the same shape the pool's own refills use. This lets the feature that grants a new trigger carry it, instead of the original pool rule having to know about every later feature.

The rule's own **Predicate** gates whether the modifier applies at all, so it is the right place for level gates. A condition that flips during play (like being Raging) belongs on the refill entry's own **Condition** instead, because that is checked when the trigger fires rather than when the pool is built.
