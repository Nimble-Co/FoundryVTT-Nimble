The Attacker Takes rule (type `damageBack`) puts damage, an effect, or both on the creature that attacks the owner. The attack card gets a line for it.

**When** picks the moment:

- **The owner takes damage from an attack:** the rule acts when the GM applies the damage of the card. The amount can be what the owner took after armor and reductions, or what the attack's crit dice came to. **Only against crits** limits it to crits.
- **The owner is attacked:** the rule acts when the attack card appears in chat, also on a miss. Each attacker on the card gets it, including each member of a minion group. Use **A formula** for the damage, because the owner has taken no damage yet.
- **The attack takes the temp HP of this effect:** the rule acts when the damage of the card takes some of the temp HP that its own effect gave. A hit that takes them to 0 counts too. Each attacker that hit gets it, including each member of a minion group that hit. On an item, this moment never comes, because only an effect gives temp HP of its own.

**Attacks** limits the rule to melee or ranged attacks. A monster attack with no attack type is melee. **Not on allies** leaves out an attacker on the owner's side, by token disposition. The owner never counts as its own attacker. When the system reads a card again, it does not add a second line.

**A formula** rolls once for each attacker, with a **Damage type**. **Ignore armor** is on by default. Turn it off and the attacker's armor, resistances, immunities and reductions apply. **Effect on the attacker** is an effect of the item, with Apply to the actor off, that goes on each attacker. **A Wound doubles it** puts a button on the card. With it, the owner or the GM can suffer 1 Wound to deal the amount one more time.

With **Feature Effects** off, the system puts nothing on the attacker. The line has a **Deal** or **Apply** button instead.

::: details The attack a reaction answers
A reaction spell cast from its row in the Defend window answers that attack. When its effect has a rule with **Also the attack it answers** on, that rule also acts on the attack it answers. Cast from the sheet, the effect acts only on later attacks.
:::

**Example: Bring the Pain.** Whenever you are crit, reduce the damage by half. The attacker takes the same amount of damage you took (ignoring armor). You may suffer 1 Wound to double the damage the enemy takes.

- A **Damage Reduction** rule with **Mode** → `Half` and **Only against crits** → on
- An **Attacker Takes** rule with **Only against crits** → on and **A Wound doubles it** → on

**Example: Flame Barrier.** Until the start of your next turn, melee attackers against you take KEY damage (ignoring armor) and gain Smoldering.

- On the spell's effect, an **Attacker Takes** rule with **When** → `The owner is attacked`, **Attacks** → `Melee`, **Not on allies** → on, **Also the attack it answers** → on, **Amount** → `A formula`, **Damage** → `@key`, **Damage type** → `Fire`, **Effect on the attacker** → the Smoldering effect

**Example: Crystalline Armor.** Enemies who reduce this temp HP in melee have their speed halved until the end of their next turn.

- On the ally's effect, which gives the temp HP, an **Attacker Takes** rule with **When** → `The attack takes the temp HP of this effect`, **Attacks** → `Melee`, **Not on allies** → on, **Amount** → `No damage`, **Effect on the attacker** → an effect with a halved speed

**Example: Spines.** Melee attackers take 3 damage.

- On the monster feature, an **Attacker Takes** rule with **When** → `The owner is attacked`, **Attacks** → `Melee`, **Amount** → `A formula`, **Damage** → `3`
