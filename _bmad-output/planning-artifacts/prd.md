---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
inputDocuments:
  - project-context.md
  - issues.md
  - roadmap/Nimble FoundryVTT Roadmap Presentation-1.pdf
  - rules/Artificer1.md
  - rules/CoreRules-2.md
  - rules/GMguide-2.md
  - rules/Heroes-2.md
  - rules/Hexbinder1.md
workflowType: 'prd'
documentCounts:
  briefs: 0
  research: 0
  projectDocs: 1
  brainstorming: 0
classification:
  projectType: developer_tool
  domain: gaming_ttrpg_tooling
  complexity: medium
  projectContext: brownfield
---

# Product Requirements Document - dev-clean

**Author:** fronix
**Date:** 2026-03-04

## Executive Summary

The Nimble FoundryVTT system is the official virtual tabletop implementation of Nimble TTRPG, a fast, tactical, 5e-compatible tabletop RPG. It delivers a complete digital play experience — character creation, combat, spellcasting, inventory, and GM tools — while preserving the feel of playing at a physical table. Automation handles bookkeeping (mana costs, effect application, dice math) so players and GMs focus on the game, not the interface. Players remain in control of meaningful actions — particularly dice rolls — with optional settings to increase automation for groups that prefer it.

The system serves two audiences: **players** who need a responsive character sheet and clear rolling experience, and **GMs** who need efficient tools to run combat with multiple monsters, flunkies, and minions without friction.

### What Makes This Special

- **Table-feel philosophy:** Automation serves the experience, not replaces it. Players roll and choose; the system handles the consequences. This contrasts with fully-automated VTT systems where combat becomes a spectator experience.
- **Dual chat cards:** A shared chat interface that adapts by role — players get interactive actions when they need to act or receive benefits (roll saves, accept healing, trigger reactions), while GMs get combat management tools (apply damage, manage effects). The chat card is the connective tissue between player actions and GM responses.
- **Combat tracker carousel:** A shared visual turn-order for all participants.
- **GM Helper:** A separate, GM-only companion tool for managing monster and minion actions during combat — distinct from the combat tracker, purpose-built so running multiple creatures is effortless.
- **Progressive automation:** Sensible manual defaults with settings to dial up automation. The system never forces automation on players who want to roll their own dice.

## Project Classification

- **Project Type:** FoundryVTT system module (platform plugin / developer tool)
- **Domain:** TTRPG digital tooling
- **Complexity:** Medium — no regulatory requirements, but complex game rule implementation, FoundryVTT API integration, reactive Svelte 5 UI, and multi-contributor open source development
- **Project Context:** Brownfield — active development with 146 closed issues, established codebase (Svelte 5, TypeScript, Foundry v13), phased roadmap (Phase 1–4)

## Success Criteria

### User Success

**Players:**
- The interface feels natural — players don't fight the VTT to do what they want
- Bookkeeping is automated (actions deducted, mana spent, effects applied) but meaningful outcomes are clearly communicated
- Exciting moments stay manual — crits trigger a roll prompt, exploding dice let the player keep clicking, the thrill is preserved
- The system makes an already-simple game smoother and more fun, not more complex

**GMs:**
- Running large combats with many monsters/flunkies/minions is fast and manageable through the GM Helper
- Creature synergies and relevant feats are surfaced as reminders without opening individual sheets
- Solo boss encounters use the full sheet, where the GM can think and plan
- Chat cards give GMs actionable tools (apply damage, manage effects) embedded in the flow

### Business Success

- **Phase 1 / v1.0.0:** A polished, complete release that players already running sessions would recognize as "official quality" — rough edges resolved, core features solid
- **Community adoption:** The system becomes the standard way to play Nimble on FoundryVTT
- **Content readiness:** The system absorbs the upcoming Kickstarter content (200+ monsters, new classes, potential errata/new rules) without architectural rewrites

### Technical Success

