---
title: "On Use Steps"
---

# On Use Steps

You add these steps on the **On use** sub-tab of an item's **Activation** tab. [The On use sub-tab](activations.md#the-on-use-sub-tab-the-step-tree) tells how the step tree works.

## Damage

A damage entry has a **Roll Formula**, such as dice plus `@strength` or `@key`, and a **Damage Type**, such as fire or slashing. Its **Target Disposition** dropdown (Any / Friendly / Neutral / Hostile / Secret) tells the chat card who the roll is for. It also has three switches: **Ignore Armor**, **Only Damage Hostile Actors** and **Roll Damage From Card**.

::: details Target Disposition Any, and no choice
**Any** means no preference, so the Apply Damage button gets no hint about the targets. Picking Any is still a choice. The entry then keeps its own box on the chat card, even when nothing else shows its roll. If you leave the dropdown alone, a damage entry with no outcome child under On Hit shows on a miss only.
:::

**Roll Damage From Card** is for damage that comes later than the use itself, such as a trap that springs on the next creature to step adjacent. The card posts with no damage roll and a **Roll Damage** button in its place.

::: details Who rolls it, and where it shows
The author of the card and the GM can click **Roll Damage**. The roll then works like any other damage roll. Only top-level damage entries have the switch, because damage under an outcome already waits for that outcome. Can Miss and Can Crit still apply to the later roll.
:::

The first damage entry in the list is the attack roll. Only it has the **Can Miss** and **Can Crit** switches, and its result decides whether the card reads as a hit, a miss or a critical hit.

::: info When crits are suppressed
Even with Can Crit on, some attacks never crit: template (AoE) attacks, attacks by minions and flunkies, and attacks with a weapon whose type the wielder is not proficient with.
:::

A damage entry has three outcome buckets: **On Critical Hit**, **On Hit** and **On Miss**. Each bucket can hold child entries: more damage, a damage outcome, healing, an Apply Effect, an End Conditions, a Move, a Wound, a saving throw, or a note.

- A **Damage Outcome** sets what the parent roll deals in that bucket, **Full Damage** or **Half Damage**. For example, the stock longsword has a Damage Outcome of Full Damage under On Hit.
- A **Note** is a text box on the chat card with a style of **General**, **Flavor**, **Reminder** or **Warning**.

::: details A crit card, and outcomes at every depth
A critical hit is also a hit, so a crit card shows the children of both **On Critical Hit** and **On Hit**. The Damage Outcome is the one exception. If both buckets hold one, only the On Critical Hit outcome applies. Two outcomes would apply the same roll two times.

A damage entry in a bucket can hold its own Damage Outcome, and the rule is the same at every depth. The roll shows once, through that outcome.
:::

## Healing

A healing entry has a **Roll Formula**, a **Healing Type** (**Healing** or **Temporary Healing**), a **Who gets it?** choice, and a Target Disposition. **The one who uses it** gives the healing to the item's user with no target and no click. On a consumable object, the healing potion bonus rules of the drinker add to the healing formula.

## Save

A save entry asks for a saving throw. Pick the **Save Type** (Strength, Dexterity, Intelligence or Will) and, if you want, a **Custom Save DC**, a number or a formula such as `12+@key`. The formula reads the creature that uses the item, at the time it uses the item. The card keeps that number, so a later change to the creature does not change it. When the field is empty, a hero uses `10+@key`, and a monster has no DC. When a creature rolls with the d20 button on the card, its save card shows the result against this DC, and the save has the [roll tags](../rules-builder/predicates.md) `save:from` and `save:from:<item>`.

For a DC of 10 or the damage the monster took, whichever is higher (a Stink Cloud, for example), use `max(10, @damageTaken)`. The GM uses the feature after the hit, and the card keeps that DC.

A save entry has three sections:

- **Shared Rolls** holds damage that is rolled once and then split by the outcome. For "half on a save", add a damage entry here. Then put a **Damage Outcome** of Full Damage under On Failed Save, and one of Half Damage under On Passed Save.
- **On Failed Save** and **On Passed Save** are buckets for child entries: damage, healing, Apply Effect, End Conditions, Move or Wound entries, or notes.

## Apply Effect

Puts an effect of the item, one with **Apply to the actor** off, on the card's targets or on the user, as set in **Who takes it**. A new entry makes an effect with the item's name. **Effect** picks another. The pen opens the [effect window](effects.md). Its **Details** tab has the conditions that the effect gives, such as Frightened, and its **Lasts Until** tab has the Lasts Until and the Escape. **Temp HP that it gives** links a Temporary Healing entry. The effect then gives those temp HP, and takes back what is left when it ends.

An entry for **The creature that uses this** applies by itself when the item is used, while the Feature Effects automation setting is on. Set its **Applies** to **On a click** to make it wait for its **Apply to You** button. Use that when the player picks one of several entries, such as one element of Primordial Force. Under **On Hit**, **On Critical Hit** or **On Miss**, the entry applies only when the card has that outcome. A new use while the user has the effect keeps one copy.

