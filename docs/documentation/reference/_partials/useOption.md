**Example: Stretch Time.** When you cast a tiered spell, spend 2 more mana to cast it with 1 less action, to a minimum of 1. One Spellshaper ability each turn.

- **Applies to** → `Spells`
- **Tiered spells only** → on
- **Resource** → `Mana`
- **Spend mode** → `Fixed`
- **Amount** → `2`
- **Use limit** → `spellshaper`
- **Action cost change** → `-1`
- **Action cost minimum** → `1`

The rule goes on the feature that gives the option. The option shows in the cast window of each spell that it applies to, and only for a creature that has the feature. Nothing is chosen at first.

Options that name the same **Use limit** share one dropdown, named after the Charge Pool, such as **Spellshaper (1/turn)**. It lists **None** and each option with its cost, such as **Stretch Time (2 mana)**. The player picks one option, or none. For a limit of one use each turn, give the pool 1 charge that refills at the start of each turn. When the pool is empty, the dropdown is off and says **Used this turn**. An option with no limit has a dropdown of its own.

The spell mana and the option's cost are checked together when the player casts, and are spent in the same step. When the creature does not have enough for both, the cast stops and nothing is spent. The tier buttons show which tiers the option leaves short of mana. The roll window says the full cost, such as "When you roll, it spends 1 action and 3 Mana."

Mana spent on an option is not mana spent on the spell. It does not raise the tier of the cast, and rules that read the mana spent on a spell do not count it. The card shows the option's cost, such as **Cost: 2 mana (Stretch Time)**.

An option can also change the cast:

- **Range for each mana** adds range for each mana the option spends. The amount stepper says the range, such as **Mana (+8 range)**, and the card shows the new range.
- **Note on the card** puts a line on the card under the cost, such as "The spell ignores line of sight." `{amount}` puts in the amount spent, so `{amount} creatures unaffected` shows "3 creatures unaffected".
- **Damage type pick** shows the listed damage types as buttons under the dropdown. The player must pick one, and all damage of the spell becomes that type.
- **Mana cost change** takes mana off the spell's cost, down to the **Mana cost minimum**. For example, Methodical Spellweaver has `-2` mana, minimum `1`, and an action cost change of `1`. The tier buttons and the roll window count the cut.

**Free copy** casts the spell again after the cast, at the same tier, free of mana and actions, for another target. The second card says "For free: a copy of the cast (Echo Casting)". The **Amount** of an option can read `@castManaSpent`, the mana the cast spends on the spell after cuts and free casts. Echo Casting uses `max(1, 2 * @castManaSpent)`, and the dropdown shows the cost at the chosen tier, such as **Echo Casting (4 mana)**.

::: details Edge cases
- A **Variable** cost asks for the amount under the dropdown, such as 1 mana or more. The amount stops at the maximum and at the mana left after the spell.
- An action or mana cost cut never brings the cost below the minimum, and never raises a cost that is already lower.
- With the **Costs** automation setting off, nothing is checked or spent, the dropdown is never off, and the card still shows the cost line.
:::
