/**
 * Ambient type declarations for Nimble item types to prevent circular dependencies.
 * These provide the type interface without requiring imports from the actual implementation files.
 */

/**
 * Base interface that all Nimble items extend.
 */
declare interface NimbleBaseItem<TypeName extends string = string> extends Item {
	type: TypeName;
	parent: NimbleBaseActor | null;
	identifier: string;
	rules: RulesManagerInterface;
	initialized: boolean;
	tags: Set<string>;
	document: Item;
	_stats: {
		compendiumSource?: string;
	};
	isType<T extends string>(type: T): this is NimbleBaseItem<T>;
	prepareActorData?(): void;
	prepareChatCardData(options): Promise<unknown>;
}

/**
 * Class item - extends base with class-specific properties.
 */
declare interface NimbleClassItem extends NimbleBaseItem<'class'> {
	type: 'class';
	system: {
		classLevel: number;
		hitDieSize: number;
		hpData: number[];
		resources: any[];
		savingThrows: {
			advantage: string;
			disadvantage: string;
		};
		mana: {
			formula: string;
		};
		keyAbilityScores: string[];
		[key: string]: any;
	};
	ASI?: Record<string, number>;
	hitDice?: { size: number; total: number };
	maxHp?: number;
	grantedArmorProficiencies: string[];
	grantedWeaponProficiencies: string[];
}

/**
 * Subclass item - extends base with subclass-specific properties.
 */
declare interface NimbleSubclassItem extends NimbleBaseItem<'subclass'> {
	type: 'subclass';
	identifier: string;
	class: NimbleClassItem | null;
	system: {
		parentClass: string;
		resources: any[];
		[key: string]: any;
	};
}

/**
 * Ancestry item - extends base with ancestry-specific properties.
 */
declare interface NimbleAncestryItem extends NimbleBaseItem<'ancestry'> {
	type: 'ancestry';
	system: {
		exotic: boolean;
	};
}

/**
 * Background item - extends base with background-specific properties.
 */
declare interface NimbleBackgroundItem extends NimbleBaseItem<'background'> {
	type: 'background';
	system: Record<string, unknown>;
}
