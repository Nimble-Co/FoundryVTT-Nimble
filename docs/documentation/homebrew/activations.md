---
title: "Item Activations & Effects"
---

# Item Activations & Effects

An **activation** is everything that happens when a player clicks an item: what it costs, what it targets, what it rolls, and what shows up on the chat card. This is the most powerful part of the item sheet, so this page teaches it through two builds:

- **Frostbrand Dagger**: a weapon that deals 1d4 + Dexterity piercing damage and, *only on a hit*, an extra 1d6 cold damage.
- **Ghostwalk Draught**: a potion that heals 1d4 + 2 and turns the drinker Invisible.

The **Activation** tab appears on objects, spells, features, and monster features, and is split into three sub-tabs: **Core**, **Targets**, and **On use**. The effects that the item holds are on its own **Effects** tab: see [Item effects](effects.md#item-effects).

![The Activation tab of an item with the Core / Targets / On use sub-tab bar visible](/images/documentation/item-activation-and-effects.png)

## The Core sub-tab

- **Output item description on activation**: when on, the item's description text is printed on the chat card.
- **Activation Cost** is a number plus a unit: **Action**, **Minute**, **Hour**, **None**, **Special**, or **Turn**. The number field only appears for actions, minutes, and hours. Choosing **Special** reveals a free-text details field.
- **Is Reaction** marks the activation as a reaction and reveals a **Reaction Trigger** text field ("when an enemy leaves your reach…"). A reaction always has the **Action** unit. The number is the action cost: **1** for a usual reaction, **0** for a free reaction. When you turn on **Is Reaction** on a cost of **None**, the cost changes to **0 Action**, a free reaction. When you turn it on for a **Minute**, **Hour**, **Special** or **Turn** cost, the cost changes to **1 Action**. On a reaction, **None** changes the cost to **0 Action**, and another unit that is not **Action** clears **Is Reaction**. When you turn off **Is Reaction**, the cost stays as it is.
- **Duration**: a number plus a unit (**Action**, **Minute**, **Hour**, **None**, **Round**, **Turn**, **Special**), with a details field for special durations.

::: info Monster features are simpler
Monster feature sheets hide the Activation Cost section. A monster's action economy is handled on the monster side instead. Their Targets sub-tab gains extra fields; see below.
:::

## The Targets sub-tab

- **AoE targeting (can't miss or crit)**: turn this on for area effects. A template configuration appears where you pick a shape (circle, cone, emanation, line, or square) and its dimensions. Attacks resolved through a template share one roll across everyone caught in it, so they can neither miss nor critically hit.
- **Target Count**: how many targets the item expects (hidden when AoE targeting is on).
- **Target Restrictions**: free text shown to the user, such as "creatures that can hear you".

On items that are not monster features, **Attack with a weapon** makes the ability attack with an equipped weapon. The roll window asks which one, and the first damage node rolls that weapon's damage, with its reach or range and its damage type. Hunter abilities such as Vital Shot use it.

On monster features only, an **Attack Type** dropdown (None / Reach / Range) and a **Distance** field describe the attack's reach for the stat block. A monster attack with None is melee, because monster attacks have Reach 1 unless the stat block says otherwise (GM Guide). Every rule that is limited to melee or ranged attacks reads it so. A monster area attack (AoE targeting on) with None is neither melee nor ranged. Set Range on a ranged monster attack. On a hero item, an activation with no attack type is neither melee nor ranged.

## The On use sub-tab: the step tree

The steps that run when the item is used are built as a tree. Click the **+** button next to **On use** to add a top-level entry: **Damage**, **Healing**, **Apply Effect**, **End Conditions**, **Move**, **Pool**, **Save**, or **Wound**. Damage and Save entries can then hold child effects that trigger on specific outcomes.

Each step type has its own fields: see [On Use Steps](activation-steps.md). In short:

- [Damage](activation-steps.md#damage) rolls damage. The first damage entry is the attack roll, and its **On Critical Hit**, **On Hit** and **On Miss** buckets hold the steps for each outcome.
- [Healing](activation-steps.md#healing) gives healing or temp HP.
- [Save](activation-steps.md#save) asks for a saving throw, with **On Failed Save** and **On Passed Save** buckets.
- [Apply Effect](activation-steps.md#apply-effect), [Wound](activation-steps.md#wound) and [End Conditions](activation-steps.md#end-conditions) put an effect or Wounds on a creature, or end its conditions.
- [Move](activation-steps.md#move) gives a move for free or Forced Movement.
- [Pool](activation-steps.md#pool) changes a dice pool or a charge pool.

## Build A: the Frostbrand Dagger

1. Create an Object, set Object Type to **Weapon**, and pick your weapon properties.
2. On **Activation → Core**, set the cost to 1 **Action**.
3. On **Activation → On use**, add a **Damage** entry: formula `1d4+@dexterity`, type **Piercing**, **Can Miss** and **Can Crit** on.
4. Under that entry's **On Hit** bucket, click **+** and add a **Damage Outcome** of **Full Damage**. This is the weapon's own damage landing.
5. In the same **On Hit** bucket, add a second **Damage** entry: formula `1d6`, type **Cold**.

The placement is the point: because the cold damage sits *under On Hit*, it only appears on the chat card when the attack hits. If you instead added it as a second top-level entry (like the Flaming Longsword on the [items page](items.md)), it would be rolled and shown regardless of the attack outcome.

![The effect tree for the Frostbrand Dagger, showing the piercing damage node with a Damage Outcome and a cold damage node nested under On Hit](/images/documentation/frostbrand-dagger-effects.png)

## Build B: the Ghostwalk Draught

1. Create an Object and set Object Type to **Consumable** (size 0.5 slots is the potion convention).
2. On **Activation → Core**, set the cost to 1 **Action** and leave the description output on.
3. On **Activation → On use**, add a **Healing** entry: formula `1d4+2`, type **Healing**.
4. Add a top-level **Apply Effect** entry, and set **Who takes it** to **The creature that uses this**. Click the pen, and on **Details** pick **Invisible**.

Because the item has a healing effect, drinking it with no target selected automatically targets the drinker's own token.

## What the player sees

**The roll window.** If the activation contains any damage or healing, clicking the item opens a roll window first (spells always get one; see [Spells](spells.md)). It offers:

- a roll mode selector (advantage / disadvantage),
- an **Add to Roll** field for one-off bonuses like `2` or `1d4`,
- **Set Primary Die Result** and **Add to Primary Die Result** fields, to handle table rulings (see [The attack roll window](../playing/dice-and-chat.md#the-attack-roll-window)),
- if the character has spendable dice or charge pools, a section to click individual rolled dice or step charges to add to the roll,
- a live preview of each damage formula with references filled in,
- for GMs activating a non-player-character item, a **Hide roll** checkbox that whispers the card to GMs only,
- a **Roll** button.

Holding **Alt** while clicking the item skips the window and rolls with defaults.

![The activation roll window showing roll mode, the Add to Roll field, and the formula preview pills](/images/documentation/roll-dialog-simple-attack.png)

**The chat card.** After rolling, a card is posted with:

- the item's image, name, and (if enabled) description,
- a **targets** row: targets you had marked when activating are listed, and buttons let anyone add currently selected or targeted tokens as targets afterwards,
- each **damage roll** as a summary line with the total, an expandable breakdown, and an **Apply Damage** button that applies it to the card's targets (on a miss the roll is still shown but the apply button is disabled; half-damage outcomes halve the total),
- each **healing roll** with an **Apply Healing** button and an undo button after use,
- each **saving throw** section with a d20 button that rolls that save for all currently selected tokens, plus its "On Failed Save" / "On Successful Save" contents,
- an **Effects** part with a row for each Apply Effect, End Conditions and Wound entry. An entry for the targets has an **Apply to Targets** button. An entry for the user applies by itself and shows what it did, such as "On Grug" or "Ended on Grug". With the Feature Effects automation setting off, or with **Applies** set to **On a click**, it has an **Apply to You** button,
- any **notes**, styled by their note type.

![A chat card for the Ghostwalk Draught: the healing it gave the drinker, and the effect that went on by itself, On Grug](/images/documentation/ghostwalk-draught-chat-card.png)

## The Macro tab

Every item also has a **Macro** tab where advanced users can attach a script that runs on activation instead of, or alongside, the standard flow. See [Macros](../gm/macros.md).
## Related pages

- [On Use Steps](activation-steps.md)
- [Weapons, Armor & Gear](items.md)
- [Spells](spells.md)
- [The Condition Box](../rules-builder/predicates.md)
- [Dice & Chat](../playing/dice-and-chat.md)
