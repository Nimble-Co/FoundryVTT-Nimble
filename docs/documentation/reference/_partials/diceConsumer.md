**Example: That all you got?!** A reaction that spends Fury Dice to soak damage.

- **Label** → `That all you got?!`
- **Pool identifier** → `fury`
- **Mode** → `manual`
- **Cost** → `1`
- **Effect formula** → `(@strength + @dexterity) * @n`
- **Effect type** → `damageReduction`
- **Selection outcome** → `consume`

A consumer is what makes a dice pool do something. The pool stores the dice; the consumer decides how they are used.

**Mode** picks between the two shapes:

- `manual` puts the player in charge. Activating the item opens the dice panel on their sheet with this feature already selected, they pick which dice to use, and confirming applies the result. Use this for anything the rules text describes as a choice.
- `autoBonus` is passive: every face in the pool is added to qualifying attacks automatically and nothing is spent. This is how a pool that snowballs damage works.

Several consumers can share one pool. A Berserker's Fury Dice carry an `autoBonus` consumer for melee damage *and* separate `manual` consumers for the features that spend them, all pointing at the same `fury` identifier.

**Attack delivery** narrows a consumer to `melee` or `ranged` attacks and governs both shapes: an `autoBonus` pool only adds its faces to attacks of that kind, and a card offer only appears on them. Leave it empty (or pick `any`) for no restriction.

Two things to watch for. An activation with no attack type set counts as neither melee nor ranged, so most spells and utility features are excluded by any restriction here, with nothing on screen to explain the absence. And the unarmed strike, opportunity strike and heroic-action buttons build their attack outside the normal activation flow: a card offer reads them as melee, but an `autoBonus` pool does not reach them at all, filtered or otherwise.

**Effect formula** is evaluated when the player confirms, with two references filled in from their picks: `@n` is how many dice they chose and `@sum` is the total of those dice faces. Both combine with the usual sheet references, so a spend can scale with the character as well as the dice. See [Formulas & References](../rules-builder/formulas.md) for the full vocabulary. **Effect type** decides what the result does: `generic` posts the total to chat and leaves the rest to the table, while `damageReduction` also banks the total so it is subtracted from the next damage the character takes.

**Offer on attack card** moves the spend out of the sheet panel and onto the attack card it modifies, for features the rules tie to how an attack landed. Set it to `criticalHit` for a feature that only works on a crit (the Berserker's Death Blow), or `hit` for one that works on any hit. Leave it empty and the spend stays on the sheet, which is the right choice for anything that is not about a specific attack, such as a reaction that soaks damage.

**Example: Death Blow.** Spends any number of Fury Dice after a crit and deals double their total.

- **Label** → `Death Blow: bonus damage`
- **Pool identifier** → `fury`
- **Mode** → `manual`
- **Effect formula** → `2 * @sum`
- **Effect type** → `generic`
- **Offer on attack card** → `criticalHit`

With **Bonus damage type** left empty the result is added to that attack's own damage total, so the GM applies damage once and the target's armor, resistances and reductions are counted once. Posting it as a separate roll would count them twice.

A consumer that opts in gives up its sheet flow entirely: it no longer opens the panel when the item is activated, and it is hidden from the pool panel's feature list. The panel cannot see how the attack turned out, so leaving it there would offer a crit-only spend on any activation.

Opting in needs the rest of the rule to line up. It has to be a `manual` spend with `consume` as its outcome, a `generic` effect type, and an effect formula, on a player character. A `damageReduction` spend is banked against incoming damage rather than added to an attack, so it is not eligible.

**Bonus damage type** covers the features whose extra damage is a specific type (radiant, fire) rather than more of what the weapon deals. A damage node carries exactly one type, so a typed bonus cannot fold into the attack's roll: it lands on the card as its own damage packet, with its own Apply Damage button. Leave it empty and the bonus deals whatever the attack deals, which is the cheaper path in every way.

Know what that costs before you set it. The target's flat damage reduction, their resistance and monster heavy armor all resolve against each packet separately, so a target with damage reduction 2 subtracts 2 from the attack and 2 more from the typed bonus. Flat reduction is meant to apply once per attack ("reduce damage from any single attack by your Armor"), so a typed bonus is currently generous to the defender. Resistance halving each packet on its own is the reasonable reading, though the rulebooks say only "take half as much damage" and never address an attack with more than one damage type.

**Selection outcome** decides what happens to the dice the player picked:

- `consume` removes them from the pool. This is the normal case, and it needs an effect formula to be worth showing.
- `maximize` leaves them in the pool and raises each one to the die's highest face. Use it for a feature that changes a die rather than spending it. No effect formula is needed, dice already showing their highest face are not offered, and the number of picks is limited by **Cost**, so a cost of `1` gives the player exactly one choice.
