---
title: "Epics & Stories"
outline: deep
---

::: warning AI-Generated Content
This document was primarily generated with AI assistance. Since this is a community-driven project with contributors having limited time, AI helps accelerate documentation and planning work.
:::

::: info Planning in Progress
All planning documents are not final and are actively under construction. Details may change significantly as the project evolves.
:::

# Nimble System - Epic Breakdown

## Overview

This document provides the epic and story breakdown for the Nimble system, decomposing the requirements from the PRD, UX Design, and Architecture into implementable work. Stories serve as reference for *what the system does and should do* — not as a live progress tracker. See GitHub issues for current work status.

## Epic List

### Epic 1: Character Sheet & Management ✅
Players can create, level up, and manage their characters with a polished, lockable sheet - all values editable, inventory manageable, spells trackable, effects visible.
*Status: Core complete. Character creation, level-up, sheets, inventory, spells, conditions all shipped.*

### Epic 2: Monster & NPC Management ✅
GMs can create and manage monster/NPC sheets with all stats, features, and attacks ready for play.
*Status: Complete. NPC, Minion, and Solo Monster sheets all functional.*

### Epic 3: Dice Rolling & Combat Resolution ✅ (Phase 2: Advanced Roller)
Players and GMs can initiate attacks/spells from sheets, roll dice with Nimble's unique mechanics (primary die, crits, exploding dice), and see clear results with automatic bookkeeping (mana, actions, effects).
*Status: Core activation flow complete. Phase 2 adds overhauled per-die manipulation roller.*

### Epic 4: Chat Card Interaction System 🔨 (Phase 2)
Chat cards serve as the shared resolution workspace - displaying results with role-based actions (GM applies damage/healing, players roll saves/react), progressive state evolution, target management, and undo/revert.
*Status: 12+ card types shipped. Phase 2 focus: interactive layer (role-based actions, defend reactions, target management, undo/snapshot).*

### Epic 5: Combat Tracker & Turn Management ✅
GMs can run structured combat with a visual carousel showing turn order, side-based initiative, solo boss interleaving, minion grouping, and per-combatant action tracking.
*Status: Complete. Carousel with all features shipped.*

### Epic 6: GM Helper - Horde Combat Management 📋 (Phase 2)
GMs can manage multi-creature encounters efficiently through a compact utility showing all creatures at a glance, with quick action execution, synergy reminders, and minion batch operations.
*Status: Not started. Architectural pattern defined (dockable ApplicationV2).*

### Epic 7: Compendium, Content & System Integration ✅
System provides complete Nimble compendium content, supports homebrew creation, enables rest/recovery, exposes module hooks, and offers configurable settings.
*Status: Core complete. 14 compendium packs, rest system, useItem hook, Tokenizer compatibility all shipped.*

### Epic 8: Automation Toolbox & Advanced Dice Roller 📋 (Phase 2)
GMs and homebrewers can attach reusable automation building blocks to content (dice pools, counters, toggles, conditions, summon, shapeshift), and players get full per-die manipulation in an overhauled dice roller.
*Status: Rules engine foundation ready (21+ rule types). Building blocks and advanced roller are Phase 2 work.*

---

## Epic 1: Character Sheet & Management

Players can create, level up, and manage their characters with a polished, lockable sheet - all values editable, inventory manageable, spells trackable, effects visible.

### Story 1.1: Character Creation Flow Polish

As a player,
I want a guided character creation process that walks me through ancestry, background, class, ability scores, and equipment,
So that I can build a new character without consulting the rulebook.

**Acceptance Criteria:**

**Given** a player opens the character creation dialog
**When** they complete each step (ancestry → background → class → ability scores → equipment)
**Then** the character is created with all selections applied correctly

**Given** a player selects an ancestry
**When** they proceed
**Then** ancestry traits and stat modifiers are applied to the character

**Given** creation is complete
**When** the character sheet opens
**Then** all values (HP, mana, skills, equipment) reflect the creation choices

### Story 1.2: Character Sheet Edit & Lock Mode

As a player,
I want to lock my character sheet during play to prevent accidental edits, and unlock it when I need to make changes,
So that I don't accidentally alter my stats mid-combat.

**Acceptance Criteria:**

