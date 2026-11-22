The Attack Bonus From a Row rule adds damage and a Primary Die bonus to an attack made through one feature: the feature is the attack, or the hero attacks from the feature's row on a chat card. It adds nothing to another attack, and nothing when **Only attacks made through** is blank. With Feature Effects off, a row in Change This Roll adds them.

**Example: Juggernaut.** Your attack from a Coordinated Strike row deals extra damage equal to your armor, with +1 to the Primary Die.

- **Only attacks made through** → `coordinated-strike`
- **Extra damage** → `@attributes.armor.value`
- **Primary Die bonus** → `1`

With **Damage type** blank, the damage has the type of the attack.

**Example: Withering Strike.** Attacks made with your Coordinated Strike! deal extra necrotic damage equal to the max of your Combat Die.

- **Only attacks made through** → `coordinated-strike`
- **Attacks by** → You and allies
- **Extra damage** → `@pools.combat-dice.faces`
- **Damage type** → `necrotic`

**Attacks by** is **You only** at first. With **You and allies**, an attack that an ally makes through your feature, such as the attack Coordinated Strike! gives the ally, also gets the bonus. The formulas still read your values.

Damage with a type of its own goes on the card as its own damage, under the attack. A miss deals none of it. With Feature Effects off, the row adds only the Primary Die bonus: add damage with a type of its own by hand.
