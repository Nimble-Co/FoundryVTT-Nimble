export type AttackDelivery = 'melee' | 'ranged' | null;

export interface SpendablePool {
	id: string;
	identifier: string;
	label: string;
	dieSize: string;
	faces: number[];
	consumption: 'manual' | 'autoBonus';
	bonusOnAttackDelivery: 'melee' | 'ranged' | 'any' | null;
}

export interface SpendableChargePool {
	id: string;
	identifier: string;
	label: string;
	dieSize: string;
	current: number;
	max: number;
}

export interface AutoBonusSummary {
	id: string;
	label: string;
	faces: number[];
	total: number;
}

export interface PoolBonusEntry {
	face: number;
	label: string;
}

export interface ChargeBonusFragment {
	formula: string;
	display: string;
	label: string;
}

export interface ConsumedPoolDie {
	poolId: string;
	faceIndex: number;
}

export interface ConsumedChargePool {
	poolId: string;
	count: number;
}

export interface ItemActivationConfigDialogSubmitData {
	rollMode: number;
	rollFormula: string;
	situationalModifiers: string;
	primaryDieValue: number | null | undefined;
	primaryDieModifier: number | null | undefined;
	rollHidden: boolean;
	consumedPoolDice: ConsumedPoolDie[];
	consumedChargePools: ConsumedChargePool[];
}

export interface ItemActivationConfigDialogInstance {
	submitActivation: (results: ItemActivationConfigDialogSubmitData) => void;
}

export interface ItemActivationConfigDialogProps {
	actor: Actor;
	dialog: ItemActivationConfigDialogInstance;
	item: Item;
	rollMode?: number;
}
