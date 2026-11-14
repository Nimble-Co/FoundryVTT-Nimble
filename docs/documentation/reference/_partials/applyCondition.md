**Example: Skullringer Maul.** A heavy maul that dazes whoever it critically hits.

- **Label** → `Skullringer: daze on crit`
- **Condition** → `dazed`
- **Trigger** → `onCrit`
- **Effect** → an effect of the maul with Dazed on its **Details** tab, and its Lasts Until

When the GM applies the damage of a crit, the attack's target gains the condition. With a trigger about the owner, such as `onTurnStart` or `onRest`, the character that carries the item gains the condition instead. With no **Effect**, the condition stays until someone removes it.

**Source** limits an attack trigger to weapon or spell attacks. An attack with no item counts as a weapon attack.

**Example: Doom.** A monster whose attacks also Wound the target.

- **Trigger** → `onHit`, and a second rule with `onCrit`. A crit does not count as a hit for `onHit`.
- **Wounds** → `1`
- **Condition** and **Effect** → none

The attack card gets a Wound row. When the GM applies the damage, each target that takes it gains the Wound, and the row shows "On" and the name. A creature with no Wound track, such as a monster, gains no Wound, and the row says so. With the Feature Effects automation setting off, the row keeps its **Apply to Targets** button.

With the `onSaveFail` trigger, the rule gives its condition and its Wounds when the save fails. If a reroll then turns the save into a success, the rule takes back only the condition and the Wounds that the failed save gave.
