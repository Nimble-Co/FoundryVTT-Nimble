import type { SpellDisplayData } from '#types/components/LevelUpSpellCard.d.ts';
import type { SpellSystemData } from '#types/components/SpellReferenceCard.d.ts';
import { flattenActivationEffects } from '#utils/activationEffects.js';
import type { SpellIndexEntry } from '#utils/getSpells.js';
import localize from '#utils/localize.js';

/** Extended spell system data that includes mana cost */
interface SpellSystemDataWithMana extends SpellSystemData {
	manaCost?: number;
}

/**
 * Extracts display data from a spell's system data for rendering in the card.
 */
function extractDisplayData(system: SpellSystemDataWithMana): SpellDisplayData {
	const { activationCostTypes, activationCostTypesPlural } = CONFIG.NIMBLE;

	// Action cost
	let meta: string | null = null;
	const activation = system.activation;
	if (activation?.cost) {
		const { type: activationType, quantity: activationCost } = activation.cost;
		if (activationType && activationType !== 'none') {
			if (['action', 'minute', 'hour'].includes(activationType)) {
				const label =
					activationCost > 1
						? activationCostTypesPlural[activationType]
						: activationCostTypes[activationType];
				meta = `${activationCost || 1} ${label}`;
			} else if (activationType === 'reaction' || activationType === 'special') {
				meta = activationCostTypes[activationType];
			}
		}
	}

	// Concentration
	const requiresConcentration = system.properties?.selected?.includes('concentration') ?? false;

	// Target type
	let targetType: string | null = null;
	if (activation) {
		if (activation.acquireTargetsFromTemplate) {
			targetType = localize('NIMBLE.ui.heroicActions.targetTypes.aoe');
		} else {
			const targetCount = activation.targets?.count ?? 1;
			if (targetCount === 0) targetType = localize('NIMBLE.ui.heroicActions.targetTypes.self');
			else if (targetCount === 1)
				targetType = localize('NIMBLE.ui.heroicActions.targetTypes.singleTarget');
			else if (targetCount === 2)
				targetType = localize('NIMBLE.ui.heroicActions.targetTypes.twoTargets');
			else
				targetType = localize('NIMBLE.ui.heroicActions.targetTypes.multiTarget', {
					count: String(targetCount),
				});
		}
	}

	// Range
	let spellRange: string | null = null;
	const props = system.properties ?? {};
	const selected = props.selected ?? [];
	if (selected.includes('range') && props.range?.max) {
		spellRange = localize('NIMBLE.ui.heroicActions.rangeDistance', {
			distance: String(props.range.max),
		});
	} else if (selected.includes('reach') && props.reach?.max) {
		spellRange = localize('NIMBLE.ui.heroicActions.reachDistance', {
			distance: String(props.reach.max),
		});
	}

	// Mana cost
	const manaCost = system.manaCost ?? 0;

	// Damage/healing effect
	let effect: { formula: string; isHealing: boolean } | null = null;
	const effects = activation?.effects;
	const flattened = flattenActivationEffects(effects);
	for (const node of flattened) {
		const effectType = node.type;
		if (effectType !== 'damage' && effectType !== 'healing') continue;
		const formula = node.formula || node.roll;
		if (typeof formula === 'string' && formula.trim().length > 0) {
			effect = {
				formula: formula.trim(),
				isHealing: effectType === 'healing' || node.damageType === 'healing',
			};
			break;
		}
	}

	// Description
	const desc = system.description;
	const hasContent = (text: unknown): text is string =>
		typeof text === 'string' && text.replace(/<[^>]*>/g, '').trim().length > 0;

	const description = typeof desc === 'object' && desc !== null ? desc : null;

	return {
		meta,
		requiresConcentration,
		targetType,
		spellRange,
		manaCost,
		effect,
		baseEffect: hasContent(description?.baseEffect) ? description!.baseEffect! : null,
		higherLevelEffect: hasContent(description?.higherLevelEffect)
			? description!.higherLevelEffect!
			: null,
	};
}

/**
 * Creates reactive state for the LevelUpSpellCard component.
 *
 * Loads the full spell data asynchronously via fromUuid and extracts
 * display metadata. Manages the accordion expand/collapse state.
 */
export function createLevelUpSpellCardState(getSpell: () => SpellIndexEntry) {
	let displayData = $state<SpellDisplayData | null>(null);
	let isExpanded = $state(false);

	$effect(() => {
		const spell = getSpell();
		fromUuid(spell.uuid as `Item.${string}`).then((item) => {
			if (!item) return;
			const system = (item as Item).system as unknown as SpellSystemDataWithMana;
			displayData = extractDisplayData(system);
		});
	});

	function toggleExpanded() {
		isExpanded = !isExpanded;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggleExpanded();
		}
	}

	return {
		get displayData() {
			return displayData;
		},
		get isExpanded() {
			return isExpanded;
		},
		toggleExpanded,
		handleKeydown,
	};
}