**Given** a character sheet is open
**When** the player clicks the lock button
**Then** all editable fields become read-only

**Given** a locked sheet
**When** the player clicks unlock
**Then** fields become editable again

**Given** a locked sheet
**When** the player attempts to edit a value
**Then** the edit is prevented and the lock state is visually clear

### Story 1.3: Portrait & Token Art Separation

As a player,
I want separate images for my character portrait and token art,
So that my sheet shows my full character art while my token on the map can be a different image.

**Acceptance Criteria:**

**Given** a character sheet
**When** the player sets a portrait image
**Then** it displays on the sheet header

**Given** a character sheet
**When** the player sets a token image separately
**Then** the token on the canvas uses that image, not the portrait

**Given** Tokenizer module is active
**When** the player manages token art
**Then** the system works correctly with Tokenizer (FR43)

### Story 1.4: Inventory Management

As a player,
I want to add, remove, reorder, and equip/unequip items on my character,
So that I can manage my gear during sessions.

**Acceptance Criteria:**

**Given** a character sheet inventory tab
**When** the player drags an item from compendium
**Then** the item is added to inventory

**Given** inventory items
**When** the player reorders them via drag
**Then** the order persists

**Given** an equippable item
**When** the player toggles equip/unequip
**Then** the item's effects are applied or removed

### Story 1.5: Spell List & Mana Tracking

As a player,
I want to view my spell list, see mana costs, and track mana usage,
So that I know what spells I can cast and how much mana I have left.

**Acceptance Criteria:**

**Given** a character with spells
**When** the player opens the spells tab
**Then** all known spells are listed with mana cost, range, and damage type

**Given** a spell is cast
**When** mana is deducted (FR11)
**Then** the mana display updates immediately on the sheet

**Given** a character at 0 mana
**When** viewing the spell list
**Then** spells requiring mana are visually indicated as uncastable

### Story 1.6: Active Effects & Conditions Display

As a player,
I want to see all active effects and conditions on my character without opening a sub-menu,
So that I always know my current status.

**Acceptance Criteria:**

**Given** a character with active conditions
**When** viewing the sheet
**Then** condition badges are visible on the sheet (above tabs, always visible)

**Given** a condition badge
**When** hovering
**Then** a tooltip shows condition name, description, and remaining duration

**Given** conditions are color-coded
**Then** debuffs and buffs are visually distinct
**And** text labels accompany colors (color independence)

### Story 1.7: Level-Up Flow

As a player,
I want to level up through a guided dialog that handles class feature selection, skill points, and HP (roll or average),
So that leveling up is quick and correct.

**Acceptance Criteria:**

**Given** a character eligible to level up
**When** the player initiates level-up
**Then** a dialog guides them through class feature choices, skill point allocation, and HP gain

**Given** the HP step
**When** the player chooses to roll
**Then** they roll and see the result before confirming

**Given** the HP step
**When** the player chooses average
**Then** the average value is applied automatically

**Given** level-up is complete
**When** the dialog closes
**Then** all new features, HP, and skill points are applied to the character

---

## Epic 2: Monster & NPC Management

GMs can create and manage monster/NPC sheets with all stats, features, and attacks ready for play.

### Story 2.1: Monster/NPC Sheet Creation & Editing

As a GM,
I want to create and edit monster/NPC sheets with all relevant stats, features, attacks, and abilities,
So that I have fully functional creatures ready for encounters.

**Acceptance Criteria:**

**Given** a GM creates a new NPC actor
**When** choosing the actor type (NPC, minion)
**Then** the appropriate sheet opens with all required fields

**Given** a monster sheet
**When** the GM edits stats (HP, armor, speed, abilities)
**Then** values persist and derived values recalculate

**Given** a monster sheet
**When** the GM adds attacks and features (drag from compendium or create inline)
**Then** they appear on the sheet and are usable in combat

**Given** a monster with armor type (None, Medium, Heavy)
**When** viewing the sheet
**Then** the armor type is clearly displayed with its mechanical effect

**Given** a minion-type actor
**When** viewing the sheet
**Then** minion-specific rules are reflected (no crits, simplified stats)

---

## Epic 3: Dice Rolling & Combat Resolution

