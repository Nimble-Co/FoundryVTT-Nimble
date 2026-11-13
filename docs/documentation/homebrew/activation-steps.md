---
title: "On Use Steps"
---

# On Use Steps

These are the steps that you add on the **On use** sub-tab of an item's **Activation** tab. For how the step tree works, see [The On use sub-tab](activations.md#the-on-use-sub-tab-the-step-tree).

## Damage

A damage entry has a **Roll Formula** (dice plus references like `@strength` or `@key`), a **Damage Type** (fire, slashing, and so on), and a **Target Disposition** dropdown (Any / Friendly / Neutral / Hostile / Secret) that tells the chat card who the roll is meant for. **Any** means no preference: the Apply Damage button gets no hint about the targets. Picking Any is still a choice, so the entry keeps its own box on the chat card even when nothing else shows its roll. Leave the dropdown alone and a damage entry with no outcome child under On Hit shows on a miss only. Three switches refine it: **Ignore Armor**, **Only Damage Hostile Actors**, and **Roll Damage From Card**.

**Roll Damage From Card** is for damage that lands on a later trigger than the activation itself, such as a trap that springs on the next creature to step adjacent. The card posts with the damage unrolled and shows a **Roll Damage** button in its place; the message author and the GM can press it, and the result then behaves like any other damage packet. It appears on top-level damage entries only, because damage nested under an outcome already waits on that outcome. Can Miss and Can Crit still apply to the deferred roll.

The *first* damage entry in the list is special: it is the attack roll. It alone shows the **Can Miss** and **Can Crit** switches, and its result decides whether the whole card reads as a hit, a miss, or a critical hit.

::: info When crits are suppressed
Even with Can Crit on, some attacks never crit: template (AoE) attacks, attacks made by minions and flunkies, and attacks with a weapon whose type the wielder is not proficient with.
:::

Under a damage entry you get three outcome buckets: **On Critical Hit**, **On Hit**, and **On Miss**. Each bucket can hold child effects: more damage, a damage outcome, healing, an Apply Effect, an End Conditions, a Move, a Wound, a saving throw, or a note.

A critical hit is also a hit, so a crit card shows the children of both **On Critical Hit** and **On Hit**. The Damage Outcome is the one exception. If both buckets hold one, only the On Critical Hit outcome applies. Two outcomes would apply the same roll two times.

- **Damage Outcome** declares what the parent roll deals in that bucket: **Full Damage** or **Half Damage**. The stock longsword, for example, has a Damage Outcome of Full Damage under On Hit. A damage entry nested in a bucket can hold its own Damage Outcome, and the rule is the same at every depth: the roll shows once, through that outcome.
- **Note**: a text callout on the chat card with a style of **General**, **Flavor**, **Reminder**, or **Warning**.

## Healing

A healing entry has a **Roll Formula**, a **Healing Type** (**Healing** or **Temporary Healing**), a **Who gets it?** choice, and a Target Disposition. **The one who uses it** gives the healing to the item's user with no target and no click. On consumable objects, healing formulas are automatically increased by any healing-potion-bonus rules the drinker has.

## Save

A save entry prompts a saving throw: pick the **Save Type** (Strength, Dexterity, Intelligence, or Will) and optionally a **Custom Save DC**, a number or a formula such as `12+@key`. The formula reads the creature that uses the item, at the time it uses the item: the card keeps that number, and a later change to the creature does not change it. When the field is empty, a hero uses `10+@key`, and a monster has no DC. When a creature rolls with the d20 button on the card, its save card tells the result against this DC, and the save has the [roll tags](../rules-builder/predicates.md) `save:from` and `save:from:<item>`. A save with a DC of the higher of 10 or the damage the monster took (a Stink Cloud, for example) uses `max(10, @damageTaken)`: the GM uses the feature after the hit, and the card keeps that DC. It has three sections:

- **Shared Rolls**: damage that is rolled once and then split by the outcome. Add a damage entry here, then put **Damage Outcome** entries under On Failed Save (Full Damage) and On Passed Save (Half Damage) for the classic "half on a save" pattern.
- **On Failed Save** / **On Passed Save** are buckets for child effects: damage, healing, Apply Effect, End Conditions, Move or Wound entries, or notes.

## Apply Effect

Puts an effect of the item (one with **Apply to the actor** off) on the card's targets or on the user (**Who takes it**). A new entry makes an effect with the item's name; **Effect** picks another. The pen opens the [effect window](effects.md): the conditions it gives (Frightened, for example) are on **Details**, its Lasts Until and Escape on **Lasts Until**. **Temp HP that it gives** links a Temporary Healing entry: the effect gives those temp HP, and takes back what is left when it ends.

