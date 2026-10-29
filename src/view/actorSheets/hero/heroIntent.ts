import type { AbilityKeyType } from '#types/abilityKey.js';
import type { SaveKeyType } from '#types/saveKey.js';
import type { SkillKeyType } from '#types/skillKey.js';
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
	| { kind: 'rollSkill'; skill: SkillKeyType };

export type HeroPerform = (intent: HeroIntent) => void | Promise<void>;