Players and GMs can initiate attacks/spells from sheets, roll dice with Nimble's unique mechanics (primary die, crits, exploding dice), and see clear results with automatic bookkeeping (mana, actions, effects).

### Story 3.1: Attack & Spell Activation Dialog

As a player,
I want to click an attack or spell on my sheet and see an activation dialog with roll options (advantage/disadvantage, situational modifiers, primary die modifier),
So that I can configure my roll before committing.

**Acceptance Criteria:**

**Given** a character sheet with attacks/spells
**When** the player clicks an ability
**Then** the ItemActivationConfigDialog opens

**Given** the activation dialog
**When** the player adjusts the roll mode slider
**Then** advantage/disadvantage level (-6 to +6) is reflected in the roll

**Given** the dialog
**When** the player adds a situational modifier formula
**Then** it is included in the roll calculation

**Given** the dialog
**When** the player confirms
**Then** a chat message is created with the roll result and the dialog closes

### Story 3.2: Automatic Bookkeeping on Activation

As a player,
I want the system to automatically deduct mana and actions when I use a spell or ability,
So that I don't have to manually track resource costs.

**Acceptance Criteria:**

**Given** a player casts a spell costing 2 mana
**When** the roll is confirmed
**Then** 2 mana is deducted from the character

**Given** a player uses an action
**When** confirmed
**Then** the action is marked as used on the combatant's action economy (if in combat)

**Given** a player at 0 mana
**When** attempting to cast a spell requiring mana
**Then** the system warns or prevents the cast (configurable)

### Story 3.3: Hit, Miss & Crit Determination

As a player,
I want the system to determine hit, miss, and crit based on Nimble's primary die rules,
So that the result is immediately clear without manual interpretation.

**Acceptance Criteria:**

**Given** a roll where the primary die (leftmost) is not 1 and not max
**When** the result displays
**Then** it shows "Hit" with the full damage total

**Given** a roll where the primary die is 1
**When** the result displays
**Then** it shows "Miss" with muted styling and no damage applied

**Given** a roll where the primary die is max
**When** the result displays
**Then** it shows "Critical Hit" with crit styling and the crit chain is initiated

**Given** the primary die
**When** rendering dice
**Then** only the primary die has distinct styling (FR22), other dice render normally

### Story 3.4: Crit Chain - Exploding Dice

As a player,
I want to manually roll crit dice when I crit, with each max result exploding into another roll,
So that crit chains feel exciting and I stay in control.

**Acceptance Criteria:**

**Given** a critical hit
**When** the chat card appears
**Then** a "Roll Again!" button is prominent on the card

**Given** the player clicks "Roll Again!"
**When** the crit die result is max
**Then** it explodes - the roll appends to the chain and "Roll Again!" appears again

**Given** the crit chain
**When** each roll is added
**Then** a running total is displayed and visual intensity increases

**Given** the crit die result is not max
**When** the chain ends
**Then** the final total is shown and the card transitions to the apply state

**Given** `prefers-reduced-motion`
**When** rendering the crit chain
**Then** animations are disabled, instant reveal instead

### Story 3.5: GM Attack & Ability Execution

As a GM,
I want to initiate attacks and abilities from monster/NPC sheets,
So that I can act on behalf of creatures during combat.

**Acceptance Criteria:**

**Given** a monster sheet with attacks
**When** the GM clicks an attack
**Then** the activation dialog opens (same pattern as player)

**Given** the GM confirms a roll
**When** the chat card appears
**Then** it shows the monster's roll with the same hit/miss/crit logic

**Given** a monster attack hits a player character
**When** the card renders for the target player
**Then** the Defend reaction prompt appears (Epic 4 dependency - card just shows result if Defend not yet implemented)

### Story 3.6: Initiative Rolling

As a player,
I want to roll initiative from my character sheet,
So that combat turn order is determined.

**Acceptance Criteria:**

**Given** a character sheet
**When** the player clicks "Roll Initiative"
**Then** an initiative roll is made using Nimble's side-based initiative rules

**Given** the initiative roll result
**When** combat is active
**Then** the combatant's starting action count is set based on the roll

### Story 3.7: Effect Application to Targets

