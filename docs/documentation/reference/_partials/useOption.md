**Example: Stretch Time.** When you cast a tiered spell, spend 2 more mana to cast it with 1 less action, to a minimum of 1. One Spellshaper ability each turn.

- **Applies to** → `Spells`
- **Tiered spells only** → on
- **Resource** → `Mana`
- **Spend mode** → `Fixed`
- **Amount** → `2`
- **Use limit** → `spellshaper`
- **Action cost change** → `-1`
- **Action cost minimum** → `1`

Put the rule on the feature that gives the option. The option shows in the cast window of each spell that it applies to. Nothing is chosen at first.

Options with the same **Use limit** share one dropdown, named after the Charge Pool. The player picks one option, or none. When the pool is empty, the dropdown is off.

The spell mana and the option cost are checked and spent together. When the creature does not have enough for both, the cast stops and nothing is spent. The card shows the option cost, such as **Cost: 2 mana (Stretch Time)**.

An option can also change the cast:

- **Range for each mana**: more range.
- **Note on the card**: a line on the card.
- **Damage type pick**: the player picks the damage type of the spell.
- **Mana cost change**: less mana, down to the **Mana cost minimum**.
- **Free copy**: the spell casts again, free of mana and actions.
- **Spend in place of the spell's cost**: a button under **Spend** that replaces the cost of the spell.
- **Effect after the cast**: the caster gets an effect of the item.
- **Set the mana cost to**: the spell costs that much mana, with no upcast.

::: details More examples
- An option with no limit has a dropdown of its own.
- The **Amount** of an option can read `@castManaSpent`, the mana the cast spends on the spell after cuts and free casts.
- The dropdown lists **None** and each option with its cost, such as **Spellshaper (1/turn)** with **Stretch Time (2 mana)**. For a limit of one use each turn, give the pool 1 charge that refills at the start of each turn. An empty pool says **Used this turn**.
- **Range for each mana**: the amount stepper says the range, such as **Mana (+8 range)**, and the card shows the new range.
- **Note on the card**: `{amount}` puts in the amount spent, so `{amount} creatures unaffected` shows "3 creatures unaffected".
- **Mana cost change**: Methodical Spellweaver has `-2` mana, minimum `1`, and an action cost change of `1`.
- **Free copy**: the copy casts at the same tier, for another target. Echo Casting has the **Amount** `max(1, 2 * @castManaSpent)`. The dropdown shows the cost at the chosen tier, such as **Echo Casting (4 mana)**. The second card says "For free: a copy of the cast (Echo Casting)".
- **Spend in place of the spell's cost**: the buttons show the cost of the spell first, then each option, such as **1 Pilfered Power** and **10 temp HP (Shadowfrost)**. The cost of the spell is chosen at first. The spell casts at its own tier, or at the tier its class always casts at.
- **Set the mana cost to**: Master of Storm sets `0` on Ride the Lightning, with a **Use limit** of a pool that has 1 charge and refills on a Safe Rest.

**Example: Cryomancer's Reprisal.** Sacrifice half your max HP to cast any Ice spell.

- **Schools** → `Ice`
- **Resource** → `HP`
- **Amount** → `floor(@attributes.hp.max / 2)`
- **Spend in place of the spell's cost** → on
- **Effect after the cast** → an effect with an **Attacker Takes** rule: **When** → `The owner takes damage from an attack`, **Attacks** → `Melee`, **Only against crits** → off, **Amount** → `A formula`, **Damage** → `floor(@cost.hp / 2)`, **Damage type** → `Cold`
:::

::: details Edge cases
- The tier buttons show which tiers the option leaves short of mana. The roll window says the full cost, such as "When you roll, it spends 1 action and 3 Mana."
- Mana spent on an option does not raise the tier of the cast. Rules that read the mana spent on a spell do not count it.
- A sacrifice of HP is refused unless the caster has more HP than it takes. A temp HP spend is refused with fewer temp HP than it takes, and takes exactly its amount.
- **Effect after the cast**: the formulas of the effect can read `@cost`. The card has an Apply Effect step for it, which goes on by itself. `@cost.mana`, `@cost.hp`, `@cost.tempHp` and `@cost.wounds` are read when the effect goes on.
- When an option can change the action cost, the check for actions left waits until the player casts, and counts the change. It asks once.
- A **Variable** cost asks for the amount under the dropdown, such as 1 mana or more. The amount stops at the maximum and at the mana left after the spell.
- An action or mana cost cut never brings the cost below the minimum, and never raises a cost that is already lower.
- With the **Costs** automation setting off, nothing is checked or spent, the dropdown is never off, and the card still shows the cost line.
:::
