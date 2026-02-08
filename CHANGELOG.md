# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.6.1] - 2026-02-07

### Changed

- [#274] Moved editing toggle button from sheet header to sidebar. @fronix
- [#274] Mana bar now always visible in sidebar; removed from spells tab footer. @fronix

---

## [0.6.0] - 2026-02-07

### Added
- Unfinished-character confirmation modal. #266 @7D7D
- Mana Bar that works with Rests. #265 @7D7D
- Language selection support for character creation. #258 @trevlar
- Monster/NPC action management. #246 @fronix
- Hunter Level 10: "Keen Eye, Steady Hand" ability. #261 @7D7D
- French translations. #270 @trevlar

### Fixed
- Skill point selection being preemptively cut off during character creation. #244 @TesserWract
- Save config dialog for creatures. #247 @trevlar
- Correct damage types for creature attacks. #252 @trevlar
- Roll initiative issue. #253 @trevlar
- Support for maxHPRule on sheets. #257 @trevlar
- Monster rolls showing when they miss. #254 @trevlar
- Creator links in README. #256 @Tristin Albers
- Minions no longer missing from encounters. #264 @7D7D

### Changed
- Updated creatureType for all Monsters. #263 @7D7D
- Compendium formatting improvements. #267 @fronix

---

## [0.5.0] - 2026-01-22

### Added
- Drag-and-drop sorting functionality for inventory items. @fronix
- Configuring saves now allows flat bonuses and ancestry states. @trevlar
- Show when primary die/modifier is set. @fronix

### Fixed
- Button to add bonus hit dice. @trevlar
- Character creation ability score design matches configuration. @trevlar
- Dragging monster features from one sheet to another. @trevlar
- Bonus hit dice granted by rules now displays on sheets. @trevlar
- Oathsworn missing equipment reference item grant. @trevlar

### Changed
- Move all font-size rules to use rem for better accessibility. @trevlar
- Improved UI for Configuring Ability Scores and Saving Throws. @trevlar

---

## [0.4.0] - 2026-01-11

### Added
- Attack sequence subtype with accessibility improvements. @trevlar
- Display reach and range on NPC attacks. @trevlar
- Allow choosing starting equipment or gold during character creation. @trevlar
- i18n scripting for creating translations and validating language keys (developer-facing). @trevlar
- Confirmation dialog when leveling down. @trevlar
- Zephyr traveling clothes and sandals to compendium packs. @trevlar
- Action Sequence as a monster feature subtype (replaces `actionSequence`). @trevlar

### Fixed
- Prevent actions from resetting when combat starts. @fronix
- Prevent conflicts between level up and level down. @trevlar
- Correct field rest dialog dice field behavior. @trevlar
- Display and editing of hit dice. @trevlar
- Tokenizer issues. @MrTheBino
- Combat tracker guard to prevent invalid state. @trevlar
- Monster feature drag-and-drop behavior. @trevlar
- Spelling errors across compendium data. @trevlar

### Changed
- Redesign Hit Point configuration UI. @trevlar
- Redesign monster action sequence UI. @trevlar
- Redesign field rest dialog for clarity and support bonus hit dice. @trevlar
- Redesign ability score configuration UI for clarity and consistency. @trevlar
- Normalize data structure for reach and range attacks. @trevlar

### Migration Notes
- The system `attackSequence` field has been migrated to a monster feature of subtype `attackSequence`.
- Monster data relying on legacy reach/range fields may require resaving or migration.

---

## [0.3.1] - 2025-12-14

### Added
- Light-dark mode combat UI. @trevlar
- Roll initiative from PC sheet initiative stat. @trevlar
- More intuitive drag and drop interface for assigning ability scores on character creation. @trevlar
- Better opening position for actor creation and character creation dialog. @trevlar

### Fixed
- Transitions between light and dark mode on the PC sheet. @trevlar
- Tooltip descriptions on character creation. @trevlar
- Spell filter navigation to be visible on light and dark mode. @trevlar
- Turn indicator is now removed when ending combat. @trevlar
- Subclass selection theme colors and character creation dialog position. @trevlar
- Scrolling for effects, rules, and config tabs. @trevlar
- Auto-resize mana bar. @trevlar
- Duplicate edit box on PC features. @trevlar
- Only a GM can start combat now. @trevlar
- Ratfolk icon. @DoubleKing-Prime
- Bandit Mage. @DoubleKing-Prime

### Changed
- Improve CombatTracker reactivity and event handling. @MortenssenDiego

---

## [0.3.0] - 2025-12-05

### Added
- Automatic Hampered Condition Feature. @alexanderjardim
- Subclass selection UI during level up. @trevlar
- Test job to GitHub Actions. @trevlar
- All core Class, Subclass, and ClassFeature compendium info. @DoubleKing-Prime
- Control Table. @DoubleKing-Prime
- Class capstone ability score increase to all classes. @trevlar

### Fixed
- Legendary monster action activation and spells in chat. @trevlar
- Tooltip roll enrichers not processing correctly. @MortenssenDiego
- Scrollable spells and PC inventory overflow. @trevlar
- Missing subclass options and wrong assignment during level up. @trevlar
- primaryDie typo. @uiuiu-kit
- Formatting of Spell descriptions. @DoubleKing-Prime
- Wyrmhide Armor icon. @DoubleKing-Prime

### Changed
- Action economy header and creature feature design updates. @trevlar
- Ability score increase now also updates skills to max. @trevlar
- Show ability score increase on skill increases. @trevlar

---

## [0.2.0] - 2025-11-03

### Added
- Size selection on character sheet and ancestry size configuration. @trevlar
- Key stats and advantage/disadvantage stat selection during character creation. @trevlar
- Capstone ability increase handling at level 20. @trevlar
- Show level number on title of level up dialog. @trevlar
- Editable movement speed on NPC and monster sheets. @trevlar
- Allow window resizing on sheets, expanding description fields to fill dialog. @trevlar
- Item activation dialog with advantage/disadvantage options and situational modifiers. @uiuiu-kit
- Ability to skip activation dialog with Alt key. @uiuiu-kit
- HP customizable with primary die modifier. @uiuiu-kit
- Always show feature headline on character sheets. @uiuiu-kit
- objectSizeType to items, updated slots used calculation, and disabled quantity for non-stackable, non-small items. @SeseFeuerherz

### Fixed
- NPC sheet tab missing property error. @trevlar
- Require all selections to be made on level up before continuing. @trevlar
- Limit skill points to a max of 12 on level up. @trevlar
- Circular dependencies in codebase. @trevlar
- Extra closing brace from monster title display. @trevlar
- Labeled monster size display. @trevlar
- maxHP rule for items. @uiuiu-kit
- Reset hp.value so it does not exceed hp.max. @uiuiu-kit

### Changed
- Updated ancestry data with size configuration. @trevlar
- Updated all weapons with objectSizeType field. @SeseFeuerherz
- Updated armor and misc items in compendium with new objectSizeType. @SeseFeuerherz
- Updated mundane item descriptions and removed outdated stackable property. @SeseFeuerherz

---

## [0.1.9] - 2025-10-15

### Added
- Hint for item activation. @uiuiu-kit
- Size to Monster sheet. @uiuiu-kit
- Functionality to revert character level up. @uiuiu-kit
- Hints to add rule if no rules are present on an item. @trevlar
- Drag and Drop to reorder features on monster sheets. @uiuiu-kit
- Backgrounds, Magic Items, Boons, Legendary Monsters, and Tables. @DoubleKing-Prime

### Fixed
- MinionDataModel with initial value of 1 to prevent UI errors when accessing HP in the combat tracker. @alexanderjardim
- Editor warning deprecations. @uiuiu-kit
- Item tooltips not being reactive. @NekroDarkmoon
- Modeling of Arc Lightning and Zap to display a damage roll on miss. @DoubleKing-Prime
- Might typo on half-giant and orcs ancestries. @alexanderjardim
- Stoatling, Dryad, and Changeling correctly categorized in the exotic category. @DoubleKing-Prime

### Changed
- `actionHint` property to `actionSequence`. @uiuiu-kit
- Optimized loop for items with disabled armor. @trevlar
- Optimized some Rule functions. @trevlar
- Removed `isAttack` and `isAction` properties from monster features. @uiuiu-kit
- Updated Monster sheets. @uiuiu-kit
- Updated System Settings button. @trevlar
- Polished Monsters and Spells. @DoubleKing-Prime

---

## [0.1.8] - 2025-09-09

### Added
- More functionality to the Rule Manager. @SeseFeuerherz
- Predicate test to run. @Reisenkodie
- Improvements to the Damage Roll for future upgrades. @NekroDarkmoon
- All Ancestry options. @DoubleKing-Prime

### Fixed
- Foundry deprecation warnings related to text editor. @Reisenkodie
- Description edit for solo monster sheet. @uiuiu-kit
- Monster damage types. @Reisenkodie

---

## [0.1.7] - 2025-08-16

### Added
- Increased min height of the character sheet.

### Fixed
- Clear All Button not handling linked statuses.
- Solo monster bloodied and last stand actions.
- Armor proficiencies from rules not working.
- Temporary HP not resetting on safe rest if HP is full.
- Initiative bonus to human.
- Replaced `@attribute` with `@key` for spells that use key.

---

## [0.1.6] - 2025-07-14

### Added
- Mana to list of tracked bar attributes.
- Config for inventory slots.
- Calculation of inventory slots.
- Quantity field to character inventory tab.
- Logic to handle stacking of objects.
- Mana config for classes.
- Automation for max mana.
- Item macro for hotbar.
- Cheat Class. @DoubleKing-Prime
- Commander Class. @DoubleKing-Prime
- Mage Class. @DoubleKing-Prime
- Oathsworn Class. @DoubleKing-Prime

### Fixed
- Long names overflowing in item lists.
- v13 bug with cleanTypes in data models.
- Armor and weapon proficiencies not showing up from classes.
- Rest summary displaying wounds being restored even if none were inflicted.
- Mana not being restored on safe rest.

### Changed
- Movement squares to be movement spaces instead.

---

## [0.1.5] - 2025-07-10

### Added
- Updated rendering of Token HUD.

### Fixed
- Status effects container display.
- Clear all button.
- Blinded condition being applied on every pointer event.

---

## [0.1.4] - 2025-07-07

### Added
- Class identifier field to features.
- Group identifier field to features.
- Feature group for classes.
- Complexity field to class config.
- Berserker class.
- Berserker class features.
- Savage Arsenal features.

### Fixed
- Temporary fix for description overflow in character creation.
- Missing minus icon.

---

## [0.1.3] - 2025-06-30

### Added
- proficiencyGrant rule type to support armors, languages, weapons.
- Spells to compendium.
- Armors, consumables, misc, and weapon items.
- Monsters to packs.

### Fixed
- Rules being editable on the actor.
- IDBuilder for linux systems.
- IdBuilder not correcting wrong ids.

---

## [0.1.2] - 2025-06-29

### Added
- Config for boon type.
- Object type of consumable and misc.

### Fixed
- Config height issue.
- Enrich not working on feature chat cards.
- Spell icons on filter not showing.
- li styles.
- Rule tooltip not showing.

---

## [0.1.1] - 2025-06-21

### Added
- A few items to the compendium.
- Human and Dwarf to Ancestries.
- Back out of Retirement to Backgrounds.
- Arc Lightning Spell.
- Bugbear, Goblin and its variants to monsters.
- Alert to boons.

### Fixed
- Tag button background color not showing.
- Text color issue with text block for rules.
- Prototype token config not opening.
- Duplicate options in sheet toolbar.

### Changed
- Reworked Svelte Renderer.
- Updates prototype image to change when actor image is changed.

---

## [0.1.0] - 2025-06-16

Initial release of the Nimble v2 system for Foundry VTT!

---

If you want to support further system development, please consider joining or tipping one of the contributors on their Patreon or Ko-fi page.