As a player or GM,
I want the system to apply effects to targets when spells or abilities trigger them,
So that conditions and ongoing effects are tracked automatically.

**Acceptance Criteria:**

**Given** a spell with an effect (e.g., Burning condition)
**When** the spell hits and the target fails a save (if applicable)
**Then** the condition is applied to the target actor

**Given** an effect with a duration
**When** applied
**Then** the duration is tracked and the effect expires appropriately

**Given** an effect is applied
**When** viewing the target's sheet
**Then** the condition badge appears in the conditions bar

---

## Epic 4: Chat Card Interaction System

Chat cards serve as the shared resolution workspace - displaying results with role-based actions (GM applies damage/healing, players roll saves/react), progressive state evolution, target management, and undo/revert.

### Story 4.1: Chat Card Roll Result Display

As a player or GM,
I want chat cards to clearly display roll results with hit/miss/crit outcome, damage total, damage type, and dice breakdown,
So that everyone understands what happened.

**Acceptance Criteria:**

**Given** a roll is made
**When** the chat card renders
**Then** it shows: primary die highlighted, all dice values, damage total, damage type, and hit/miss/crit label

**Given** a miss
**When** rendering
**Then** primary die has miss styling, other dice are faded, "MISS" text is shown, and no Apply button appears

**Given** a crit
**When** rendering
**Then** "CRIT!" tag in header, gold/amber styling, crit chain section visible

**Given** dice details
**When** the expand toggle is clicked
**Then** full dice breakdown shows/hides (respecting `autoExpandRolls` setting)

### Story 4.2: Target Management on Chat Cards

As a GM,
I want to manage targets on chat cards (add selected tokens, add targeted tokens, remove individual targets),
So that I can direct damage and effects to the right creatures.

**Acceptance Criteria:**

**Given** a chat card
**When** the GM clicks "+ Selected"
**Then** all currently selected canvas tokens are added as targets

**Given** a chat card
**When** the GM clicks "◎ Targeted"
**Then** all user-targeted tokens are added as targets

**Given** a target on the card
**When** the GM clicks the remove (✕) button
**Then** that target is removed

**Given** a target row
**When** hovering
**Then** the corresponding token highlights on the canvas

**Given** no targets selected
**When** viewing the card
**Then** "No targets selected" is shown and Apply buttons are disabled

### Story 4.3: GM Apply Damage with Undo

As a GM,
I want to apply damage to targets from chat cards and undo if I make a mistake,
So that combat resolution is fast and correctable.

**Acceptance Criteria:**

**Given** a chat card with targets and a hit result
**When** the GM clicks "Apply Damage"
**Then** damage is applied to all targets (subtracting from temp HP first, then HP)

**Given** damage is applied
**When** the card updates
**Then** it shows per-target HP before → after, with death/bloodied badges if thresholds crossed

**Given** damage was applied
**When** the GM clicks "↩ Undo"
**Then** target HP is restored to snapshot values recorded at apply time

**Given** a miss result
**When** viewing the card
**Then** no Apply Damage button is shown

### Story 4.4: GM Apply Healing with Undo

As a GM or player,
I want to apply healing from chat cards to targets and undo if needed,
So that healing resolution is quick and reversible.

**Acceptance Criteria:**

**Given** a healing chat card with targets
**When** the authorized user clicks "Apply Healing"
**Then** healing is applied to all targets

**Given** healing is applied
**When** the card updates
**Then** green confirmation banner shows with per-target HP breakdown (before → after)

**Given** healing was applied
**When** the user clicks "↩ Undo"
**Then** HP is restored to snapshot values

**Given** no targets selected
**When** viewing Apply Healing
**Then** the button is disabled with a tooltip explaining why

### Story 4.5: Role-Based Chat Card Actions

As a player,
I want to see only the actions relevant to me on chat cards (roll saves, react to attacks, roll crit dice), while GM-only actions are hidden from my view,
So that the interface is clean and clear.

**Acceptance Criteria:**

**Given** a player viewing a chat card
**When** the card has GM-only actions (Apply Damage, target management)
**Then** those actions are hidden (not disabled)

**Given** a GM viewing the same card
**When** the card has player-only actions (Defend, roll save)
**Then** those actions are hidden from the GM

