**Example: Swift Fury.** Whenever the Berserker gains one or more Fury Dice, they can move up to DEX spaces for free, ignoring difficult terrain.

- **Label** → `Swift Fury`
- **Trigger** → `onPoolGain`
- **Dice pool** → `fury`
- **Distance** → `@dexterity`
- **Recipient** → `self`
- **Ignores difficult terrain** → on

When the trigger fires, the rule posts a small card that says why, for example "gained Fury Dice". The card title is the rule's **Label**, or the item name when the label is empty. The creature's next drag then counts as the Free Move, so it does not draw on the creature's speed for the turn. Nothing moves by itself, and the player can choose not to move. See [Forced and Free Movement](../gm/combat.md#forced-and-free-movement) for how the card follows the move and what its tag shows.

The rule posts nothing while the **Forced and Free Movement** toggle is off, or while **Movement Tracking** is off, because Forced and Free Movement needs it. The **Apply Conditions and Effects from Rules** toggle does not stop it. It also posts nothing when the distance comes to zero for every creature, for example Swift Fury with DEX 0 or less.

**Recipient** `allies` or `selfAndAllies` gives one move to each ally within **Allies within (spaces)** of this creature, and each player moves their own token. Advance! works this way: when a Champion of the Vanguard uses Coordinated Strike, the Commander and each ally within 12 spaces can first move up to half their speed. In **Distance**, `@speed` is the speed of the creature that moves, so each creature's distance uses its own speed.

**Whisper the card** is not set by default, so everyone sees the card. Set it to show the card only to the feature's owner, the players whose creatures get the move, and the GM. The ruler still shows the Free Move to everyone who sees the drag.

**Charge pool** limits how often the rule posts its card. With a 1/round pool, the rule posts once a round and spends the charge when its card posts. Leave it empty for no limit.
