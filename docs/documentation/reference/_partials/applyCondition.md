**Example: Skullringer Maul.** A heavy maul that dazes whoever it critically hits.

- **Label** → `Skullringer: daze on crit`
- **Condition** → `dazed`
- **Trigger** → `onCrit`
- **Effect** → an effect of the maul with Dazed on its **Details** tab, and its Lasts Until

The condition lands on the attack's target when the GM applies the damage of a crit. Self-directed triggers like `onTurnStart` or `onRest` apply the condition to the character carrying the item instead. With no **Effect**, the condition stays until someone removes it.

**Example: Doom.** A monster whose attacks also Wound the target.

- **Trigger** → `onHit`, and a second rule with `onCrit` (a crit does not count as a plain hit here)
- **Wounds** → `1`
- **Condition** and **Effect** → none

The attack card gets a Wound row. When the GM applies the damage, each target that takes it gains the Wound, and the row shows "On" and the name. A creature with no Wound track, such as a monster, takes none, and the row says so. With the Feature Effects automation setting off, the row keeps its **Apply to Targets** button.

With the `onSaveFail` trigger, the rule gives its condition and its Wounds when the save fails. When a reroll turns the result into a success, it takes back that condition and the Wounds that fail gave, and no more.