An entry for **The creature that uses this** applies by itself when the item is used, while the Feature Effects automation setting is on. Set its **Applies** to **On a click** and it waits for its **Apply to You** button: use it when the player picks one of several entries, such as one element of Primordial Force. Under **On Hit**, **On Critical Hit** or **On Miss**, it applies only when the card has that outcome. A new use while the user has the effect keeps one copy. An entry for **The targets** waits for the **Apply to Targets** button. Under **On Failed Save**, **Each creature that fails** puts the effect by itself on each creature whose save from this card fails (under **On Passed Save**: **Each creature that saves**). A reroll that changes the result takes it back, once. With Feature Effects off, the entry has the **Apply to Targets** button. To make a state such as Rage, see [Build a state such as Rage](effects.md#build-a-state-such-as-rage).

::: details A reroll that takes the effect back
The take-back also removes the "At N stacks" effect that the application gave. An older copy that the application replaced comes back.
:::

::: details The temp HP link
The link holds only while the temp HP are that effect's. It ends when the temp HP reach 0, when another effect or a potion gives new temp HP, or when someone types a higher number in the Temp HP plate. After that, the effect takes back nothing when it ends. An **Undo** of damage gives back temp HP that are still the effect's, so the link stays. For an effect that lasts as long as its temp HP, pick "they lose its temp HP" in its Lasts Until.
:::

## Move

A move for free or Forced Movement for a creature. The card watches that creature's next drag: the drag counts as that movement, and the ruler shows how far it can go. There is nothing to click, and nothing stops a longer drag. Choose the **Kind** (Move for free or Forced Movement), **Who Moves** (the creature that uses the feature, or the card's targets), and the **Distance** as a formula against the data of the feature's user: `@abilities.strength.mod` is their Strength modifier, `2` a fixed number, and `@speed` the walk speed of the creature that moves (`@speed / 2` half of it). The distance is worked out once, when the card is posted. **Distance by size** can override the formula for a size category (a push that moves Small creatures twice as far, for example). Turn on **Ignore difficult terrain** for a move for free that says so; Forced Movement always ignores it. **Show the distance as "up to"** sets how the card words the distance. It starts on for a move for free ("Can move up to 6 spaces for free.") and off for Forced Movement ("Pushed 2 spaces away from Grug."), as the rulebooks word them. Turn it on for a push or pull whose text says "up to"; turn it off for a move for free of a set distance. It changes only the words on the card. The card shows the **Direction**: away from or toward the feature's user, or in any direction for Forced Movement. It leaves the direction out when only the user moves. A move for free that ignores difficult terrain says so. Nothing enforces the direction, and the rules give a push no particular shape. Placed under **On Hit**, **On Critical Hit** or **On Miss**, the move is on the card only when the card has that outcome; a critical hit is also a hit. The card does not record the saving throw of each target, so under **On Failed Save** or **On Passed Save** the card shows the distance for each target, but the drag is not watched. Move the token by hand when the save calls for it. With the Pushes, Pulls and Moves for Free automation toggle off, the card shows the distance as text and the token is dragged as usual. See [Running Combat](../gm/combat.md#forced-movement-and-moves-for-free).

## Wound

Gives **Wounds** (1 or more) to the card's targets or to the user (**Who takes them**), for a hazard such as "suffer 1 Wound". An entry for the targets waits for the **Apply to Targets** button. An entry for **The creature that uses this** gives its Wounds by itself when the item is used, while the Feature Effects automation setting is on, as an Apply Effect entry does. Under **On Failed Save** or **On Passed Save** it keeps its button.

For a monster whose attacks also Wound, use the **Wounds** field of an [Apply Condition](../reference/rules-triggers.md#apply-condition) rule in place of a step.

::: details More about the Wound step
- A Wound goes up to the max of the track and no further. Monsters have no Wound track: the card says "Kobold has no Wounds", and nothing changes.
- The card's author and the GM see the button. A player's click on a creature they do not own goes through the GM, so a GM must be online.
- There is no Undo on the row: take a Wound back on the sheet.
:::

## End Conditions

Ends conditions on the user or on the card's targets (**Who it helps**). **Ends** is **Every negative condition** (see [Negative conditions](../playing/conditions.md#negative-conditions)) or **These conditions**, with a toggle for each condition. A listed condition also ends a status that counts as it: listing Incapacitated ends Stunned. The step ends the whole effect that gives the condition, with its other changes: an effect with Poisoned and -1 speed goes as one.

An entry for **The creature that uses this** runs by itself when the item is used, while the Feature Effects automation setting is on. An entry for the targets waits for its **Apply to Targets** button. Each ended effect gets a line with **Undo** in the Events strip of the card. The row then says "Ended on" and the names, or "Nothing to end on" a creature.

::: details More about the End Conditions step
- It ends only the creature's own effects. An effect of an item that is always on stays.
- A player's click goes through the GM, so a GM must be online. With no GM, nothing ends and the button stays.
:::

## Pool

An advanced entry that manipulates a dice pool or charge pool when the item activates: pick the **Pool Type** (Dice Pool or Charge Pool) and an **Action** (Roll Die, Roll Pool, Fill Count, Clear, or Maximize Lowest Die), plus the pool's identifier and a value. The **Predicate (JSON)** field lets the entry apply only when a condition test passes, using the same syntax as [the Condition box](../rules-builder/predicates.md), for example `{ "level": { "min": 5 } }`. Pools themselves are created with rules; see the [resources reference](../reference/rules-resource.md).

**Maximize Lowest Die** raises the lowest **Value** dice in a dice pool to the die's highest face, and reports on the card when there was nothing to raise (an empty pool, or every die already at maximum). It acts on its own with no player input, which suits a feature that always maximizes. When the rules text lets the player choose *which* die, use a Dice Consumer rule with its selection outcome set to `maximize` instead: that opens the choice step under the item's row on the sheet and lets them pick. See the [resources reference](../reference/rules-resource.md).

Pool entries only take effect once the activation is allowed to proceed, so an item gated by a charge that has run out changes nothing.

## Related pages

- [Item Activations & Effects](activations.md)
- [Effects](effects.md)
- [The Condition Box](../rules-builder/predicates.md)
- [Dice & Chat](../playing/dice-and-chat.md)
