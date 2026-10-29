import type { AbilityKeyType } from '#types/abilityKey.js';
import type { SaveKeyType } from '#types/saveKey.js';
import type { SkillKeyType } from '#types/skillKey.js';
import type { ChatReactionId } from '#utils/heroicActions/reactions.js';
import type { SpellsBy } from './heroSource.ts';
/** The configure windows that the character sheet opens. */
export type HeroConfigureTarget =
	| 'hitPoints'
	| 'hitDice'
	| 'mana'
	| 'movement'
	| 'metadata'
	| 'abilities'
	| 'saves'
	| 'skills'
	| 'damageDefenses'
	| 'languages'
	| 'armorProficiencies'
	| 'weaponProficiencies';

/**
 * Something that the character sheet asks Foundry to do. The views hold these as plain data;
 * `perform` is the only place that acts on them.
 */
/** The sheet has no row for the combined Interpose and Defend. */
export type SheetReactionId = Exclude<ChatReactionId, 'interposeAndDefend'>;

export type HeroIntent =
	| { kind: 'setHp'; value: number }
	| { kind: 'setTempHp'; value: number }
	| { kind: 'setWounds'; value: number }
	| { kind: 'setMana'; value: number }
	| { kind: 'setHitDice'; value: number }
	| { kind: 'rollHitDice' }
	| { kind: 'editHitDice' }
	| { kind: 'setPoolCharges'; poolId: string; value: number }
	| { kind: 'rollPoolCharge'; poolId: string; label: string }
	| { kind: 'rollIntoDicePool'; poolId: string; label: string }
	| { kind: 'setDiceFaces'; poolId: string; faces: number[] }
	| { kind: 'configure'; target: HeroConfigureTarget }
	| { kind: 'rename'; name: string }
	| { kind: 'changePortrait'; skipTokenizer: boolean }
	| { kind: 'levelUp' }
	| { kind: 'revertLevelUp' }
	| { kind: 'correctLevels' }
	| { kind: 'rest'; restType: 'field' | 'safe' }
	| { kind: 'rollInitiative' }
	| { kind: 'setActions'; value: number }
	| { kind: 'addAction' }
	| { kind: 'endTurn' }
	| { kind: 'rollAbilityCheck'; ability: AbilityKeyType }
	| { kind: 'rollSave'; save: SaveKeyType }
	| { kind: 'rollSkill'; skill: SkillKeyType }
	| { kind: 'activate'; itemId: string }
	| { kind: 'endToggle'; itemId: string; ruleId: string }
	| { kind: 'openItem'; itemId: string }
	| { kind: 'createItem'; itemType: 'spell' | 'object' | 'feature' }
	| { kind: 'deleteItem'; itemId: string }
	| { kind: 'toggleEquip'; itemId: string }
	| { kind: 'setQuantity'; itemId: string; value: number }
	| { kind: 'storeIn'; itemId: string; containerId: string }
	| { kind: 'setCurrency'; coin: string; value: number }
	| { kind: 'endEffect'; effectId: string }
	| { kind: 'removeEffect'; effectId: string; itemId: string | null }
	| { kind: 'setCondition'; conditionId: string; active: boolean }
	| { kind: 'setSpellsBy'; value: SpellsBy }
	| { kind: 'unarmedStrike' }
	| { kind: 'move' }
	| { kind: 'assess'; option: string; skill: SkillKeyType }
	| { kind: 'reaction'; reaction: SheetReactionId }
	| { kind: 'opportunityAttack'; weaponId: string | null }
	| { kind: 'spendDice'; itemId: string; ruleId: string; poolId: string; indices: number[] };

export type HeroPerform = (intent: HeroIntent) => void | Promise<void>;
