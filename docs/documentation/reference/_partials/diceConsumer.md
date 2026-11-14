**Example: That all you got?!** A reaction that spends Fury Dice to soak damage.

- **Label** → `That all you got?!`
- **Pool identifier** → `fury`
- **Mode** → `manual`
- **Cost** → `1`
- **Effect formula** → `(@strength + @dexterity) * @n`
- **Effect type** → `damageReduction`
- **Selection outcome** → `consume`

A dice pool only holds dice. A consumer is what makes them do something.

**Mode** has two values:

- `manual` lets the player choose. When they activate the item, a choice step opens under the item's row on their sheet. They pick the dice to use, and **Spend** applies the result. Use it when the feature text gives the player a choice.
- `autoBonus` needs no click. The system adds every face in the pool to each attack that qualifies, and spends no dice. Use it for a pool that adds more damage as it grows.

Several consumers can use one pool. The Berserker's Fury Dice have an `autoBonus` consumer for melee damage and `manual` consumers for the features that spend them. All of them use the `fury` identifier.

**Attack delivery** limits a consumer to `melee` or `ranged` attacks, in both modes. An `autoBonus` pool adds its faces only to attacks of that kind, and a card offer shows only on them. Leave it empty, or pick `any`, for no limit.

Watch for these cases. A hero activation with no attack type counts as neither melee nor ranged. So a limit here leaves out most spells and utility features, and nothing on screen tells why. A monster attack with no attack type counts as melee, but a monster area attack with none does not. The unarmed strike, opportunity strike and heroic-action buttons make their attack outside the normal activation flow. A card offer reads them as melee, but an `autoBonus` pool never reaches them, with or without a limit.

The system reads the **Effect formula** when the player confirms. Two references come from their picks. `@n` is how many dice they chose, and `@sum` is the total of those faces. Both work with the usual sheet references, so a spend can scale with the character as well as the dice. See [Formulas & References](../rules-builder/formulas.md) for the full list. **Effect type** decides what the result does. `generic` posts the total to chat and leaves the rest to the table. `damageReduction` also banks the total, and the system subtracts it from the next damage the character takes.

**Offer on attack card** moves the spend from the sheet to the attack card it changes. Use it for a feature that depends on how an attack landed. Set it to `criticalHit` for a feature that works only on a crit, such as the Berserker's Death Blow, or to `hit` for one that works on any hit. Leave it empty to keep the spend on the sheet. That is the right choice for a feature that is not about one attack, such as a reaction that soaks damage.

**Example: Death Blow.** Spends any number of Fury Dice after a crit and deals double their total.

- **Label** → `Death Blow: bonus damage`
- **Pool identifier** → `fury`
- **Mode** → `manual`
- **Effect formula** → `2 * @sum`
- **Effect type** → `generic`
- **Offer on attack card** → `criticalHit`

With **Bonus damage type** empty, the system adds the result to the attack's own damage total. The GM applies the damage one time, and the target's armor, resistances and reductions count one time. A separate roll would count them twice.

A consumer with **Offer on attack card** set no longer opens a choice step on the sheet when the player activates the item. The sheet cannot see how the attack turned out, so it would offer a crit-only spend on every activation.

**Offer on attack card** works only on a player character, and only when the rule has `manual` mode, the `consume` outcome, the `generic` effect type and an effect formula. A `damageReduction` spend is banked against incoming damage, not added to an attack, so it cannot use the offer.

**Bonus damage type** is for a feature whose extra damage has its own type, such as radiant or fire, and is not more of what the weapon deals. A damage node has exactly one type, so a typed bonus cannot join the attack's roll. It goes on the card as its own damage packet. Leave the field empty and the bonus deals the attack's type, which is simpler.

The GM still applies the card with one click, and the target's flat damage reduction still comes off one time. Two things change. Resistance applies to each packet, so a target resistant to the bonus type takes half of the bonus and full damage from the attack. The rulebooks do not cover an attack with two damage types, so this is the system's reading of "take half as much damage". And a monster in heavy armor halves each packet and rounds each one up, so a typed bonus does slightly more damage through heavy armor than the same amount in the attack's roll.

**Selection outcome** decides what happens to the dice the player picked:

- `consume` removes them from the pool. This is the usual value, and it needs an effect formula.
- `maximize` leaves them in the pool and raises each one to the die's highest face. Use it for a feature that changes a die and does not spend it. It needs no effect formula. The choice step does not offer dice that already show their highest face. **Cost** limits the number of picks, so a cost of `1` gives the player exactly one pick.
