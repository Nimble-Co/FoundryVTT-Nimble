---
title: "Rules Builder Basics"
---

# Rules Builder Basics

A **rule** is a small instruction attached to an item that changes the character carrying it. "This belt gives +2 Strength." "This blade adds 1d6 fire damage." "This ancestry trait makes you immune to being Charmed." You build rules by filling in forms: no code, no macros.

Because rules live on items, they travel with them: drag the item onto a character and the rule starts working; remove the item and the effect goes away.

## Where to find the Rules tab

The **Rules** tab appears on the sheets of these item types:

- Objects (weapons, armor, and other gear)
- Features
- Classes and subclasses
- Ancestries and backgrounds
- Boons

Spell sheets and monster feature sheets do not have a Rules tab. The tab shows a summary list of the item's rules; click **Open Rules Builder** to edit them.

![The Rules tab on an object sheet, showing the rule list and the "Open Rules Builder" button](/images/documentation/chain-shirt-item.png)

## A tour of the builder window

Click **Add Rule** to open the rule picker. Rule types are organized into six groups:

- **Bonuses** change a number on the character: stats, skills, saves, armor, speed, hit points, damage, and more.
- **Triggers** react to events in play, like applying a condition on a critical hit.
- **Grants** give the character something extra: an item, spells, proficiencies, or a movement type.
- **Conditions** interact with the condition system, like condition immunity.
- **Resources** give the item or character a pool to spend: charges, dice, or combat mana.
- **Notes** add reminders and messages without changing any numbers.

Each entry shows a short description of what it does. Pick one and a new rule card appears.

![The Add Rule picker open, showing the six groups](/images/documentation/rules-picker.png)

On each rule card you can:

- **Expand or collapse** the card with the chevron button. The window header also has expand-all and collapse-all buttons.
- **Enable or disable** the rule with the toggle button. A disabled rule is kept but does nothing. The header has enable-all and disable-all buttons too.
- **Edit raw JSON** with the code button, a plain-text view of the rule for power users. You can switch back to the builder at any time.
- **Delete** the rule with the trash button.

![The Rules Builder window open on an item, with a rule card expanded for editing](/images/documentation/rules-builder-example-item.png)

Rules are listed in the order they apply. To reorder a rule, change its **Priority** number. Dragging cards does not reorder them. Dragging a rule onto another item's rule list **copies** it there, which is handy when several items share the same effect.

## Fields every rule has

Whatever the type, every rule shares a few fields:

- **Label**: your note to yourself. It names the rule in lists, and a few rule types display it to players as the source of the effect (an Armor Class rule's label shows up in the armor breakdown; a Charge Pool's label names the pool). Write something you will recognize later.
- **Identifier**: a name other rules can refer to. For example, a Charge Consumer on one feature can spend from an actor-wide Charge Pool that another feature defined, by matching its identifier. It is only editable in the raw JSON view, and most rules can leave it empty.
- **The Condition box**: found under **Advanced** as "Applies when". It controls *when* the rule applies; leave it empty and the rule always applies. The Reroll, Change a Die, Change a Result and Primary Die Bonus rules show it in the form instead, as **Only while**. See [The Condition Box](predicates.md).
- **Priority**: the application order. Lower numbers apply first. Leave it at the default (1) unless two rules interact and you need one to win. For example, an Armor Class rule set to "override" should have a higher priority number than the rules it is meant to replace.
- **Disabled**: the on/off toggle described above.
- **Suppress activation card**: found under **Advanced**. Controls whether using the item skips its descriptive chat card. **Automatic** (the default) lets the rule decide; most rules never suppress, but a manual dice spend does, because the spend flow posts its own card. Pick **Always** for a silent feature whose activation has nothing to say, or **Never** to keep the card even when the rule would normally suppress it. A card that carries rolls or effects is never skipped, whatever this is set to.

## Rules that add to another rule

Some rules change a rule on another feature of the same character. They find that rule by its **Identifier**, so give the first rule an identifier in the raw JSON view, and type the same identifier in the second rule.

- **Modify Pool** adds to a Charge Pool or a Dice Pool: a higher maximum, a bigger die, or **Additional refills**.
- **Modify Reroll** adds to a Reroll rule. Its **Changes to the new roll** (advantage or disadvantage, extra damage) count one time per attack or check. What creatures gain (actions for the one who rolled, temp HP for the one who rolled and their allies) comes with each use of the reroll. The Songweaver's Heroic Ballad, Unfailing Courage, Fire in my Bones and Inspiring Presence are examples on Songweaver's Inspiration. It does not add to a Change a Die rule.

Some fields of these rules need a word:

