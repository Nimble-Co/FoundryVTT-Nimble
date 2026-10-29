import type { ItemLike } from './sheetSource.ts';

/** Typed reads of the item fields that the views use. `ItemLike.system` is untyped. */

type AnyRecord = Record<string, unknown>;

const record = (value: unknown): AnyRecord =>
	typeof value === 'object' && value !== null ? (value as AnyRecord) : {};

export interface ActivationCost {
	type: string;
	quantity: number;
	isReaction: boolean;
}

export function activationOf(item: ItemLike): AnyRecord {
	return record(item.system.activation);
}

export function activationCost(item: ItemLike): ActivationCost {
	const cost = record(activationOf(item).cost);
	return {
		type: typeof cost.type === 'string' ? cost.type : 'none',
		quantity: typeof cost.quantity === 'number' ? cost.quantity : 1,
		isReaction: cost.isReaction === true,
	};
}

export function selectedProperties(item: ItemLike): string[] {
	const selected = record(item.system.properties).selected;
	return Array.isArray(selected) ? selected.filter((entry) => typeof entry === 'string') : [];
}

export function spellTier(item: ItemLike): number {
	const tier = item.system.tier;
	return typeof tier === 'number' ? tier : 0;
}

export function spellSchool(item: ItemLike): string {
	const school = item.system.school;
	return typeof school === 'string' ? school : '';
}

export function isUtilitySpell(item: ItemLike): boolean {
	return selectedProperties(item).includes('utilitySpell');
}

export function enabledRules(item: ItemLike) {
	return item.rules.filter((rule) => rule.fields.disabled !== true);
}
