import type { DicePoolRuleConfig } from './dicePoolRuleConfig.js';

type DicePoolScope = (typeof DicePoolRuleConfig.scopes)[number];
type DieSize = (typeof DicePoolRuleConfig.dieSizes)[number];
type DicePoolInitialMode = (typeof DicePoolRuleConfig.initialModes)[number];
type DiceRefillTrigger = (typeof DicePoolRuleConfig.refillTriggers)[number];
type DiceRefillMode = (typeof DicePoolRuleConfig.refillModes)[number];
type DiceRestType = (typeof DicePoolRuleConfig.restTypes)[number];
type NumericInput = number | string | null | undefined;

type DiceRefillEntry = {
	trigger: DiceRefillTrigger;
	mode: DiceRefillMode;
	value: string;
};

type BankedDie = {
	face: number;
};

type DicePoolState = {
	id: string;
	identifier: string;
	scope: DicePoolScope;
	sourceItemId: string;
	sourceItemName: string;
	label: string;
	dieSize: DieSize;
	max: number;
	faces: number[];
	icon?: string;
	refills: DiceRefillEntry[];
};

type DicePoolMap = Record<string, DicePoolState>;

type DicePoolDefinition = Omit<DicePoolState, 'faces'> & {
	initial: DicePoolInitialMode;
};

type DicePoolRuleLike = {
	type?: string;
	disabled?: boolean;
	id?: string;
	identifier?: string;
	label?: string;
	scope?: string;
	dieSize?: string;
	max?: string;
	icon?: string;
	initial?: string;
	refills?: unknown;
};

type ModifyDicePoolRuleLike = {
	type?: string;
	disabled?: boolean;
	id?: string;
	poolIdentifier?: string;
	dieSize?: string | null;
	maxDelta?: string | null;
};

type DicePoolRuleAny = DicePoolRuleLike & ModifyDicePoolRuleLike;

type RuleBackedItem = Item.Implementation & {
	rules?: Map<string, DicePoolRuleAny>;
};

type CharacterActorLike = Actor.Implementation & {
	type: 'character';
	items: foundry.abstract.EmbeddedCollection<Item.Implementation, Actor.Implementation>;
	getRollData(): Record<string, unknown>;
};

export type {
	BankedDie,
	CharacterActorLike,
	DicePoolDefinition,
	DicePoolInitialMode,
	DicePoolMap,
	DicePoolRuleAny,
	DicePoolRuleLike,
	DicePoolScope,
	DicePoolState,
	DieSize,
	DiceRefillEntry,
	DiceRefillMode,
	DiceRefillTrigger,
	DiceRestType,
	ModifyDicePoolRuleLike,
	NumericInput,
	RuleBackedItem,
};