**Given** a player who needs to act (e.g., roll a save)
**When** viewing the card
**Then** the action button is visible and prominent

### Story 4.6: Defend Reaction Prompt

As a player,
I want to see a Defend prompt on monster attack chat cards that shows the exact math (incoming damage, my armor, result if I defend, action cost),
So that I can make an informed tactical decision.

**Acceptance Criteria:**

**Given** a monster attack hits my character
**When** the chat card renders on my client
**Then** a Defend section appears showing: incoming damage, my armor value, damage after defending, and action cost ("Costs 1 action - you'll have N actions next turn")

**Given** the Defend prompt
**When** I click "Defend"
**Then** my defend response is recorded, damage is reduced by armor, and 1 action is deducted from my next turn

**Given** the Defend prompt
**When** I click "Take It"
**Then** full damage stands and no action is spent

**Given** the defend response is submitted
**When** all clients re-render
**Then** original damage is struck through, reduced value is shown, and the GM sees the post-Defend amount ready to apply

### Story 4.7: Saving Throw & Condition Chat Card Nodes

As a player,
I want to see saving throw prompts and condition effects on chat cards,
So that I can roll saves and understand what happens on pass/fail.

**Acceptance Criteria:**

**Given** a spell requiring a save
**When** the chat card renders
**Then** a saving throw section shows with the save type and a "Roll Save" button

**Given** the "Roll Save" button
**When** clicked
**Then** saving throws are rolled for all selected tokens

**Given** a saving throw node
**When** rendered
**Then** pass/fail branches are visible with their respective effects (damage amounts, conditions)

**Given** a condition in the effect tree
**When** rendered
**Then** it appears as a clickable pill with rich tooltip (name, description, "left click to apply to selected tokens")

**Given** a condition pill
**When** clicked
**Then** the condition is toggled on all selected tokens

### Story 4.8: Primary Die Color Distinction

As a player,
I want only the primary die (hit/miss die) to display with distinct styling, not all dice,
So that I can immediately identify which die determined the outcome.

**Acceptance Criteria:**

**Given** a roll result on a chat card
**When** rendered
**Then** only the primary die (leftmost) has accent/colored styling

**Given** other dice in the roll
**When** rendered
**Then** they use neutral styling

**Given** a miss (primary die = 1)
**When** rendered
**Then** the primary die shows miss color, other dice are faded

---

## Epic 5: Combat Tracker & Turn Management

GMs can run structured combat with a visual carousel showing turn order, side-based initiative, solo boss interleaving, minion grouping, and per-combatant action tracking.

### Story 5.1: Combat Encounter Lifecycle

As a GM,
I want to start, manage, and end combat encounters,
So that I have structured turn-based combat.

**Acceptance Criteria:**

**Given** a scene with tokens
**When** the GM starts combat
**Then** a combat encounter is created and combatants are added

**Given** an active combat
**When** the GM advances turns
**Then** the active combatant changes and the carousel updates within 200ms

**Given** an active combat
**When** the GM ends combat
**Then** the encounter is resolved and combat state is cleared

### Story 5.2: Visual Carousel Turn Order

As a player or GM,
I want to see turn order as a visual carousel showing all combatants,
So that everyone knows whose turn it is and who's next.

**Acceptance Criteria:**

**Given** active combat
**When** the carousel renders
**Then** all combatants are shown with token images and the active turn is highlighted

**Given** the carousel
**When** displayed
**Then** it renders in the configured position (left, right, top, bottom - FR30)

**Given** a combatant's turn ends
**When** the next turn begins
**Then** the carousel scrolls/transitions to the new active combatant

### Story 5.3: Side-Based Initiative & Sorting

As a GM,
I want the system to handle side-based initiative with correct turn order sorting,
So that heroes go first and monsters go second within each round.

**Acceptance Criteria:**

**Given** combat starts
**When** initiative is rolled
**Then** heroes are grouped on one side, monsters on the other, sorted by initiative within each side

**Given** a hero's initiative roll result
**When** applied
**Then** it determines the hero's starting action count for their first turn

### Story 5.4: Solo Boss Turn Interleaving

As a GM,
I want solo boss creatures to act after each hero's turn,
So that boss encounters feel dynamic and threatening.