- **Svelte migration:** Convert all legacy Svelte components to TypeScript (`.svelte.ts` with Svelte 5 runes)
- **Module support:** Expose hooks and APIs for third-party Foundry module integration (e.g., #353 `useItem` hook)
- **Performance:** System runs smoothly in large combat scenarios with many tokens, effects, and active UI elements
- Codebase remains maintainable and extensible for ongoing content and rule updates
- Established patterns and contribution standards (style guide, linting, type checking) keep the project accessible to community contributors
- Data models support adding new content types gracefully

### Measurable Outcomes

- All Phase 1 open issues resolved for v1.0.0 release
- GM can run combat with 8+ creatures using the GM Helper without opening individual sheets
- Player attack/spell flow completes with automatic bookkeeping and clear outcome communication
- New Kickstarter content (monsters, classes) can be added as compendium data without code changes

## User Journeys

### Journey 1: Player — Combat Session

*Meet Alex.* He's playing a level 5 Hexbinder in a weekly Nimble campaign. Tonight's session has a big encounter — a goblin warband with a dozen flunkies and a hobgoblin captain.

Alex's turn comes up on the combat carousel. He casts a spell — clicks it from his sheet, the activation dialog pops up, he sets his options and rolls. The system deducts his mana and action automatically. The chat card appears showing his roll — and the primary die is a natural max. **Crit.** The card prompts him: "Roll crit die." Alex clicks, heart racing — the crit die explodes. He clicks again. It explodes *again*. The table erupts. The final damage is massive, and the chat card clearly shows the full breakdown — the GM hits "Apply Damage" on their end.

A hobgoblin attacks Alex next round. A chat card appears on Alex's side with a prompt — he needs to roll a save. He clicks, rolls, and the result is shown. The effect either applies or doesn't, clearly communicated.

Between turns, Alex glances at his sheet — mana is tracked, active effects are visible, actions remaining are clear. He doesn't have to remember anything the system already knows.

### Journey 2: GM — Running a Horde Combat

*Meet Dana.* She's GMing for a party of 4. Tonight's encounter is 2 hobgoblin captains, 6 goblin flunkies, and 4 goblin minions — 12 creatures total.

She starts the encounter. The combat carousel populates with all combatants. She opens the GM Helper — a compact utility showing all her creatures at a glance. Each creature shows its key actions, HP, and status. One of the hobgoblin captains has a feat that gives nearby goblins advantage — the tracker surfaces a small reminder on the affected goblins.

A goblin flunky's turn comes up. Dana sees its available attacks in the tracker, picks one, rolls, and the chat card goes out with "Apply Damage" ready for the player to see their result and for Dana to resolve. She moves through the flunkies efficiently — the tracker keeps her oriented without opening a single sheet. Flunkies work just like regular monsters but can't crit, so the flow is straightforward.

The minions are even simpler — Dana can resolve them all in one swoop, or split them into groups. She sends one group of 2 minions at the fighter and another group of 2 at the mage — each group resolved as a quick batch. Splitting or combining minion groups is just as effortless as running them together.

At the end of the round, she's run 12 creature turns without friction. No scrolling through sheets, no forgetting which goblin already went, no losing track of the captain's aura.

### Journey 3: GM — Solo Boss Encounter

*Dana again,* but this time she's running a solo dragon against the same party of 4. The dragon acts after each hero's turn — 4 actions per round. This is a *thinking* encounter.

Dana doesn't use the GM Helper for this one. She has the dragon's full sheet open — its abilities, breath weapon cooldown, movement options. After each player's turn, the carousel shows the dragon's slot. Dana reviews the situation, picks an ability deliberately, and executes it. The chat cards handle the mechanical resolution — damage, saves, effects — but the tactical decisions are all hers.

This encounter is supposed to feel tense and deliberate. The system supports that by handling the mechanics cleanly, but it doesn't try to rush her through it the way the GM Helper would for a horde.

### Journey 4: Module Developer — Integrating with Nimble

*Meet Sam.* They're a Foundry module developer who wants to build an automated animation module that triggers visual effects when Nimble spells are cast.

Sam looks at the Nimble system's exposed hooks — specifically the `useItem` hook that fires when a player activates a spell or attack. They register a listener, inspect the item data to determine the spell school and element, and trigger the appropriate animation.

Sam doesn't need to understand Nimble's internals. The hook provides the data they need in a predictable format. When the Nimble system updates, the hook contract stays stable — Sam's module doesn't break.

### Journey Requirements Summary

| Journey | Capabilities Revealed |
|---|---|
| Player - Combat | Activation dialog, automatic bookkeeping (mana/actions), chat cards with player actions, crit chain interaction, exploding dice UX, save prompts, effect communication |
| GM - Horde | GM Helper utility, creature-at-a-glance view, synergy/feat reminders, quick action execution, minion grouping and splitting, chat cards with GM tools |
| GM - Solo Boss | Full monster sheet, combat carousel with boss slots after each hero, deliberate pacing support |
| Module Developer | Stable hook API (`useItem`, etc.), predictable data formats, non-breaking updates |

## FoundryVTT System Module Requirements

### Platform & Installation

The Nimble system is a FoundryVTT system module — a plugin that extends Foundry VTT with custom data models, sheets, dice mechanics, and compendium content for the Nimble TTRPG.

- **Platform:** Foundry VTT v13 (primary target). v14 support evaluated when it stabilizes — not a current priority.
- **Installation:** Standard Foundry package manager. No custom installation process.
- **Project nature:** Volunteer-driven open source, 3 active contributors, no fixed deadlines.

### Design Principles

- **Automation Toolbox:** Reusable building blocks (not hard-coded class automations) that GMs and homebrewers can use to construct custom content. Robust enough to eliminate paper tracking, light enough to not lock users into specific workflows.
- **Simple Interface:** Limit clutter, keep unnecessary information hidden. Menus and information collapsible where appropriate.
- **Nimble Aesthetic:** UI matches the look and feel of the Nimble rulebooks where practical.

### Automation Toolbox Components (Phase 2)

Reusable automation building blocks defined in the roadmap:

1. **Overhauled Dice Roller** — Pre-roll parameter editing (advantage/disadvantage, situational modifiers, primary die modification), post-roll editing and recalculation, per-die manipulation (reorder, resize, reroll, maximize, add, remove), exploding/vicious dice support
2. **Dice Pool** — Track dice quantities and values (e.g., Berserker rage dice, Oathsworn judgement dice). Configurable die size and max quantity, with add/remove/reroll/maximize/replace actions
3. **Resource / Counter** — Current/max tracking for class features (Combat Dice, Thrill of the Hunt, Elemental Surge, Lay On Hands, etc.). Reset on rest events. Other features can modify the max.
4. **Toggle Feature** — On/off switch for feature effects (passive bonuses, ad hoc conditions, shapeshift)
5. **Apply Ad Hoc Condition** — Drag-and-drop conditions onto actors as reminders for a set duration or until removed. Visual reminder, not automated mechanical enforcement.
6. **Summon Minion** — Spawn player-controlled minions (e.g., Shadowmancer). Configurable parameters (name, die size, creature size).
7. **Shapeshift** — Toggle-based form change (e.g., Stormshifter). Swap token, add/remove features on the sheet.

### Module Integration

- **Current state:** Basic hook support started (`useItem` hook, #353). Expanding based on community requests and PRs.
- **Key modules:** Tokenizer compatibility is a Phase 1 requirement. Other integrations case-by-case.
- **Approach:** Expose stable hooks and data contracts. No proactive API design — respond to community needs.

### Documentation

- **User wiki:** Planned post-v1.0.0, covering setup, gameplay features, and GM tools.
- **Developer docs:** Module developers rely on hooks and source code. No dedicated API docs currently planned.

### Implementation Considerations

- **Nimble's unique dice system** is the core technical challenge — dice rolls vary widely across classes, monsters, and abilities. What's easy at a physical table (e.g., "roll an extra die and keep the highest") requires careful UI/UX design in a VTT.
- **Homebrewing support** is first-class — the automation toolbox must be accessible to non-developer GMs creating custom content.
- **Content pipeline** must handle ongoing rulebook updates, Kickstarter content (200+ monsters, new classes), and potential errata without code changes where possible.

## Phased Development

### MVP Strategy

**Approach:** Problem-solving MVP — deliver a polished, complete play experience for the Nimble rules that exist today. People are already running sessions; v1.0.0 makes that experience official-quality.

**Resource Reality:** 3 active contributors, volunteer basis, no deadlines. Scope must be realistic — prioritize finishing and polishing over adding new capabilities.

### Phase 1 — MVP (v1.0.0)

**Core Journeys Supported:**
- Player combat flow (attack, damage, crit, defend — using current dice roller)
- GM combat management (combat tracker carousel, basic GM Helper)
- Character creation and level-up (existing flows, polished)

**Must-Have Capabilities:**
- Character sheet — all values manually editable, edit/lock polish (#203), token/character art separation (#153)
- Monster/NPC sheets — functional and complete
- Combat tracker carousel — reliable turn order, side-based initiative, solo boss slots after each hero
- Chat cards — redesigned with role-based actions. Requires UX design to determine must-have actions (apply damage, roll saves, crit prompts at minimum). (#358, #364)
- GM Helper v1 — usable for horde combat, showing creature actions/HP/status at a glance. Not feature-complete but not discardable.
- Damage/healing application via chat cards
- Basic dice roller (current implementation, not the overhauled version)
- Complete core compendium (ancestries, backgrounds, boons, classes, subclasses, features, items, monsters, spells, tables)
- Tokenizer compatibility (#19, #153)
- Remaining Phase 1 bug fixes (#369, #311, #309, #13, #9, #11)

**Explicitly NOT Phase 1:**
- Overhauled dice roller (too complex for v1.0.0)
- Automation toolbox
- Spell/feature automation (#365)
- Class resource tracking (#232)

### Phase 2 — Automation

- Overhauled dice roller with full per-die manipulation
- Automation toolbox (dice pool, resource/counter, toggle feature, ad hoc conditions, summon minion, shapeshift)
- Passive bonuses from ancestries, backgrounds, boons
- Class level progression mapping
- GM Helper — full feature set (synergy reminders, complete creature management)
- Chat cards — advanced interactions (crit chain UX, parry, assess)
- Spell/feature/skill automation (#365 epic)
- Key module integrations
- "Starred" tab for quick access to favorite items/features/spells
- 5e statblock converter (#329)
- Active effects creation/editing (#333)
- Major bug fixes

### Phase 3 — Final Polish

- Variant rules settings (gritty dying, critical healing, etc.)
- Convenience features and shortcuts
- Robust settings menu
- More module integrations
- Custom languages and aliases (#85)
- Multi-class level-up (#88)
- HUD elements (#251)
- Minor bug fixes

### Phase 4 — What's Next

- Kickstarter content (200+ monsters, new classes, errata, possible new rules)
- Adventure modules
- Patreon content module
- 3rd party content support
- Wiki documentation

### Risk Mitigation

**Technical Risks:**
- *Chat card design* — biggest Phase 1 unknown. Must-have actions not fully defined. **Mitigation:** UX design chat cards early; prototype with the team before building.
- *GM Helper v1 scope* — risk of over- or under-building. **Mitigation:** Define minimum viable tracker (creature list with HP, actions, status) and ship that. Iterate in Phase 2.
- *Dice roller overhaul complexity* — deferred to Phase 2 intentionally. **Mitigation:** Keep current roller stable in Phase 1; design the overhaul architecture without building it.

**Resource Risks:**
- *3 active volunteers* — any contributor stepping away impacts delivery significantly. **Mitigation:** Keep Phase 1 scope tight. Document architecture and patterns so new contributors can onboard.
- *Kickstarter content timing* — 200+ monsters and new classes could land before the system is ready. **Mitigation:** Ensure compendium pipeline handles bulk additions. Phase 4 is the explicit catch-all.

**Market Risks:**
- *Community expectations* — players already using the system may expect faster progress. **Mitigation:** Communicate the roadmap openly. Ship incremental improvements rather than waiting for big-bang releases.

## Functional Requirements

### Character Management

- FR1: Players can create a character through a guided creation process (ancestry, background, class, ability scores, equipment)
- FR2: Players can view and manually edit all character sheet values (stats, HP, mana, skills, etc.)
- FR3: Players can level up through a guided dialog (class features, skill points, HP roll or average)
- FR4: Players can set separate images for character portrait and token art
- FR5: Players can lock/unlock their character sheet to prevent accidental edits during play
- FR6: Players can manage inventory (add, remove, reorder, equip/unequip items)
- FR7: Players can view active effects and conditions on their character
- FR8: Players can manage their spell list (view, prepare, track mana)
- FR9: GMs can create and edit monster/NPC sheets with all relevant stats, features, and attacks

### Dice Rolling & Combat Actions

- FR10: Players can initiate attacks and spells from their character sheet via an activation dialog with roll options (advantage/disadvantage, situational modifiers, primary die modifier)
- FR11: System automatically deducts actions and mana when a player uses an ability or spell
- FR12: Players can roll crit dice manually when a crit is triggered, with support for exploding dice (roll again on max)
- FR13: System determines hit, miss, and crit results based on Nimble's primary die rules
- FR14: GMs can initiate attacks and abilities from monster/NPC sheets
- FR15: Players can roll initiative from their character sheet
- FR16: System applies effects to targets when spells or abilities trigger them

### Chat Cards

- FR17: Chat cards display roll results with relevant outcome information (damage, hit/miss/crit, effects)
- FR18: GMs can apply damage to targets directly from chat cards
- FR19: GMs can apply healing to targets directly from chat cards
- FR20: Players can interact with chat cards when action is required (roll saves, accept effects, roll crit dice)
- FR21: Chat cards display different action options based on viewer role (player vs GM)
- FR22: Only the hit/miss die displays in red, not other dice (#364)

### Combat Tracker

- FR23: GMs can start, manage, and end combat encounters
- FR24: Combat tracker displays turn order as a visual carousel
- FR25: System handles side-based initiative with correct sorting
- FR26: System inserts solo boss turns after each hero's turn in the turn order
- FR27: GMs can add and remove combatants from the encounter
- FR28: Combat tracker groups minions into shared turns
- FR29: GMs can track actions remaining per combatant during their turn
- FR30: Combat tracker displays in configurable positions (left, right, top, bottom)

### GM Helper

- FR31: GMs can view all creatures in a compact utility showing key info at a glance (HP, actions, status)
- FR32: GMs can execute creature actions from the GM Helper without opening individual sheets
- FR33: GM Helper surfaces relevant feat synergies between creatures as reminders
- FR34: GMs can split minions into groups and resolve each group's actions separately
- FR35: GMs can resolve all minions in a single group action

### Compendium & Content

- FR36: System provides a complete compendium of core Nimble content (ancestries, backgrounds, boons, classes, subclasses, class features, items, monsters, spells, tables)
- FR37: GMs can drag compendium content onto character sheets or into the world
- FR38: GMs can create custom homebrew content using the same data structures as official content
- FR39: New compendium content (monsters, classes, spells) can be added as data without code changes

### Rest & Recovery

- FR40: Players can perform a Safe Rest, resetting relevant resources (HP, mana, hit dice, class resources)
- FR41: Players can perform a Field Rest, spending hit dice to recover HP

### Module & System Integration

- FR42: System exposes hooks for key events (item activation, combat events) that third-party modules can listen to
- FR43: System works correctly with the Tokenizer module for token art management
- FR44: GMs can configure system settings to customize behavior (automation level, display options)

### Automation Toolbox (Phase 2)

- FR45: GMs and homebrewers can attach reusable automation building blocks to features and items (dice pools, resource counters, toggle effects, ad hoc conditions)
- FR46: Players can manage dice pools (add, remove, reroll, maximize, replace dice) for class features that require them (Berserker, Oathsworn)
- FR47: System tracks resource counters (current/max) on class features, with reset on rest events
- FR48: Players can toggle features on/off, triggering associated effects (passive bonuses, conditions, shapeshift)
- FR49: Players and GMs can apply ad hoc conditions to actors as visual reminders for a set duration
- FR50: Players can summon minions from class features, spawning configurable creatures they control
- FR51: Players can shapeshift via toggle features, swapping token art and adding/removing features

### Advanced Dice Roller (Phase 2)

- FR52: Players can edit roll parameters before confirming (advantage/disadvantage, per-die options, situational modifiers)
- FR53: Players can edit roll results after rolling and recalculate outcomes
- FR54: Players can manipulate individual dice in a roll (reorder, resize, reroll, maximize, minimize, add, remove)
- FR55: System handles Nimble-specific dice mechanics (vicious attacks, exploding dice, primary die assignment, drop dice for advantage/disadvantage)

## Non-Functional Requirements

### Performance

- NFR1: Character sheet interactions (opening tabs, editing fields, toggling features) render within 200ms
- NFR2: Dice rolls resolve and display results in chat within 500ms of user action
- NFR3: Chat card actions (apply damage, roll saves) complete within 300ms
- NFR4: Combat tracker carousel updates turn order within 200ms of turn advancement
- NFR5: GM Helper handles 20+ creatures simultaneously without UI lag (>60fps scrolling, <100ms action response)
- NFR6: System does not degrade FoundryVTT baseline performance — world load time increase stays under 10%
- NFR7: Minion batch resolution completes within 1 second regardless of group size

### Integration

- NFR8: System is fully compatible with FoundryVTT v13 API — no deprecated API usage
- NFR9: Module API exposes documented hooks and data access points for third-party module developers
- NFR10: Character and item data survives system updates — migration scripts handle schema changes without data loss
- NFR11: System is installable via standard FoundryVTT package manager with no manual setup steps
- NFR12: All Svelte components migrated to TypeScript with strict type checking enabled

### Accessibility

- NFR13: Critical sheet actions (rolling, toggling) support optional keyboard shortcuts where feasible, but full keyboard-only navigation is not a requirement
- NFR14: Critical game information (HP, conditions, turn order) has sufficient color contrast (WCAG AA minimum)
