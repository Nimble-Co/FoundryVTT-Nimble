import type { SheetIntent } from '../shared/sheetIntent.ts';

/** The flags of the monster that the Settings tab sets. */
export type MonsterSettingsFlag =
	| 'actorImageXOffset'
	| 'actorImageYOffset'
	| 'actorImageScale'
	| 'automaticallyExecuteAvailableMacros';

/** The armor of a monster: none, medium or heavy. */
export type MonsterArmor = 'none' | 'medium' | 'heavy';

/** The configure windows that the NPC sheet opens. The damage defenses are in the metadata window. */
export type MonsterConfigureTarget = 'metadata' | 'saves' | 'movement';

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
	| SheetIntent<MonsterSettingsFlag>
	| { kind: 'setMaxHp'; value: number }
	| { kind: 'setArmor'; armor: MonsterArmor }
	| { kind: 'configure'; target: MonsterConfigureTarget }
	| { kind: 'createFeature' }
	| { kind: 'reorder'; updates: MonsterSortUpdate[] };

export type MonsterPerform = (intent: MonsterIntent) => void | Promise<void>;
