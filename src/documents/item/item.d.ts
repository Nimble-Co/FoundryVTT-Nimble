/**
 * Ambient type declarations for Nimble item types to prevent circular dependencies.
 * These provide the type interface without requiring imports from the actual implementation files.
 */

/**
 * Base interface that all Nimble items extend.
 */
declare interface NimbleBaseItem extends Item {
	type: string;
	parent: NimbleBaseActor | null;
	identifier: string;
	rules: RulesManagerInterface;
	initialized: boolean;
	tags: Set<string>;
	document: Item;
	sourceId: string;
	_stats: {
		compendiumSource?: string;
	};
	prepareActorData?(): void;
	prepareChatCardData(options): Promise<unknown>;
}

/**
 * Class item - extends base with class-specific properties.
 */
declare interface NimbleClassItem extends NimbleBaseItem {
	type: 'class';
	system: {
		classLevel: number;
		hitDieSize: number;
		savingThrows: {
			advantage: string;
			disadvantage: string;
		};
	};
	ASI?: Record<string, number>;
	hitDice?: { size: number; total: number };
	maxHp?: number;
	grantedArmorProficiencies?: string[];
	grantedWeaponProficiencies?: string[];
}

/**
 * Subclass item - extends base with subclass-specific properties.
 */
declare interface NimbleSubclassItem extends NimbleBaseItem {
	type: 'subclass';
	identifier: string;
	system: Record<string, unknown>;
}

/**
 * Ancestry item - extends base with ancestry-specific properties.
 */
declare interface NimbleAncestryItem extends NimbleBaseItem {
	type: 'ancestry';
	system: {
		exotic: boolean;
	};
}

/**
 * Background item - extends base with background-specific properties.
 */
declare interface NimbleBackgroundItem extends NimbleBaseItem {
	type: 'background';
	system: Record<string, unknown>;
}