**Acceptance Criteria:**

**Given** a solo boss in combat
**When** turn order is calculated
**Then** a boss turn slot appears after each hero's turn

**Given** the carousel
**When** rendered with a solo boss
**Then** boss slots are visually distinct and appear interleaved with hero turns

### Story 5.5: Add/Remove Combatants

As a GM,
I want to add and remove combatants from an active encounter,
So that I can handle reinforcements and fleeing creatures.

**Acceptance Criteria:**

**Given** active combat
**When** the GM adds a token to combat
**Then** the combatant appears in the correct initiative position

**Given** active combat
**When** the GM removes a combatant
**Then** they are removed from the carousel and turn order adjusts

### Story 5.6: Minion Turn Grouping

As a GM,
I want minions grouped into shared turns on the combat tracker,
So that I can resolve multiple minions efficiently.

**Acceptance Criteria:**

**Given** minion-type combatants
**When** added to combat
**Then** they are grouped into a shared turn slot

**Given** a minion group turn
**When** active
**Then** the carousel shows the group as a single entry with a count indicator

### Story 5.7: Action Economy Tracking

As a GM,
I want to track actions remaining per combatant during their turn,
So that I know how many actions each creature has left.

**Acceptance Criteria:**

**Given** a combatant's turn begins
**When** their action budget is calculated
**Then** it reflects base actions (3 for heroes) modified by initiative, features, effects, and reactions spent since last turn

**Given** a combatant uses an action
**When** the action count updates
**Then** the display shows filled (available) and faded (used) pips

**Given** a reaction is spent on another creature's turn
**When** viewing the reacting combatant
**Then** the reaction cost is reflected in their next turn's action budget

**Given** action economy data
**Then** it is stored on the combatant document (not actor) as combat-specific state

---

## Epic 6: GM Helper - Horde Combat Management

GMs can manage multi-creature encounters efficiently through a compact utility showing all creatures at a glance, with quick action execution, synergy reminders, and minion batch operations.

### Story 6.1: GM Helper Application Shell

As a GM,
I want a GM Helper utility that opens as a dockable window (standalone or sidebar),
So that I can keep it visible alongside the map during combat.

**Acceptance Criteria:**

**Given** the GM
**When** they open the GM Helper
**Then** it renders as a `SvelteApplicationMixin(ApplicationV2)` window

**Given** the GM Helper
**When** no combat is active
**Then** it shows all NPC/monster tokens in the current scene (context-aware out-of-combat mode)

**Given** the GM Helper
**When** combat is active
**Then** it filters to show only current combatants

**Given** the GM Helper at narrow width
**When** rendered alongside the map
**Then** content remains usable without horizontal overflow

### Story 6.2: Creature Overview Rows

As a GM,
I want to see all creatures in a compact list showing HP, actions, status, and key info at a glance,
So that I can manage a horde without opening individual sheets.

**Acceptance Criteria:**

**Given** the GM Helper in combat
**When** rendered
**Then** each creature is a single dense row showing: name, HP, conditions, and available actions

**Given** a creature row
**When** clicked
**Then** it expands to show full action list and features

**Given** 20+ creatures
**When** scrolling the list
**Then** performance stays above 60fps with <100ms action response (NFR5)

### Story 6.3: Execute Actions from GM Helper

As a GM,
I want to execute creature attacks and abilities directly from the GM Helper,
So that I never need to open a creature's full sheet during horde combat.

**Acceptance Criteria:**

**Given** an expanded creature row
**When** the GM clicks an attack/ability
**Then** the activation dialog opens (same flow as sheet-based activation)

**Given** the action is confirmed
**When** the chat card is created
**Then** the GM Helper remains open and focused

### Story 6.4: Feat Synergy Reminders

As a GM,
I want the GM Helper to surface relevant feat synergies between creatures,
So that I remember to use auras and group tactics.

**Acceptance Criteria:**

**Given** a creature with a feat affecting nearby allies (e.g., "nearby goblins get advantage")
**When** the GM Helper renders affected creatures
**Then** a small reminder indicator appears on those creature rows

**Given** the reminder indicator
**When** hovered
**Then** a tooltip shows the source feat and its effect

### Story 6.5: Minion Group Management

