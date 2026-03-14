# Review of `feat-heroic-reactions-tab`

## Overview
This PR introduces the **Heroic Reactions** tab to the Player Character sheet, providing a dedicated interface for reactions like **Defend**, **Interpose**, **Opportunity**, and **Help**. It also includes updates to the dice rolling infrastructure (`NimbleRoll`, `DamageRoll`) to support these features.

## Key Changes
- **New UI**: `PlayerCharacterHeroicActionsTab.svelte` now toggles between "Actions" and "Reactions".
- **Reaction Panels**: Dedicated panels for each reaction type (e.g., `OpportunityReactionPanel`).
- **Dice Logic**:
    - `NimbleRoll`: New base class extending `Roll` to track prompt/respondent metadata.
    - `DamageRoll`: Enhanced to handle "Primary Die" mechanics (crit/miss detection) and proper serialization.
- **Chat Cards**: New `ReactionCard.svelte` and data model for displaying reaction results.

## Technical Assessment

### 1. UI & State Management (Svelte 5)
The implementation effectively uses Svelte 5's reactivity system (`$state`, `$derived`, `$effect`).
- **Combat State**: The `createSubscriber` pattern in `PlayerCharacterHeroicActionsTab.svelte.ts` is a clean way to react to Foundry's global hooks without memory leaks.
- **Modularity**: The separation of panels (e.g., `OpportunityReactionPanel`) keeps the main tab component clean.

### 2. Opportunity Attack Logic
- **Weapon Filtering**: The logic in `createOpportunityPanelState` correctly filters for melee-capable weapons (excluding items that are purely ranged).
- **Unarmed Strikes**: The explicit handling of unarmed strikes with a temporary item creation is robust.
- **Disadvantage Rule**: The default `rollMode: -1` (disadvantage) for opportunity attacks is correctly applied in `handleUnarmedStrike` and `handleItemClick`. The use of `ItemActivationConfigDialog` allows the user to override this if necessary (e.g., specific feats), which is excellent UX.

### 3. Dice Rolling Infrastructure
- **Serialization**: `DamageRoll.ts` overrides `toJSON` and `fromData` to ensure custom properties (`isCritical`, `isMiss`, `primaryDie`) are preserved. This is critical for chat cards to render correctly after a reload.
- **Primary Die**: The preprocessing logic to extract the first die as a `PrimaryDie` (handling explosions and hit/miss detection) is complex but implemented in a standard Foundry-compatible way.

### 4. Localization & Styling
- **i18n**: Extensive use of `localize` ensures the feature is ready for translation.
- **Theming**: Components support both light and dark modes, consistent with the rest of the system.

## Suggestions / Questions
- **Hardcoded Disadvantage**: Confirm that `rollMode: -1` is the intended *universal* default for all opportunity attacks in this system ruleset. The current implementation allows user override via the dialog, so this is likely fine.
- **`activateItem` Integration**: In `OpportunityReactionPanel.svelte.ts`, `handleItemClick` calls `getActor().activateItem(itemId, { rollMode: -1 })`. Ensure the `activateItem` method on the actor correctly propagates `rollMode` to the roll.

## Conclusion
This is a high-quality PR. The code is clean, follows project patterns, and robustly implements the requested feature.

**Status**: ✅ Ready for Merge (pending manual verification of `activateItem` propagation).
