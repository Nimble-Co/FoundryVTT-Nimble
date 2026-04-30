# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.8.4] - 2026-04-29

### Added

- [#703] ApplyCondition rule type with event-time dispatch. @fronix
- [#709] Support multiple selections per group for class features. @trevlar
- [#714] Decouple explosionStyle from canCrit. @fronix
- [#715] Die modifier vocabulary (c/cv/v/n). @fronix
- [#716] critCount, brutalPrimary, and primaryDieValue dice API. @fronix
- [#730] Search features, inventory, and spells by description text. @tristin-albers
- [#731] Wire flunky tag to suppress critical hits. @tristin-albers
- [#732] Decrement action tracker from all tabs on item activation. @tristin-albers
- [#733] Temporary bonus action slots in the action tracker. @tristin-albers
- [#737] Group class features with collapsible cards and level badges. @trevlar
- [#740] Automation rules for seven features across six classes. @fronix
- [#743] ConditionImmunity rule type. @tristin-albers

### Fixed

- [#713] Fix dice engine correctness gaps. @fronix
- [#728] Apply savingThrowRollMode rules during character creation. @trevlar
- [#734] Unblock and confirm reactions on PC turn and macro bar. @trevlar

### Changed

- [#727] Fix Songweaver spell school and fire in my bones spell. @trevlar
- [#738] Restrict Lifebinding Spirit spell to Shepherd subclass. @trevlar
- [#740] Add automation rules to compendium features across six classes. @fronix

---


## [0.8.3] - 2026-04-16

### Fixed

- [#711] Restore advantage/disadvantage on checks and initiative. @trevlar

### Changed

- [#710] Fix image references in compendium. @trevlar
- [#712] Fix broken image references in compendium. @trevlar

---


## [0.8.2] - 2026-04-15

### Added

- [#496] Drag heroic actions and reactions to macro bar. @trevlar
- [#516] HP scrolling text and centralized HP manipulation flow. @Insax
- [#520] Spell grants and school selection to character creation. @trevlar
- [#528] Unarmored predicate for Zephyr Swift Feet. @trevlar
- [#537] Improved PC creator UI consistency. @underscoreRobin
- [#539] Allow equipping any object item with rules. @Insax
- [#547] Initiative roll enricher. @7D7D
- [#550] InitiativeMessage rule type. @joechaotic
- [#551] Add character to combat with initiative roll. @7D7D
- [#553] Left-to-right ordering setting for combat tracker. @Fronix
- [#562] Adjacency rule sync and Lionhearted boon automation. @joechaotic
- [#565] Require character name before creation. @joechaotic
- [#571] Grant class features on level up and remove on level down. @trevlar
- [#693] Grant spells on level up and remove on level down. @trevlar
- [#704] Grant subclass features on level up. @trevlar

### Fixed

- [#519] End turn action refill race condition. @Insax
- [#527] Combat tracker invisible area no longer blocks canvas clicks. @trevlar
- [#529] Half-Giant Dwarvish predicate not evaluating INT condition. @trevlar
- [#532] Conditions menu being incorrectly oversized. @Fronix
- [#533] Allow targeting friendly-disposition tokens in combat tracker. @Fronix
- [#534] Respect activation cost quantity when consuming combat actions. @Fronix
- [#535] Minion roll chat propagation and field rest mana feedback. @Fronix
- [#546] Choose turn order before starting combat. @7D7D
- [#548] Prevent duplicate initiative rolls. @7D7D
- [#572] Fixed portrait position on PC/NPC sheets. @joechaotic
- [#586] Clean up level-up/level-down dialog state and grant logic. @trevlar
- [#696] Preserve @key in damage formula normalization. @Fronix

### Changed

- [#536] Fix granted levels in compendium. @trevlar
- [#545] Add image icons for monsters and magic items. @trevlar
- [#554] Updated Spanish translation. @carlosvgs
- [#697] Commander combat tactics levels and Rat Prince type corrections. @trevlar
- [#705] Cleanup formatting in packs. @trevlar

---


## [0.8.1] - 2026-03-27

### Added

- [#497] Class feature grants during character creation. @trevlar
- [#466] Custom items for character creation. @trevlar
- [#396] Enhancements for drag and drop on items in the character sheet. @Insax

### Fixed

- [#525] Turn tracking. @7D7D
- [#524] Add backup images. @trevlar
- [#521] Reversed tooltips in combat tracker. @7D7D
- [#518] Preserve user targets when group attack panel refreshes. @Insax
- [#515] Duplicate initiative. @7D7D
- [#514] Combat tracker window width. @7D7D
- [#513] Monsters marked as finished their turn on their turn. @7D7D
- [#507] Apply NPC armor rules in combat damage application. @Insax
- [#503] Remove combatant when token deleted, fix death state. @trevlar
- [#502] Only show red/green dice styling on Primary Die. @trevlar
- [#506] Replace `__img` border with `::after` overlay divider. @underscoreRobin
- [#495] Make equipped the source of truth for object rule state. @Insax
- [#494] Make action dice discrete and show tooltips to the right. @trevlar
- [#463] Condition and hit point tracking unique per token. @trevlar
- [#464] Improve migration reliability. @Fronix

### Changed

- [#517] Added speedbonus to Zephyr and Lodging boon. @trevlar
- [#523] Update missing ids in packs. @trevlar
- [#522] Added different backup images for heroes/monsters. @trevlar
- [#504] Add GM Items from Adventures and locations. @trevlar
- [#505] Updated Spanish translation. @carlosvgs
- [#461] Convert to spaces. @Insax

---


## [0.8.0] - 2026-03-18

### Added

- [#377] Combat tracker v1.0. @7D7D
- [#412] Apply Damage button affecting action count. @7D7D
- [#424] Floating combat actions tracker on PC sheet. @trevlar
- [#426] Data-driven unarmed damage rule system. @trevlar
- [#427] Assess action chat card. @trevlar
- [#428] Heroic Actions tab to PC sheet. @trevlar
- [#431] Heroic Reactions tab with chat card targeting system. @trevlar
- [#440] NCS persistent Show/Hide. @7D7D
- [#441] Secret Spells compendium. @7D7D
- [#447] Zephyr unarmed strike proficiency and Reverberating Strikes. @trevlar
- [#448] Repurpose combat sidebar button to toggle combat. @trevlar
- [#452] CI check for migration version consistency. @trevlar
- [#456] Setting to enable/disable Combat System panel. @trevlar
- [#458] Empty state for combat tracker with no combatants. @trevlar
- [#459] Remove combatant button to combat tracker cards. @trevlar

### Fixed

- [#397] Editing of monster movement. @trevlar
- [#414] Enable editing saves on NPC monster sheets. @trevlar
- [#416] Stabilize reactive chat card mounting. @trevlar
- [#417] Grid-area styles to inventory and features delete buttons. @trevlar
- [#421] Use reactive accessors in chat card components. @trevlar
- [#432] Longbow damage. @trevlar
- [#445] Crits cannot miss. @trevlar
- [#446] Apply advantage/disadvantage to AoE spells without primary die. @trevlar
- [#449] ActionTracker shows for started combat even if not active. @trevlar
- [#454] Implement vicious weapon explosion mechanic. @trevlar
- [#457] Resolve hover name cutoff when no heroes in combat. @trevlar
- [#460] Apply temp healing to temp HP instead of regular HP. @trevlar

### Changed

- [#419] Add missing translation strings for user-facing UI. @trevlar
- [#423] Update Twist the Blade 2 to level 13. @trevlar
- [#430] Register Spanish and French translation files. @trevlar
- [#438] Update Spanish translation. @carlosvgs
- [#443] Class features clean up text formatting. @7D7D
- [#450] Improve reaction panel reactivity and UI. @trevlar
- [#451] Improve Heroic Actions tab button styling. @trevlar
- [#455] Style update to Interpose & Defend buttons. @7D7D

---


## [0.7.2] - 2026-03-05

### Added

- [#394] NCS Hide/Show toggle button. @7D7D
- [#375] Apply Healing button and healingPotionBonus rule. @trevlar
- [#361] Item activation hooks and chat message flags. @fronix
- [#332] Improved Active Effects and Conditions display on actor sheets and token HUD. @fronix

### Fixed

- [#355] NPCSheet image and Hit Point overlap. @7D7D
- [#352] Gnoll damage formula. @fronix
- [#384] Journal Source HTML not displaying and Save button inaccessible. @trevlar
- [#383] Elf initiative roll mode accumulating. @trevlar
- [#373] Edit mode toggle on sheets. @fronix
- [#360] Symlink permissions error on Windows. @fronix
- [#389] Spell Compendium sorting. @7D7D

### Changed

- [#354] [#379] Spanish translation updates. @carlosvgs

### Maintenance

- [#391] Migrate from npm to pnpm. @fronix
- [#392] Svelte preprocess part of approved builds. @fronix
- [#362] Resolve Svelte compile warnings in components and build. @fronix
- [#359] Worktree cleanup script. @trevlar

---


## [0.7.1] - 2026-02-26

### Added

- [#313] Nimble Combat System (NCS) v1.0. @7D7D
- [#323] Smart parsing for Nimble Nexus action descriptions. @trevlar
- [#324] Spell upcasting scaling editor. @fronix
- [#328] Apply hit dice size bonus rules on level up. @trevlar
- Data migrations to include feature rules.
  - [#328] Included hit dice adjustments for oozeling/constructs, Wild One, and Dwarf @trevlar
  - [#307] Adjustment to support spellblade combat mana @7D7D
  - [#324] Adjustments to spells to support upcasting @Fronix

### Fixed

- [#307] Spellblade Mana edge case during combat. @7D7D
- [#322] Odd Constitution rules for Oozeling/Construct ancestry. @trevlar
- [#324] Spell upcasting bugs. @fronix
- [#351] Item sheet size issues and text editor UX updates. @trevlar

### Changed

- [#336] Add missing legendary and standard creatures from adventures in GMG. @trevlar
- [#338] Update nimble system name. @trevlar

### Maintenance

- [#349] Fixed build errors and character sheet rendering issues. @trevlar
- [#346] Normalize formatting and ids generated for comp packs. @trevlar
- [#317] Replace husky with lefthook for git hooks. @trevlar
- [#327] Fix npm audit vulnerabilities. @trevlar
- [#337] Fix npm hooks with worktree setup. @trevlar
- [#339] Comprehensive coding style guide. @trevlar
- Release automation of git tags and changelog update @trevlar

---

## [0.7.0] - 2026-02-18

### Added

- [#260] Spell upcasting system with scaling coverage. @fronix
- [#262] Spell compendium organization and filtering. @7D7D
- [#271] Hide NPC rolls from players. @leadanymind
- [#282] Dedicated price property for items. @trevlar
- [#283] Speed bonus rule for ancestry speed adjustments. @trevlar
- [#287] Initiative roll mode rule for advantage/disadvantage. @trevlar
- [#290] Nimble Nexus monster import dialog. @trevlar
- [#292] Attribution blurb in system settings. @trevlar
- [#299] Mana config pop-out window. @7D7D
- [#301] Basic Combat: Initiative and sorting. @7D7D
- [#303] Expanded roll information display. @fronix
- [#312] Apply damage from chat messages. @7D7D
- [#314] Remove disabled state from Primary Die Modifier input field. @Copilot
- [#315] Combat tracker settings window. @7D7D

### Fixed

- [#277] Correct True Strike action cost from 2 to 1. @trevlar
- [#278] Correct action refresh timing for PCs and NPCs. @trevlar
- [#279] Handle unknown compendium types in preparePackIndexes. @trevlar
- [#280] Add quantity support to item grant rules. @trevlar
- [#284] Invalidate tooltip cache when items are modified. @trevlar
- [#286] Correct armor proficiency path mapping. @trevlar
- [#289] Allow observers to switch tabs on other players' sheets. @trevlar
- [#291] Fix Firefox rendering issues with character sheets. @trevlar
- [#294] Handle unrecognized rule types in ItemRulesTab. @trevlar
- [#305] Fix NPC flat bonuses not applying. @fronix

### Changed

- [#293] Subclasses organized into compendium folders. @7D7D
- [#295] Monsters sorted into folders. @7D7D
- [#296] Boons compendium sorting. @7D7D
- [#298] Class features fixed and compendium sorted. @7D7D
- [#302] Monster folder ID assignments. @7D7D
- [#306] Boons folder ID assignment. @7D7D
- [#308] Small compendium adjustments. @7D7D

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
