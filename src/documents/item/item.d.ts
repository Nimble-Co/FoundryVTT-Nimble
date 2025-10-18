/**
 * Type declarations for Nimble item types to prevent circular dependencies
 */

declare interface NimbleBaseItem extends Item {
	type: string;
	parent: NimbleBaseActor | null;
	rules: RulesManagerInterface;
	prepareActorData?(): void;
}

declare interface NimbleClassItem extends Item {
	type: 'class';
	identifier: string;
	system: any;
	ASI?: Record<string, number>;
	hitDice?: { size: number; total: number };
	maxHp?: number;
	grantedArmorProficiencies?: string[];
	grantedWeaponProficiencies?: string[];
}

declare interface NimbleSubclassItem extends Item {
	type: 'subclass';
	identifier: string;
	system: any;
}
