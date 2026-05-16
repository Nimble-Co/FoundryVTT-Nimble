import type {
	ActionConsequence,
	LabeledOption,
	NodeOption,
} from '#types/components/ItemActivationEffectsConfigTab.d.ts';
import localize from '#utils/localize.js';

export const POOL_PREDICATE_PLACEHOLDER = '{ "level": { "min": 5 } }';

/**
 * Available child-node options for the "Add Effect" picker. The set depends
 * on the parent node type: top-level adds (node === null) can create damage,
 * healing, condition, pool, savingThrow; damage children can additionally
 * create damageOutcome and note; savingThrow children only create damage,
 * healing, condition, note.
 */
export function getNodeOptions(node: { type?: string } | null): NodeOption[] {
	const { saves } = CONFIG.NIMBLE;
	const nodeOptions = new Map<string, string>([
		['condition', localize('NIMBLE.activationEffects.condition')],
		['damage', localize('NIMBLE.activationEffects.damage')],
		['damageOutcome', localize('NIMBLE.activationEffects.damageOutcome')],
		['healing', localize('NIMBLE.activationEffects.healing')],
		['note', localize('NIMBLE.activationEffects.note')],
		['pool', localize('NIMBLE.activationEffects.pool')],
		['savingThrow', saves.save],
	]);

	const includedOptions: string[] = [];

	if (node === null) {
		includedOptions.push('damage', 'healing', 'condition', 'pool', 'savingThrow');
	} else if (node.type === 'damage') {
		includedOptions.push('damage', 'damageOutcome', 'healing', 'condition', 'savingThrow', 'note');
	} else if (node.type === 'savingThrow') {
		includedOptions.push('damage', 'healing', 'condition', 'note');
	}

	return includedOptions.sort().map((option) => ({
		value: option,
		label: nodeOptions.get(option) ?? option,
	}));
}

/**
 * Outcome buckets the user can add child effects under (e.g. onCriticalHit,
 * onMiss). Driven by node type and parentContext: sharedRolls-context damage
 * exposes failedSave/passedSave; standalone damage exposes hit/miss/critical.
 */
export function getValidActionConsequences(node: {
	type?: string;
	parentContext?: string;
}): ActionConsequence[] {
	if (node.type === 'damage') {
		if (node.parentContext === 'sharedRolls') {
			return [
				['failedSave', localize('NIMBLE.activationEffects.onFailedSave')],
				['passedSave', localize('NIMBLE.activationEffects.onPassedSave')],
			];
		}
		return [
			['criticalHit', localize('NIMBLE.activationEffects.onCriticalHit')],
			['hit', localize('NIMBLE.activationEffects.onHit')],
			['miss', localize('NIMBLE.activationEffects.onMiss')],
		];
	}

	if (node.type === 'savingThrow') {
		return [
			['failedSave', localize('NIMBLE.activationEffects.onFailedSave')],
			['passedSave', localize('NIMBLE.activationEffects.onPassedSave')],
		];
	}

	return [];
}

export function prepareSavingThrowOptions(savingThrows: Record<string, string>): LabeledOption[] {
	return Object.entries(savingThrows).map(([key, value]) => ({ label: value, value: key }));
}

export function getDamageOutcomes(): LabeledOption[] {
	return [
		{ value: 'fullDamage', label: localize('NIMBLE.activationEffects.fullDamage') },
		{ value: 'halfDamage', label: localize('NIMBLE.activationEffects.halfDamage') },
	];
}

export function getDispositionOptions(): LabeledOption[] {
	return [
		{ value: 'any', label: 'Any' },
		{ value: 'friendly', label: 'Friendly' },
		{ value: 'neutral', label: 'Neutral' },
		{ value: 'hostile', label: 'Hostile' },
		{ value: 'secret', label: 'Secret' },
	];
}

export function getNoteTypes(): LabeledOption[] {
	return [
		{ value: 'general', label: localize('NIMBLE.activationEffects.general') },
		{ value: 'flavor', label: localize('NIMBLE.activationEffects.flavor') },
		{ value: 'reminder', label: localize('NIMBLE.activationEffects.reminder') },
		{ value: 'warning', label: localize('NIMBLE.activationEffects.warning') },
	];
}

export function getPoolTypes(): LabeledOption[] {
	return [
		{ value: 'dice', label: localize('NIMBLE.activationEffects.poolNode.config.poolTypeDice') },
		{ value: 'charge', label: localize('NIMBLE.activationEffects.poolNode.config.poolTypeCharge') },
	];
}

export function getPoolActions(): LabeledOption[] {
	return [
		{ value: 'rollDie', label: localize('NIMBLE.activationEffects.poolNode.config.actionRollDie') },
		{
			value: 'rollPool',
			label: localize('NIMBLE.activationEffects.poolNode.config.actionRollPool'),
		},
		{
			value: 'fillCount',
			label: localize('NIMBLE.activationEffects.poolNode.config.actionFillCount'),
		},
		{ value: 'clear', label: localize('NIMBLE.activationEffects.poolNode.config.actionClear') },
	];
}
