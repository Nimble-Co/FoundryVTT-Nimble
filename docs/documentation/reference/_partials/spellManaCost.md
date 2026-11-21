**Example: Archmage.** When you roll Initiative, your next tiered spell costs 5 fewer mana and 1 action less.

Give the feature an effect with two rules, and an Apply Effect step that puts the effect on you. A **Use an item for free** rule with the trigger **You roll Initiative** uses the feature.

- Spell Mana Cost: **Mana change** → `-5`
- Action Cost: **Value** → `-1`, **Item types** → `Spell`, **Tiered spells only** → on

On the effect's **Lasts Until** tab, add **they cast a tiered spell** and **combat ends**. The effect ends after the spell it made cheaper.

The cost never goes below 0, so a tier 3 spell costs 0 mana. An upcast costs less too: a tier 7 cast costs 2 mana. The tier buttons in the cast window go as high as the lowered cost lets the caster reach, and the roll window says the lowered cost, such as "When you roll, it spends 2 Mana." The card stores the mana the cast really spent, so rules that read it count 2.

::: details Edge cases
- A cantrip has no mana cost, so the rule does nothing for it, and the effect stays on.
- A spell that a class pays for from a charge pool keeps its pool cost.
- Two rules add up. A positive change raises the cost.
:::