As a GM,
I want to split minions into groups and resolve each group separately, or resolve all minions in a single batch,
So that minion management is effortless.

**Acceptance Criteria:**

**Given** minion combatants
**When** viewing them in GM Helper
**Then** they can be grouped or split via drag/selection

**Given** a minion group
**When** the GM selects "batch resolve"
**Then** all minions in the group attack as a single action with combined result (NFR7: <1s)

**Given** a minion group of 4
**When** the GM splits into 2 groups of 2
**Then** each group gets its own entry and can be resolved independently

---

## Epic 7: Compendium, Content & System Integration

System provides complete Nimble compendium content, supports homebrew creation, enables rest/recovery, exposes module hooks, and offers configurable settings.

### Story 7.1: Core Compendium Content

As a GM,
I want a complete compendium of core Nimble content (ancestries, backgrounds, boons, classes, subclasses, features, items, monsters, spells, tables),
So that all official content is available for play.

**Acceptance Criteria:**

**Given** the system is installed
**When** the GM browses compendium packs
**Then** all core content types are available with complete data

**Given** a compendium entry
**When** opened
**Then** all fields (stats, descriptions, effects, costs) match the Nimble rulebooks

### Story 7.2: Drag-Drop & Homebrew Content

As a GM,
I want to drag compendium content onto sheets and create custom homebrew using the same data structures,
So that official and custom content work identically.

**Acceptance Criteria:**

**Given** a compendium item
**When** dragged onto a character sheet
**Then** it is added to the character with all data intact

**Given** the GM creates a new item/monster/spell
**When** using the creation interface
**Then** the same data structures as compendium content are used

**Given** new content (monsters, classes, spells)
**When** added as compendium data
**Then** no code changes are required (FR39)

### Story 7.3: Rest & Recovery

As a player,
I want to perform Safe Rests and Field Rests to recover resources,
So that my character can heal and regain abilities between encounters.

**Acceptance Criteria:**

**Given** a player initiates a Safe Rest
**When** completed
**Then** HP, mana, hit dice, and class resources reset to appropriate values

**Given** a player initiates a Field Rest
**When** they spend hit dice
**Then** they roll and recover HP based on the results

**Given** a rest is completed
**When** a chat card is posted
**Then** it summarizes what was recovered

### Story 7.4: Module Integration Hooks

As a module developer,
I want stable hooks for key events (item activation, combat events) with predictable data formats,
So that I can build integrations that don't break on system updates.

**Acceptance Criteria:**

**Given** a player activates an item
**When** the activation completes
**Then** the `useItem` hook fires with item data in a documented format

**Given** combat events (start, turn change, end)
**When** they occur
**Then** corresponding hooks fire with relevant data

**Given** a system update
**When** hooks are called
**Then** the data contract remains stable (no breaking changes without versioning)

### Story 7.5: Tokenizer Compatibility

As a player,
I want the system to work correctly with the Tokenizer module for token art management,
So that I can use Tokenizer's features without conflicts.

**Acceptance Criteria:**

**Given** the Tokenizer module is active
**When** managing token art
**Then** the system's portrait/token separation works correctly alongside Tokenizer

**Given** Tokenizer generates a token
**When** applied
**Then** it appears correctly on the canvas and sheet

### Story 7.6: System Settings & Configuration

As a GM,
I want configurable system settings to customize behavior (automation level, display options, tracker position),
So that I can tailor the system to my group's preferences.

**Acceptance Criteria:**

**Given** the settings menu
**When** the GM opens it
**Then** available settings are organized and clearly described

**Given** an automation setting (e.g., require targets in combat)
**When** toggled
**Then** the behavior changes accordingly in the next interaction

**Given** a display setting (e.g., combat tracker position)
**When** changed
**Then** the UI updates without requiring a reload

---

## Epic 8: Automation Toolbox & Advanced Dice Roller

GMs and homebrewers can attach reusable automation building blocks to content (dice pools, counters, toggles, conditions, summon, shapeshift), and players get full per-die manipulation in an overhauled dice roller.

### Story 8.1: Automation Building Block Framework

As a GM or homebrewer,
I want to attach reusable automation building blocks (dice pools, counters, toggles, conditions) to features and items,
So that I can create automated custom content without coding.