- **Only while** on a charge pool refill is a condition on that one refill, tested when its trigger fires. It is not the rule's Condition box.
- **Temporary uses** on a charge pool refill makes the uses it adds last for the encounter only. They are spent first and go away when the encounter ends.
- **Reach** on a Reroll rule is how far the feature's token can be from the ally who rolled. On a Modify Reroll rule it is how far a creature can be from this character's token to gain temp HP.
- **Which dice** and **Which result stands** on a Reroll rule decide whether the whole roll, the Primary Die or a die the player picks is rolled again, and who keeps the old or the new result.
- **Which die does it change?** and **How does it change the die?** on a Change a Die rule decide whether the Primary Die or a die the player picks gets a new value, and whether the player sets the value or the rule adds a number. **Add the Primary Die bonus to the set value** shows for a set. Off (the default), the set value is the final face, so the max is a crit and 1 is a miss. On, a Primary Die bonus is added to the set value, up to the max.
- **How does it change the result?** on a Change a Result rule picks whether a save or a check succeeds, its total becomes a formula, or a formula goes on its total. **Formula** is read from the one who rolled, such as `10+@intelligence` or `@strength`. A formula that is only one stat shows that stat on the row, such as **Add +3 STR**. **Only if the total is lower** shows for a set total: the row shows only when the total is below the formula's value. The player can take the change back and gets its uses, Mana and Wounds back, so the rule needs no field for that. An action or a Heroic Reaction comes back only in the same turn. On a save or a skill check with a natural 1, an add shows, but the player cannot use it.
- **Attack Outcome** changes how an attack is read, with no choice: cannot miss, crit on less than the max, a forced crit, or any die at its max. **Make It a Crit** is a card button for the same crit. **Attacker Takes** gives damage, an effect, or both to the attacker, when the attack damages the owner or when the owner is attacked. **Only against crits** on Damage Reduction and Attacker Takes limits them to a crit.
- **Ignores armor** on Attack Outcome removes armor from the damage of the attack. **Amount** on Attacker Takes gives back the damage taken, what the attack's crit dice came to, or a formula. **Damage Recoil** is the other way: when the owner deals damage, the owner takes that damage times its **Multiplier**, ignoring armor.
- **Keep the Amount of a Hit** is a row on a hit card: the owner's next attack uses that amount, with no dice. **Demand Control** opens a window of rows when the item is used. **Free Assess** opens Assess, free and with advantage, and spends a charge when there is one. **Crit Back** gives the GM a card when a creature lives after the item's damage: the chosen attack targets the owner and is a crit. **Condition on a Hit** gives the target or the attacker a condition when the damage of the item is applied.
- **Doubled for** on a Conditional Bonus doubles its damage on the attacks of the items in its list, and **Only with no armor** limits that to a target with no armor. **Damage of an item** makes the damage option the first damage of another of the attacker's items, with its type. That damage rolls as its own damage step. It does not crit and does not keep Ignore armor. An Effect on a Die Result rule that names that item reads its first die. Turn **Starts chosen** off for a bonus the player picks on some attacks only. The roll window then starts on **None**.
- **Not when spent** on a charge pool recovery gives no charge from an attack that spent a charge from the pool. **Needs Feature Effects** turns the recovery off with Feature Effects off.
- **Only when the other creature is** on a Reroll or Change a Die rule tests the other creature of an attack: the target, or the one who rolled when the target uses the rule. It uses `target:` tags, such as `target:distracted`. **Only while** still tests the owner. See [Conditions about the target](predicates.md#conditions-about-the-target).
- **Action cost** on a Reroll, Change a Die or Change a Result rule makes a use cost 1 action, for a hero in combat. On their own turn they spend it at once. Off their turn, their next turn starts with 1 fewer action. It is not a Heroic Reaction.
- **Note on the card** on a Reroll, Change a Die or Change a Result rule is a short note under the feature in its row on the card, such as a limit that the table checks. **Show the note only when** limits it to rolls where its tags match.
- **Effect** on an Apply Condition, Mark Target or Defend Option rule picks an effect of the item. **New effect** at the end of the list makes a new effect on the item and picks it. The pen opens the effect, and the line under the list shows its Lasts Until. See [Item effects](../homebrew/effects.md#item-effects).
- **Effect** on a Mark Target rule picks an effect of the item. The marker on each target (from **Status condition**) gets that effect's image, Lasts Until, Escape, changes and rules, and the mark ends when the marker ends, for example after 1 minute. With no effect, the mark ends only when you mark another creature past **Max targets**, or by hand. A mark can also end at any time. The owner of the marking character clicks **Marked** beside the creature in the Targets list of the card that made the mark. A GM can also delete the marker effect (from **Status condition**) from the marked creature, or turn the condition off on the token HUD. That ends every mark the condition shows on that creature.

## Rules for effects and states

These rules work with the effects of an item. A state such as Rage uses them: see [Build a state such as Rage](../homebrew/effects.md#build-a-state-such-as-rage).

- **Tags** (under **Conditions**) adds tags, such as `self:raging`, while its item or effect is on the creature. Other rules read them in their Condition box. An effect such as "considered undead" is a Tags rule with `target:undead`: the system makes no tag from a monster's creature type.
- **Save on an Event** (under **Triggers**) asks the owner for a save on the card that caused the event: when a crit hits the creature, or when it takes damage. A failure ends the effect the rule is on. Concentration uses it for its DC 10 STR save on a crit.
- **Damage on escape** (under **Triggers**) works only on an effect. When the holder escapes the effect, it takes the **Damage**, and the roll card of the escape gets a line. The damage ignores armor and Defend.
- **Max Actions Bonus** (under **Bonuses**) adds to the creature's max actions while it is on, for example "+1 max action". It also works on an effect.
- **Empty pools at end** (under **Resources**) works only on an effect. When the effect ends by any path, the dice pools in **Pools** are emptied. A new use that replaces the effect is not an end.
- **0 HP at end** (under **Triggers**) works only on an effect. When the effect ends by any path, also a removal by hand, the creature drops to 0 HP. A line on the card of the end tells it, with Undo. With Feature Effects off, the line has a **Drop to 0 HP** button. A new use that replaces the effect is not an end. Dragonform uses it.
- **Change an effect** (under **Conditions**) works only on an item. **Item identifier** names another item. When that item gives an effect to this creature, **Does not end when** takes moments out of its Lasts Until, and **Also ends when** adds moments. The change occurs when the effect is made.
- **Use an item for free** (under **Triggers**) works only on an item. **Item identifier** names another item. On one of its **Triggers**, when the Condition box matches, the creature uses that item with no window. The use never spends an action. **Free of** sets what else it does not spend: **Use limits** and **Mana**, both on by default, as for a free action (Core rules). The card tells why the use was free, such as "For free: an enemy hit you with a crit (Titan's Fury)".

::: details More about these rules
- A rule that reads the tags before the other rules run needs a higher **Priority** than the Tags rule.
- Empty pools at end looks for each pool on the item that gave the effect first, then on the creature.
- With **Use limits** on, a free use does not count toward a limit such as 1/turn, and it needs no use left.
- The rule does nothing while the Feature Effects automation setting is off.
- Apply Condition uses the same list of triggers. The list has **An enemy crits you** and **You start Dying** too.
- An Apply Condition with a hit, crit or miss trigger has a row on the attack card. When the rule gives the condition as the GM applies the damage, the row says "On" and names that target in place of its **Apply to Targets** button. A click cannot give the condition a second time.
- On an attack trigger, Apply Condition has a **Source** field. **Weapon** or **Spell** limits it to attacks made with that kind of item, and **Any** counts both. Enchant Weapon uses it to give Smoldering on a weapon crit only.
- **You cast a spell** has a **Mana at least** field. The cast must cost that much mana or more. The system counts the cost after it takes off any mana the cast is free of, and the 1 mana less of a Chaos cast. A cast paid from a charge pool costs 0, and so does a cantrip. With 0, any cast counts. Primordial Force (2+ mana) uses it.
:::

## Worked example: Belt of Giant Strength

Let's build a magic belt that gives its wearer +2 Strength.

1. Create an **object** item named *Belt of Giant Strength* and open its sheet.
2. Go to the **Rules** tab and click **Open Rules Builder**.
3. Click **Add Rule**, and under **Bonuses** pick **Stat Bonus**.
4. Fill in the card:
   - **Label** → `Belt: +2 Strength`
   - **Bonus** → `2`
   - **Apply to** → `Strength`
5. Leave the Condition box empty so the bonus always applies while the belt is worn.

Drag the belt onto a character, make sure it is equipped, and their Strength rises by 2 on the spot. Take the belt off and it drops again.

![The completed Stat Bonus rule card for the Belt of Giant Strength](/images/documentation/belt-of-giant-strength-rule.png)

::: tip
The **Bonus** field also accepts formulas like `@level` instead of a plain number; see [Formulas & References](formulas.md).
:::

::: warning My rule isn't doing anything
Work through this checklist:

1. **Is the item on a character?** Rules only take effect once the item is in a character's possession. Editing an item in the sidebar or a compendium changes the template, not any character.
2. **Is the item equipped?** For gear (object items), equipping and unequipping automatically enables and disables all of the item's rules. An unequipped sword's rules do nothing.
3. **Is the rule disabled?** Check the toggle on the rule card and look for the "Disabled" badge on the Rules tab.
4. **Does the Condition box match?** Open **Advanced** on the rule card. The preview line tells you whether the conditions currently match this character. See [The Condition Box](predicates.md) for how to read it.
:::

## Related pages

- [The Condition Box](predicates.md)
- [Formulas & References](formulas.md)
- [Rules Reference: Bonuses](../reference/rules-bonuses.md)
- [Homebrew: Items](../homebrew/items.md)
