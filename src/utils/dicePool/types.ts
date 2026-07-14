import type { DicePoolRuleConfig } from './dicePoolRuleConfig.js';

type DicePoolScope = (typeof DicePoolRuleConfig.scopes)[number];
type DieSize = (typeof DicePoolRuleConfig.dieSizes)[number];
type DicePoolInitialMode = (typeof DicePoolRuleConfig.initialModes)[number];
type DiceRefillTrigger = (typeof DicePoolRuleConfig.refillTriggers)[number];
type DiceRefillMode = (typeof DicePoolRuleConfig.refillModes)[number];
type DiceRestType = (typeof DicePoolRuleConfig.restTypes)[number];
type DiceConsumptionMode = (typeof DicePoolRuleConfig.consumptionModes)[number];
type DiceAttackDeliveryFilter = (typeof DicePoolRuleConfig.attackDeliveryFilters)[number];
type NumericInput = number | string | null | undefined;

type DiceRefillEntry = {
	trigger: DiceRefillTrigger;
	mode: DiceRefillMode;
	value: string;
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
	consumption: DiceConsumptionMode;
	bonusOnAttackDelivery: DiceAttackDeliveryFilter | null;
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

type DiceConsumerRuleLike = {
	type?: string;
	disabled?: boolean;
	id?: string;
	poolIdentifier?: string;
	poolScope?: string;
	mode?: string;
	cost?: string;
	bonusOnAttackDelivery?: string | null;
	effectType?: string;
};

/** Payload of the `<system>.dicePool.requestSpend` hook, emitted when an item
 *  with a manual diceConsumer is activated so the sheet can open the spend UI. */
type DicePoolSpendRequestPayload = {
	actorUuid: string;
	itemId: string;
	ruleId: string;
	poolIdentifier: string;
	poolScope: string;
};

type ModifyPoolRuleLike = {
	type?: string;
	disabled?: boolean;
	id?: string;
	poolType?: string;
	poolIdentifier?: string;
	dieSize?: string | null;
	maxDelta?: string | null;
};

type DicePoolRuleAny = DicePoolRuleLike & DiceConsumerRuleLike & ModifyPoolRuleLike;

type RuleBackedItem = Item.Implementation & {
	rules?: Map<string, DicePoolRuleAny>;
};

type CharacterActorLike = Actor.Implementation & {
	type: 'character';
	items: foundry.abstract.EmbeddedCollection<Item.Implementation, Actor.Implementation>;
	getRollData(): Record<string, unknown>;
};

export type {
	CharacterActorLike,
	DiceAttackDeliveryFilter,
	DiceConsumerRuleLike,
	DiceConsumptionMode,
	DicePoolDefinition,
	DicePoolInitialMode,
	DicePoolMap,
	DicePoolRuleAny,
	DicePoolRuleLike,
	DicePoolScope,
	DicePoolSpendRequestPayload,
	DicePoolState,
	DieSize,
	DiceRefillEntry,
	DiceRefillMode,
	DiceRefillTrigger,
	DiceRestType,
	ModifyPoolRuleLike,
	NumericInput,
	RuleBackedItem,
};
