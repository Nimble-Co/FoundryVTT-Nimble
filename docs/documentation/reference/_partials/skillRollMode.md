**Example: Professional Skulker.** A feature that grants advantage on Stealth checks.

- **Label** → `Professional Skulker`
- **Roll mode value** → `1`
- **Apply to** → `Stealth`
- **How to apply** → `adjust`

Advantage stacks: two separate advantage rules (or a value of `2`) roll two extra dice. Negative values apply disadvantage instead, and advantage and disadvantage from different sources cancel each other one for one. Use `set` to override other sources entirely.

When mixing `set` and `adjust` rules on the same skill, order matters. Rules run in priority order, so a `set` rule that runs after an `adjust` rule discards that adjustment, while a `set` that runs before it composes normally. Use the rule priority to control which one wins.
