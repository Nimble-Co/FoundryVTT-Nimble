import type {
	SpellCardDisplayData,
	SpellEffect,
	SpellSystemData,
} from '#types/components/SpellReferenceCard.d.ts';
import { flattenActivationEffects } from '../../../../utils/activationEffects.js';
import localize from '../../../../utils/localize.js';

/**
 * Extracts the primary damage/healing effect from a spell's activation effects
 */
function getSpellEffect(system: SpellSystemData): SpellEffect | null {
	const effects = system.activation?.effects;
	const flattened = flattenActivationEffects(effects);

	for (const node of flattened) {
		const effectType = node.type;
		if (effectType !== 'damage' && effectType !== 'healing') continue;

		const formula = node.formula || node.roll;
		if (typeof formula === 'string' && formula.trim().length > 0) {
			return {
				formula: formula.trim(),
				isHealing: effectType === 'healing' || node.damageType === 'healing',
			};
		}
	}

	return null;
}

/**
 * Gets the activation cost metadata for a spell (e.g., "1 Action", "Reaction")
 */
function getSpellMetadata(system: SpellSystemData): string | null {
	const { activationCostTypes, activationCostTypesPlural } = CONFIG.NIMBLE;
	const activation = system.activation;
	if (!activation?.cost) return null;

	const { type: activationType, quantity: activationCost } = activation.cost;

	if (!activationType || activationType === 'none') return null;

	if (['action', 'minute', 'hour'].includes(activationType)) {
		const label =
			activationCost > 1
				? activationCostTypesPlural[activationType]
				: activationCostTypes[activationType];
		return `${activationCost || 1} ${label}`;
	}

	if (activationType === 'reaction' || activationType === 'special') {
		return activationCostTypes[activationType];
	}

	return null;
}

/**
 * Gets the range or reach distance for a spell
 */
function getSpellRange(system: SpellSystemData): string | null {
	const props = system.properties ?? {};
	const selected = props.selected ?? [];

	if (selected.includes('range') && props.range?.max) {
		return localize('NIMBLE.ui.heroicActions.rangeDistance', {
			distance: String(props.range.max),
		});
	}
	if (selected.includes('reach') && props.reach?.max) {
		return localize('NIMBLE.ui.heroicActions.reachDistance', {
			distance: String(props.reach.max),
		});
	}
	return null;
}

/**
 * Gets the target type for a spell (Single Target, AoE, Self, etc.)
 */
function getSpellTargetType(system: SpellSystemData): string | null {
	const activation = system.activation;
	if (!activation) return null;

	if (activation.acquireTargetsFromTemplate) {
		return localize('NIMBLE.ui.heroicActions.targetTypes.aoe');
	}

	const targetCount = activation.targets?.count ?? 1;

	if (targetCount === 0) {
		return localize('NIMBLE.ui.heroicActions.targetTypes.self');
	}
	if (targetCount === 1) {
		return localize('NIMBLE.ui.heroicActions.targetTypes.singleTarget');
	}
	if (targetCount === 2) {
		return localize('NIMBLE.ui.heroicActions.targetTypes.twoTargets');
	}
	return localize('NIMBLE.ui.heroicActions.targetTypes.multiTarget', {
		count: String(targetCount),
	});
}

/**
 * Creates reactive state for displaying spell card data
 *
 * @param getSpell - Getter function that returns the spell item
 * @returns Object containing derived spell display data
 */
export function createSpellCardState(getSpell: () => Item) {
	const system = $derived(getSpell().system as unknown as SpellSystemData);

	const displayData: SpellCardDisplayData = $derived.by(() => ({
		tier: system.tier,
		requiresConcentration: system.properties?.selected?.includes('concentration') ?? false,
		meta: getSpellMetadata(system),
		effect: getSpellEffect(system),
		spellRange: getSpellRange(system),
		targetType: getSpellTargetType(system),
	}));

	return {
		get displayData() {
			return displayData;
		},
	};
}
