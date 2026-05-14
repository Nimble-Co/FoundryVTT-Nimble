import type { ChargePoolRuleConfig } from '#utils/chargePoolRuleConfig.js';

type ChargePoolScope = (typeof ChargePoolRuleConfig.scopes)[number];
type ChargePoolDieSize = (typeof ChargePoolRuleConfig.dieSizes)[number];
type ChargePoolInitialMode = (typeof ChargePoolRuleConfig.initialModes)[number];
type ChargeRecoveryTrigger = (typeof ChargePoolRuleConfig.recoveryTriggers)[number];
type ChargeRecoveryMode = (typeof ChargePoolRuleConfig.recoveryModes)[number];
type ChargeRestType = (typeof ChargePoolRuleConfig.restTypes)[number];
type ManualAdjustMode = (typeof ChargePoolRuleConfig.recoveryModes)[number];
type NumericInput = number | string | null | undefined;

type ChargeRecoveryEntry = {
	trigger: ChargeRecoveryTrigger;
	mode: ChargeRecoveryMode;
	value: string;
};

type ChargePoolState = {
	id: string;
	identifier: string;
	scope: ChargePoolScope;
	sourceItemId: string;
	sourceItemName: string;
	label: string;
	current: number;
	max: number;
	/**
	 * Optional die size hint for charges that represent rollable dice (e.g.
	 * Commander Combat Dice, Artificer Mana Dice). Consumers roll a die of
	 * this size at spend time. `null` means the charges are dimensionless
	 * (a pure count of uses).
	 */
	dieSize: ChargePoolDieSize | null;
	icon?: string;
	recoveries: ChargeRecoveryEntry[];
};

type ChargePoolMap = Record<string, ChargePoolState>;

type ChargePoolDefinition = Omit<ChargePoolState, 'current'> & {
	initial: ChargePoolInitialMode;
};

type ChargePoolRuleLike = {
	type?: string;
	disabled?: boolean;
	id?: string;
	identifier?: string;
	label?: string;
	scope?: string;
	max?: string;
	icon?: string;
	initial?: string;
	dieSize?: string | null;
	recoveries?: unknown;
};

type ChargeConsumerRuleLike = {
	type?: string;
	disabled?: boolean;
	id?: string;
	identifier?: string;
	poolIdentifier?: string;
	poolScope?: string;
	cost?: string;
};

type RuleLike = ChargePoolRuleLike & ChargeConsumerRuleLike;

type RuleBackedItem = Item.Implementation & {
	rules?: Map<string, RuleLike>;
};

type CharacterActorLike = Actor.Implementation & {
	type: 'character';
	items: foundry.abstract.EmbeddedCollection<Item.Implementation, Actor.Implementation>;
	getRollData(): Record<string, unknown>;
};

type ChargeConsumerState = {
	poolId: string;
	poolIdentifier: string;
	cost: number;
};

type ChargeContext = {
	isMiss?: boolean;
	isCritical?: boolean;
};

type ChargeValidationFailure = {
	code: 'poolMissing' | 'insufficientCharges' | 'consumptionBlocked';
	poolIdentifier: string;
	poolLabel: string;
	required: number;
	available: number;
};

type ChargeConsumptionDetail = {
	poolLabel: string;
	previousValue: number;
	currentValue: number;
	maxValue: number;
	change: number;
	recovery?: {
		trigger: string;
		previousValue: number;
		newValue: number;
	};
};

type ChargeValidationResult = {
	ok: boolean;
	failure?: ChargeValidationFailure;
	consumption?: ChargeConsumptionDetail[];
};

type ChargePoolRecoveryPreview = {
	poolId: string;
	label: string;
	icon?: string;
	previousValue: number;
	newValue: number;
	maxValue: number;
	recoveredAmount: number;
};

export type {
	ChargePoolScope,
	ChargePoolDieSize,
	ChargePoolInitialMode,
	ChargeRecoveryTrigger,
	ChargeRecoveryMode,
	ChargeRestType,
	ManualAdjustMode,
	NumericInput,
	ChargeRecoveryEntry,
	ChargePoolState,
	ChargePoolMap,
	ChargePoolDefinition,
	ChargePoolRuleLike,
	ChargeConsumerRuleLike,
	RuleLike,
	RuleBackedItem,
	CharacterActorLike,
	ChargeConsumerState,
	ChargeContext,
	ChargeValidationFailure,
	ChargeConsumptionDetail,
	ChargeValidationResult,
	ChargePoolRecoveryPreview,
};
