**Example: Chaos Lash.** When an enemy moves adjacent to the Mage, the Mage can react: the enemy is pushed back 2 spaces, and knocked Prone on a failed WIL save. The feature is 1/encounter.

- **Label** → `Chaos Lash`
- **Event** → `creatureMoved`
- **Creature** → `enemy`
- **Geometry** → `enteredReach`
- **Reach** → `1`
- **Predicate** → `{ "self:chaos-lash-useChargePool": { "min": 1 } }`

With **Movement Tracking** on, and with both creatures in a started combat, each finished Movement that matches posts a card for the Mage's owner. The card names the creature that moved, shows the spaces of that Movement and the spaces it moved this turn, and has a **Use Chaos Lash** button. The button targets the creatures the card names and then uses the feature as normal, so the player can still change the targets or not use it at all. The system never uses the feature for you. The **Apply Conditions and Effects from Rules** toggle does not stop the card.

**Whisper the card** is set by default, so only the feature's owner and the GM see the card, because only they can use its button. Clear it to show the card to everyone. The button still shows only to the feature's owner and the GM.

The 1/encounter limit lives on the feature, not on this rule. A Charge Pool rule holds the use, a Charge Consumer spends it when the feature is used, and the predicate on the pool's tag stops the card once the use is gone. So nothing is spent until the player clicks the button.

The geometry is tested after the creature stops, along the whole path of its Movement: `enteredReach` fires when any step of the path goes from outside the Reach to inside it. A Teleport never counts. **Event** `selfMoved` watches this creature's own Movement instead. Thunderous Steps uses it, with **Minimum spaces** `4` counted this turn and **Geometry** `endsAdjacent`.
