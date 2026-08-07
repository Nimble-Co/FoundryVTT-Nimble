---
title: "System Documentation"
outline: deep
---

# System Documentation

::: info Work in Progress
This section is being actively developed. Content will be added as features are documented.
:::

Documentation for the Nimble FoundryVTT system - covering gameplay mechanics, configuration, and module development.

## For Users & GMs

User-facing documentation (how to play, run games, and homebrew content with the system) lives in the [Documentation section](../documentation/index.md).

## For Module Developers

- Available hooks and events
- Data models and document structures
- Extending the system with custom content
- Automation building blocks API

## Engine Internals

- [Dice Engine](./dice-engine.md) — how `DamageRoll` and the primary-die rules work, plus the extension points for new content
- [Rules System](./rules.md) — how data-driven rules attached to items modify actors during data prep, and what's required to make a new rule type work in the Rules Builder UI
