import type { SaveKeyType } from '#types/saveKey.js';

/** The flags of the monster that the Settings tab sets. */
export type MonsterSettingsFlag =
	| 'actorImageXOffset'
	| 'actorImageYOffset'
	| 'actorImageScale'
	| 'automaticallyExecuteAvailableMacros';

/** The new place of one ability after a drag: its hand-sorted order, and its attack sequence. */
export interface MonsterSortUpdate {
	itemId: string;
	sort: number;
	/** only for the dragged action: the attack sequence that holds it, or null for none */
	parentItemId?: string | null;
}

/**
 * Something that the NPC sheet asks Foundry to do. The views hold these as plain data;
 * `perform` is the only place that acts on them.
 */
export type MonsterIntent =
	| { kind: 'setHp'; value: number }
	| { kind: 'setTempHp'; value: number }
	| { kind: 'rollSave'; save: SaveKeyType }
	| { kind: 'activate'; itemId: string }
	| { kind: 'openItem'; itemId: string }
	| { kind: 'reorder'; updates: MonsterSortUpdate[] }
	| { kind: 'endEffect'; effectId: string }
	| { kind: 'removeEffect'; effectId: string; itemId: string | null }
	| { kind: 'setCondition'; conditionId: string; active: boolean }
	| { kind: 'setFlag'; flag: MonsterSettingsFlag; value: boolean | number }
	| { kind: 'setCurrency'; coin: string; value: number };

export type MonsterPerform = (intent: MonsterIntent) => void | Promise<void>;
