The Spell or Attack Option rule (type `useOption`) gives the owner an option to turn on in the cast window of a spell. The option has a cost, as a Spend or Sacrifice rule has, and it can change the cast. Put the rule on the feature that gives the option.

**Which spells.** Set **Applies to** → `Spells`. **Tiered spells only**, **Single-target spells only**, **Schools** and **Named spells** limit the spells. An option shows only for a spell at a tier that the caster has unlocked. A cantrip counts as unlocked.

**The dropdown.** Options with the same **Use limit** (a Charge Pool) share one dropdown, named after the pool. The player picks one option, or **None**. Nothing is chosen at first. A cast with an option uses one use of the pool. When the pool has no use left, the dropdown is off. An option with no limit has a dropdown of its own.

**The cost.** **Resource**, **Spend mode**, **Amount** and **Using Beyond What You Have** work as on a Spend or Sacrifice rule. The **Amount** can read `@castManaSpent`, the mana that the cast spends on the spell. When the player casts, the system checks the cost of the spell first, then the option cost against what is left. When a cost does not fit, the cast stops with a message, such as "Stretch Time needs 2 mana. You have 1.", and nothing is spent. The card shows the option cost, such as **Cost: 2 mana (Stretch Time)**.

**What an option changes:**

- **Action cost change** and **Action cost minimum**: more or fewer actions. A cut stops at the minimum.
- **Mana cost change** and **Mana cost minimum**: more or less mana for the spell. A cut stops at the minimum.
- **Set the mana cost to**: the spell costs that much mana at its own tier, with no upcast. A set mana is final: no mana cost change applies on top of it.
- **Spend in place of the spell's cost**: the option cost replaces the cost of the spell. These options are buttons under **Spend**, after the cost of the spell.
- **Range for each mana**: more range for each mana that the option spends.
- **Note on the card**: a line on the card. `{amount}` puts in the amount spent.
- **Damage type pick**: the player picks one of the listed types for all damage of the spell.
- **Free copy**: the spell casts again after the cast, at the same tier, free of mana and actions.
- **Effect after the cast**: the caster gets an effect of the item. Its formulas can read `@cost`.

**Example: Stretch Time.** Spend 2 more mana to cast a tiered spell with 1 less action, to a minimum of 1. One Spellshaper ability each turn.

- **Applies to** → `Spells`, **Tiered spells only** → on
- **Resource** → `Mana`, **Amount** → `2`, **Use limit** → `spellshaper`
- **Action cost change** → `-1`, **Action cost minimum** → `1`

::: details More examples
- **Free copy**: Echo Casting has **Amount** `max(1, 2 * @castManaSpent)`.
- **Mana cost change**: Methodical Spellweaver has `-2` mana, minimum `1`, and **Action cost change** `1`.
- **Set the mana cost to**: Master of Storm sets `0` on Ride the Lightning, with a pool of 1 charge that refills on a Safe Rest.
- **Spend in place of the spell's cost**: Cryomancer's Reprisal has **Schools** `Ice`, **Resource** `HP`, **Amount** `floor(@attributes.hp.max / 2)`, and an **Effect after the cast** with an **Attacker Takes** rule that deals `floor(@cost.hp / 2)` cold damage.
:::

::: details Edge cases
- For a limit of one use each turn, give the pool 1 charge that refills at the start of each turn.
- The tier buttons show which tiers the option leaves short of mana. The roll window says the full cost, such as "When you roll, it spends 1 action and 3 Mana."
- Mana spent on an option does not raise the tier of the cast. Rules that read the mana spent on a spell do not count it.
- A spell that casts at a fixed tier for its class keeps that tier with **Spend in place of the spell's cost**.
- A cast with an option above the highest unlocked tier stops, also from a macro.
- A sacrifice of HP is refused unless the caster has more HP than it takes. A temp HP spend takes exactly its amount.
- **Effect after the cast**: `@cost.mana`, `@cost.hp`, `@cost.tempHp` and `@cost.wounds` are read when the effect goes on. The card has an Apply Effect step for it, which goes on by itself.
- When an option can change the action cost, the check for actions left waits until the player casts, and counts the change. It asks once.
- A **Variable** cost asks for the amount under the dropdown. The amount stops at the maximum and at the mana left after the spell.
- A cut never raises a cost that is already lower than the minimum.
- With the **Costs** automation setting off, nothing is checked or spent, the dropdown is never off, and the card still shows the cost line.
:::

**Example: Zealot.** When you attack with a melee weapon, spend mana up to your highest unlocked spell tier. For each mana, pick one: +5 radiant damage, or the target's armor counts 1 step lower for this attack.

- **Applies to** → `Melee weapons`
- **Resource** → `Mana`
- **Spend mode** → `Variable`
- **Minimum** → `0`
- **Maximum** → `@resources.highestUnlockedSpellTier`
- **Picks** → `Condemning Strike` with **Damage for each** `5` and **Damage type** `Radiant`; `Blessed Aim` with **Armor steps lower for each** `1`

An option for **Melee weapons** shows in the roll window of each equipped weapon whose attack is melee. With **Picks**, the window shows a heading such as **Zealot (up to 3 mana)**, one counter for each pick, and a total line such as "2 of 3 mana. You have 7." The counters together stop at the maximum and at what the creature has. Nothing is picked at first.

The player picks before the roll. The amount is spent when the attack is rolled, and the card shows **Cost: 2 mana (Zealot)**. Each unit in a pick adds that pick's change to the attack. Damage for each rolls as its own damage step with its type, such as **Radiant: 10** for two units of 5. A flat amount is a damage modifier, so Medium and Heavy armor drop it, unless the attack crits. Each armor step counts the target's armor one step lower when the damage is applied: Heavy to Medium to none. It applies to all the damage of the attack, as Ignore armor does.

::: details Edge cases
- **Picks** need **Spend mode** `Variable`. With `Fixed`, the picks do not show.
- An option for melee weapons with no picks does not show in the roll window yet.
- Armor steps count only against a creature with Medium or Heavy armor. A hero's Armor is a Defend value and does not change.
:::
