**Example: Survivalist.** A background that grants advantage against poison saves.

- **Label** → `Survivalist`
- **Roll mode value** → `1`
- **How to apply** → `adjust`
- **Only against** → `poison`

Because it names a situation, this rule never changes a stored default roll mode. It is listed under **Situational** on the saving throw config instead, and the player applies the advantage themselves when poison actually comes up. Nimble has only four saves, so "poison saves" cannot be expressed as a roll mode on one of them — a blanket bonus on STR would also cover forced movement, restraint and extreme temperatures.

Leave **Only against** blank for the ordinary case. The rule then changes the default roll mode for the saves named by **Target save**, which accepts a save key (`strength`, `dexterity`, `intelligence`, `will`) or one of the categories `all`, `advantaged`, `disadvantaged` and `neutral`. `advantaged`, `disadvantaged` and `neutral` are evaluated against the roll modes computed so far, so rule priority decides what they match.

A situational rule never contributes to the calculated default roll modes, so its **Target save** and **How to apply** have no effect there and the reminder is listed as written, without being narrowed to a particular save. The example still sets **How to apply** to `adjust` so that clearing **Only against** turns it into an ordinary stacking rule.