An entry for **The targets** waits for the **Apply to Targets** button. Under **On Failed Save**, **Each creature that fails** puts the effect by itself on each creature that fails its save from this card. Under **On Passed Save**, **Each creature that saves** does the same for each creature that saves. A reroll that changes the result takes the effect back, once. With Feature Effects off, the entry has the **Apply to Targets** button. To make a state such as Rage, see [Build a state such as Rage](effects.md#build-a-state-such-as-rage).

::: details A reroll that takes the effect back
The take-back also removes the "At N stacks" effect that the application gave. An older copy that the application replaced comes back.
:::

::: details The temp HP link
The link holds only while the temp HP are that effect's. It ends when the temp HP reach 0, when another effect or a potion gives new temp HP, or when someone types a higher number in the Temp HP plate. After that, the effect takes back nothing when it ends. An **Undo** of damage gives back temp HP that are still the effect's, so the link stays. For an effect that lasts as long as its temp HP, pick "they lose its temp HP" in its Lasts Until.
:::

## Move

Gives a creature a move for free or Forced Movement. The card watches that creature's next drag. The drag counts as that movement, and the ruler shows how far the creature can go. There is nothing to click, and nothing stops a longer drag.

Choose the **Kind** (Move for free or Forced Movement), **Who Moves** (the creature that uses the feature, or the card's targets), and the **Distance**, a formula that reads the data of the feature's user. For example, `@abilities.strength.mod` is their Strength modifier, `2` a fixed number, and `@speed` the walk speed of the creature that moves (`@speed / 2` half of it). The system works out the distance once, when the card posts. **Distance by size** can override the formula for a size category (a push that moves Small creatures twice as far, for example). Turn on **Ignore difficult terrain** for a move for free that says so. Forced Movement always ignores it.

The card shows the **Direction**: away from or toward the feature's user, or any direction for Forced Movement. Nothing enforces the direction. Under **On Hit**, **On Critical Hit** or **On Miss**, the move is on the card only when the card has that outcome. A critical hit is also a hit. See [Running Combat](../gm/combat.md#forced-movement-and-moves-for-free).

::: details How the card words the move
**Show the distance as "up to"** sets how the card words the distance. It starts on for a move for free ("Can move up to 6 spaces for free.") and off for Forced Movement ("Pushed 2 spaces away from Grug."), as the rulebooks word them. Turn it on for a push or pull whose text says "up to". Turn it off for a move for free of a set distance. It changes only the words on the card.

The card leaves the direction out when only the user moves. A move for free that ignores difficult terrain says so. The rules give a push no particular shape.
:::

::: details Under a save, and with the automation off
The card does not record the saving throw of each target. So under **On Failed Save** or **On Passed Save**, the card shows the distance for each target but does not watch the drag. Move the token by hand when the save calls for it.

With the Pushes, Pulls and Moves for Free automation toggle off, the card shows the distance as text and you drag the token as usual.
:::

## Wound

Gives **Wounds** (1 or more) to the card's targets or to the user (**Who takes them**), for a hazard such as "suffer 1 Wound". An entry for the targets waits for the **Apply to Targets** button. An entry for **The creature that uses this** gives its Wounds by itself when the item is used, while the Feature Effects automation setting is on, as an Apply Effect entry does. Under **On Failed Save** or **On Passed Save**, it keeps its button.

For a monster whose attacks also Wound, use the **Wounds** field of an [Apply Condition](../reference/rules-triggers.md#apply-condition) rule in place of a step.

::: details More about the Wound step
- A Wound goes up to the max of the track and no further. Monsters have no Wound track. For a monster, the card says "Kobold has no Wounds", and nothing changes.
- The card's author and the GM see the button. A player's click on a creature they do not own goes through the GM, so a GM must be online.
- The row has no Undo. Take a Wound back on the sheet.
:::

## End Conditions

Ends conditions on the user or on the card's targets (**Who it helps**). **Ends** is **Every negative condition** (see [Negative conditions](../playing/conditions.md#negative-conditions)) or **These conditions**, with a toggle for each condition. A listed condition also ends a condition that counts as it, so listing Incapacitated ends Stunned. The step ends the whole effect that gives the condition, with its other changes. An effect with Poisoned and -1 speed ends as one.

An entry for **The creature that uses this** runs by itself when the item is used, while the Feature Effects automation setting is on. An entry for the targets waits for its **Apply to Targets** button. Each ended effect gets a line with **Undo** in the Events strip of the card. The row then says "Ended on" and the names, or "Nothing to end on" a creature.

::: details More about the End Conditions step
- It ends only the creature's own effects. An effect of an item that is always on stays.
- A player's click goes through the GM, so a GM must be online. With no GM, nothing ends and the button stays.
:::

## Pool

An advanced entry that changes a dice pool or a charge pool when the item is used. Pick the **Pool Type** (Dice Pool or Charge Pool) and an **Action** (Roll Die, Roll Pool, Fill Count, Clear or Maximize Lowest Die), and give the pool's identifier and a value. With the **Predicate (JSON)** field, the entry applies only when a condition test passes. It uses the same syntax as [the Condition box](../rules-builder/predicates.md), for example `{ "level": { "min": 5 } }`. Rules create the pools themselves. See the [resources reference](../reference/rules-resource.md).

**Maximize Lowest Die** raises the lowest **Value** dice in a dice pool to the die's highest face. When there is nothing to raise (an empty pool, or every die already at maximum), the card says so. It needs no player input, so it fits a feature that always maximizes. When the rules text lets the player choose which die, use a Dice Consumer rule with its selection outcome set to `maximize` instead. That opens the choice step under the item's row on the sheet, where the player picks. See the [resources reference](../reference/rules-resource.md).

A pool entry works only when the use goes ahead, so an item that needs a charge it has run out of changes nothing.

## Related pages

- [Item Activations & Effects](activations.md)
- [Effects](effects.md)
- [The Condition Box](../rules-builder/predicates.md)
- [Dice & Chat](../playing/dice-and-chat.md)
