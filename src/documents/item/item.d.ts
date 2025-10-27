/**
 * Type declarations for Nimble item types to prevent circular dependencies
 */

declare interface NimbleBaseItem extends Item {
	type: string;
	parent: NimbleBaseActor | null;
	rules: RulesManagerInterface;
	prepareActorData?(): void;
}

declare interface NimbleClassItem extends NimbleBaseItem {
	type: 'class';
	identifier: string;
	system: any;
	ASI?: Record<string, number>;
	hitDice?: { size: number; total: number };
	maxHp?: number;
	grantedArmorProficiencies?: string[];
	grantedWeaponProficiencies?: string[];
}

declare interface NimbleSubclassItem extends NimbleBaseItem {
	type: 'subclass';
	identifier: string;
	system: any;
}

declare interface NimbleAncestryItem extends NimbleBaseItem {
	type: 'ancestry';
	system: any;
}

declare interface NimbleBackgroundItem extends NimbleBaseItem {
	type: 'background';
	system: any;
}