**Acceptance Criteria:**

**Given** an item or feature
**When** editing in the sheet
**Then** the user can add automation building blocks from a menu

**Given** automation blocks are attached
**When** the item is used
**Then** the automation executes (e.g., counter decrements, toggle applies effects)

**Given** new rule types
**When** registered
**Then** they use `CONFIG.NIMBLE.ruleDataModels` and follow the existing rule class pattern

### Story 8.2: Dice Pool Management

As a player,
I want to manage dice pools (add, remove, reroll, maximize, replace dice) for class features like Berserker rage dice,
So that pool-based mechanics work smoothly.

**Acceptance Criteria:**

**Given** a feature with a dice pool
**When** viewing the feature
**Then** the pool shows current dice (count, size, values)

**Given** the dice pool UI
**When** the player adds, removes, rerolls, or maximizes a die
**Then** the pool updates and effects recalculate

### Story 8.3: Resource Counter Tracking

As a player,
I want resource counters (current/max) on class features that reset on rest events,
So that limited-use abilities are tracked automatically.

**Acceptance Criteria:**

**Given** a feature with a resource counter
**When** the feature is used
**Then** the counter decrements

**Given** a counter at 0
**When** attempting to use the feature
**Then** the system prevents or warns

**Given** a rest event
**When** completed
**Then** counters with matching reset triggers are restored

### Story 8.4: Toggle Features & Effects

As a player,
I want to toggle features on/off to activate passive bonuses, conditions, or shapeshift forms,
So that mode-switching abilities work with a single click.

**Acceptance Criteria:**

**Given** a toggleable feature
**When** the player toggles it on
**Then** associated effects are applied (stat bonuses, conditions, etc.)

**Given** a toggle is on
**When** the player toggles it off
**Then** effects are removed

**Given** a shapeshift toggle
**When** activated
**Then** token art swaps and features are added/removed from the sheet

### Story 8.5: Ad Hoc Condition Application

As a GM or player,
I want to apply ad hoc conditions to actors as visual reminders for a set duration or until removed,
So that temporary effects are tracked visually.

**Acceptance Criteria:**

**Given** an actor
**When** a condition is applied (drag-drop or chat card click)
**Then** the condition badge appears on the actor with optional duration

**Given** a condition with duration
**When** rounds pass
**Then** the duration counts down and the condition auto-removes at 0

**Given** an ad hoc condition
**When** applied
**Then** it serves as a visual reminder, not automated mechanical enforcement

### Story 8.6: Summon Minion

As a player,
I want to summon minions from class features (e.g., Shadowmancer), spawning player-controlled creatures with configurable parameters,
So that summoning abilities work in-game.

**Acceptance Criteria:**

**Given** a summon feature
**When** activated
**Then** a minion token is created on the canvas with configured stats (name, die size, creature size)

**Given** the summoned minion
**When** in combat
**Then** the player controls it and can take actions on its behalf

### Story 8.7: Overhauled Dice Roller - Pre-Roll Editing

As a player,
I want to edit roll parameters before confirming (advantage/disadvantage, per-die options, situational modifiers),
So that I have full control over my roll setup.

**Acceptance Criteria:**

**Given** the overhauled activation dialog
**When** opened
**Then** all dice are visible with per-die options (resize, remove, add)

**Given** advantage/disadvantage
**When** set
**Then** extra dice are added/dropped per Nimble rules

**Given** situational modifiers
**When** added
**Then** the damage formula preview updates in real-time

### Story 8.8: Overhauled Dice Roller - Post-Roll Editing

As a player,
I want to edit roll results after rolling (reorder, resize, reroll, maximize, minimize, add, remove individual dice),
So that class features and abilities that manipulate dice can be used.

**Acceptance Criteria:**

**Given** a roll result
**When** viewing dice
**Then** each die is individually selectable and editable

**Given** a selected die
**When** the player chooses reroll/maximize/minimize/resize
**Then** the die updates and the total recalculates

**Given** dice manipulation
**When** complete
**Then** the modified result replaces the original on the chat card

**Given** Nimble-specific mechanics (vicious attacks, exploding dice, primary die assignment)
**When** active
**Then** the roller handles them correctly
