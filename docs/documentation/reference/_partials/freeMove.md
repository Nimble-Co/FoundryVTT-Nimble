**Example: Swift Fury.** Whenever the Berserker gains one or more Fury Dice, they can move up to DEX spaces for free, ignoring difficult terrain.

- **Label** → `Swift Fury`
- **Trigger** → `onPoolGain`
- **Dice pool** → `fury`
- **Distance** → `@dexterity`
- **Recipient** → `self`
- **Ignores difficult terrain** → on

When the trigger fires, the rule posts a small Movement Offer card that says why, for example "gained Fury Dice". The card title is the rule's **Label**, or the item name when the label is empty. The creature then carries the offer: its next drag is recorded as a Free Move, so it does not draw on the creature's speed for the turn. Nothing moves by itself, and the player can choose not to move. See [Movement offers](../gm/combat.md#movement-offers) for how an offer is taken, settled and lapsed.

The rule posts nothing while the **Movement Offers** toggle is off, or while **Movement Tracking** is off, because Movement Offers needs it. The **Apply Conditions and Effects from Rules** toggle does not stop it. It also posts nothing when the distance comes to zero for every creature, for example Swift Fury with DEX 0 or less.

**Recipient** `allies` or `selfAndAllies` offers one move to each ally within **Allies within (spaces)** of this creature, and each player moves their own token. Advance! works this way: when a Champion of the Vanguard uses Coordinated Strike, the Commander and each ally within 12 spaces can first move up to half their speed. In **Distance**, `@speed` is the speed of the creature that moves, so each offer uses that creature's own speed.

**Charge pool** limits how often the offer appears. With a 1/round pool, the rule offers once a round and spends the charge when its card posts. Leave it empty for no limit.
