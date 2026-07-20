**Example: Dragonscale Cloak.** A cloak that reduces all incoming fire damage by 3.

- **Label** → `Dragonscale Cloak`
- **Reduction** → `3`
- **Damage types** → `Fire`

Leave **Damage types** empty to reduce every incoming hit instead. Matching reductions stack, and they apply after armor but before temporary hit points; the damage preview on a chat card's Apply Damage button already shows the reduced number. **Reduction** takes formulas (`@abilities.str.mod`) but not dice expressions.
