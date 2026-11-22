**Example: Flametongue.** A sword that deals an extra 1d6 fire damage on every melee weapon attack.

- **Label** → `Flametongue: +1d6 fire`
- **Bonus** → `1d6`
- **Damage type** → `Fire`
- **Delivery** → `melee`
- **Source** → `weapon`

For a bonus that only applies to wounded enemies, add a **Target condition** row: key `target` - is - `bloodied`.

**Only attacks with this item** limits the bonus to one item, by its identifier, such as `lifebinding-spirit`. The rule can sit on another item: Deathbringer's Touch adds STR to the attacks of the Lifebinding Spirit in this way.

**Only attacks made through** limits the bonus to attacks a feature causes, by the feature's identifier, such as `coordinated-strike`. An attack is made through a feature when the feature is the attack, or when the hero attacks from the feature's row on a chat card. Blank is every attack. The same field is on Conditional Bonus and Primary Die Bonus.
